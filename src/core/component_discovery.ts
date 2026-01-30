/**
 * Component Discovery Module
 * 
 * Extracts design system component keys from Figma node data and can merge
 * them into an existing components.json configuration.
 */

import { FigmaNode, FigmaComponentMetadata, FigmaComponentSetMetadata } from '../figma/types';
import { ComponentConfiguration, ComponentDefinition } from './schemas';

interface ExtractedParam {
    figmaName: string;
    suggestedSwiftName: string;
    type: string;
}

export interface DiscoveredComponent {
    setName: string;
    setKey: string;
    suggestedSwiftView: string;
    params: Record<string, string>;
}

function deriveSwiftViewName(name: string): string {
    if (name.includes('=')) {
        return '';
    }
    return name.replace(/\s+/g, '');
}

function deriveSwiftParamName(figmaName: string): string {
    const baseName = figmaName.split('#')[0];
    return baseName.charAt(0).toLowerCase() + baseName.slice(1);
}

/**
 * Walk the document tree to find INSTANCE nodes and extract their componentProperties
 */
function findInstanceProperties(
    node: FigmaNode,
    components: Record<string, FigmaComponentMetadata>,
    componentSets: Record<string, FigmaComponentSetMetadata>
): Map<string, ExtractedParam[]> {
    const result = new Map<string, ExtractedParam[]>();

    function walk(n: FigmaNode) {
        if (n.type === 'INSTANCE' && n.componentId && n.componentProperties) {
            const metadata = components[n.componentId];
            if (metadata?.remote) {
                const setId = metadata.componentSetId;
                const setMetadata = setId ? componentSets[setId] : null;
                const setKey = setMetadata?.key || metadata.key;

                const params: ExtractedParam[] = [];
                for (const [propName, prop] of Object.entries(n.componentProperties)) {
                    const propType = prop.type as string;
                    if (propType === 'SLOT' || propType === 'INSTANCE_SWAP') continue;

                    params.push({
                        figmaName: propName,
                        suggestedSwiftName: deriveSwiftParamName(propName),
                        type: prop.type,
                    });
                }

                const existing = result.get(setKey) || [];
                const existingNames = new Set(existing.map(p => p.figmaName));
                for (const param of params) {
                    if (!existingNames.has(param.figmaName)) {
                        existing.push(param);
                        existingNames.add(param.figmaName);
                    }
                }
                result.set(setKey, existing);
            }
        }

        if (n.children) {
            for (const child of n.children) {
                walk(child);
            }
        }
    }

    walk(node);
    return result;
}

/**
 * Extract all remote library components from a Figma node response
 */
export function discoverComponents(
    document: FigmaNode,
    components: Record<string, FigmaComponentMetadata>,
    componentSets: Record<string, FigmaComponentSetMetadata>
): DiscoveredComponent[] {
    const results: DiscoveredComponent[] = [];
    const seenSetKeys = new Set<string>();

    // Extract params from document tree
    const allParams = findInstanceProperties(document, components, componentSets);

    for (const [, metadata] of Object.entries(components)) {
        if (!metadata.remote) continue;

        const setMetadata = metadata.componentSetId
            ? componentSets?.[metadata.componentSetId]
            : null;

        const setKey = setMetadata?.key || '';
        const setName = setMetadata?.name || metadata.name;

        if (setKey && seenSetKeys.has(setKey)) continue;
        if (setKey) seenSetKeys.add(setKey);

        const suggestedSwiftView = deriveSwiftViewName(setName);
        if (!suggestedSwiftView) continue;

        // Build params map
        const extractedParams = allParams.get(setKey) || allParams.get(metadata.key) || [];
        const params: Record<string, string> = {};
        for (const p of extractedParams) {
            if (['TEXT', 'BOOLEAN', 'VARIANT'].includes(p.type)) {
                params[p.figmaName] = p.suggestedSwiftName;
            }
        }

        results.push({
            setName,
            setKey,
            suggestedSwiftView,
            params,
        });
    }

    return results.sort((a, b) => a.setName.localeCompare(b.setName));
}

/**
 * Merge discovered components into existing config, preserving user customizations
 */
export function mergeComponents(
    existingConfig: ComponentConfiguration,
    discovered: DiscoveredComponent[]
): { config: ComponentConfiguration; added: string[]; skipped: string[] } {
    const added: string[] = [];
    const skipped: string[] = [];

    // Build lookup of existing setKeys
    const existingKeys = new Set<string>();
    for (const comp of existingConfig.components) {
        if (comp.figmaComponentSetKey) {
            existingKeys.add(comp.figmaComponentSetKey);
        }
    }

    const newComponents: ComponentDefinition[] = [...existingConfig.components];

    for (const disc of discovered) {
        if (!disc.setKey) continue;

        if (existingKeys.has(disc.setKey)) {
            skipped.push(disc.setName);
        } else {
            newComponents.push({
                figmaComponentSetKey: disc.setKey,
                swiftView: disc.suggestedSwiftView,
                sourceFile: `TODO: Path to ${disc.suggestedSwiftView}.swift`,
                params: Object.keys(disc.params).length > 0 ? disc.params : undefined,
            });
            added.push(disc.setName);
        }
    }

    return {
        config: {
            handoffMode: existingConfig.handoffMode,
            components: newComponents,
        },
        added,
        skipped,
    };
}
