#!/usr/bin/env npx ts-node
/**
 * Extract Design System Keys from Figma JSON
 * 
 * Usage: npx ts-node scripts/extract_design_keys.ts <path-to-figma-json>
 * 
 * This script extracts stable component keys from a Figma GET /files response,
 * useful for populating components.json with persistent identifiers.
 * 
 * Output: JSON array of design system components with their stable keys.
 */

import fs from 'fs';
import path from 'path';

interface FigmaComponentMetadata {
    key: string;
    name: string;
    description: string;
    remote?: boolean;
    componentSetId?: string;
}

interface FigmaComponentSetMetadata {
    key: string;
    name: string;
    description: string;
    remote?: boolean;
}

interface FigmaComponentProperty {
    type: 'VARIANT' | 'BOOLEAN' | 'TEXT' | 'INSTANCE_SWAP' | 'SLOT' | string;
    value: string | boolean | unknown;
}

interface FigmaNode {
    id: string;
    name: string;
    type: string;
    children?: FigmaNode[];
    componentId?: string;
    componentProperties?: Record<string, FigmaComponentProperty>;
}

interface FigmaNodeData {
    document: FigmaNode;
    components: Record<string, FigmaComponentMetadata>;
    componentSets: Record<string, FigmaComponentSetMetadata>;
}

interface FigmaFileResponse {
    nodes: Record<string, FigmaNodeData>;
}

interface ExtractedParam {
    figmaName: string;
    suggestedSwiftName: string;
    type: string;
    sampleValue?: string | boolean;
}

interface DesignSystemComponent {
    setName: string;
    setKey: string;
    variantName: string;
    variantKey: string;
    isRemote: boolean;
    suggestedSwiftView: string;
    description: string;
    params: ExtractedParam[];
}

function deriveSwiftViewName(name: string): string {
    // Convert "Atlas Section Title" -> "AtlasSectionTitle"
    // Convert "type=primary, size=large" -> skip (variant name, not useful)
    if (name.includes('=')) {
        return ''; // Variant descriptor, not a view name
    }
    return name.replace(/\s+/g, '');
}

function deriveSwiftParamName(figmaName: string): string {
    // "title#17004:0" -> "title"
    // "showSubtitle#17004:34" -> "showSubtitle"
    // "type" -> "type"
    const baseName = figmaName.split('#')[0];
    // Convert to camelCase if needed
    return baseName.charAt(0).toLowerCase() + baseName.slice(1);
}

// Walk the document tree to find INSTANCE nodes and their componentProperties
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

                // Extract params from componentProperties
                const params: ExtractedParam[] = [];
                for (const [propName, prop] of Object.entries(n.componentProperties)) {
                    // Skip internal/slot properties
                    if (prop.type === 'SLOT' || prop.type === 'INSTANCE_SWAP') continue;

                    params.push({
                        figmaName: propName,
                        suggestedSwiftName: deriveSwiftParamName(propName),
                        type: prop.type,
                        sampleValue: prop.type !== 'SLOT' ? prop.value as string | boolean : undefined,
                    });
                }

                // Merge with existing params for this setKey
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

        // Recurse into children
        if (n.children) {
            for (const child of n.children) {
                walk(child);
            }
        }
    }

    walk(node);
    return result;
}

function extractDesignKeys(figmaJson: FigmaFileResponse): DesignSystemComponent[] {
    const results: DesignSystemComponent[] = [];
    const seenSetKeys = new Set<string>();
    const allParams = new Map<string, ExtractedParam[]>();

    for (const nodeData of Object.values(figmaJson.nodes)) {
        const { document, components, componentSets } = nodeData;

        if (!components) continue;

        // First pass: extract params from document tree
        const nodeParams = findInstanceProperties(document, components, componentSets);
        for (const [key, params] of nodeParams) {
            const existing = allParams.get(key) || [];
            const existingNames = new Set(existing.map(p => p.figmaName));
            for (const param of params) {
                if (!existingNames.has(param.figmaName)) {
                    existing.push(param);
                }
            }
            allParams.set(key, existing);
        }

        // Second pass: build component list
        for (const [, metadata] of Object.entries(components)) {
            // Only include library components (remote: true)
            if (!metadata.remote) continue;

            const setMetadata = metadata.componentSetId
                ? componentSets?.[metadata.componentSetId]
                : null;

            const setKey = setMetadata?.key || '';
            const setName = setMetadata?.name || metadata.name;

            // Skip if we've already seen this componentSet
            if (setKey && seenSetKeys.has(setKey)) continue;
            if (setKey) seenSetKeys.add(setKey);

            const suggestedSwiftView = deriveSwiftViewName(setName);
            if (!suggestedSwiftView) continue; // Skip variant-only entries

            results.push({
                setName,
                setKey,
                variantName: metadata.name,
                variantKey: metadata.key,
                isRemote: metadata.remote,
                suggestedSwiftView,
                description: setMetadata?.description || metadata.description || '',
                params: allParams.get(setKey) || allParams.get(metadata.key) || [],
            });
        }
    }

    // Sort by setName for readability
    return results.sort((a, b) => a.setName.localeCompare(b.setName));
}

function generateComponentsJson(components: DesignSystemComponent[]): object {
    return {
        handoffMode: true,
        components: components
            .filter(c => c.setKey) // Only include components with set keys
            .map(c => {
                // Build params object: Figma name -> suggested Swift name
                const params: Record<string, string> = {};
                for (const p of c.params) {
                    // Only include user-facing params (TEXT, BOOLEAN, VARIANT)
                    if (['TEXT', 'BOOLEAN', 'VARIANT'].includes(p.type)) {
                        params[p.figmaName] = p.suggestedSwiftName;
                    }
                }

                return {
                    figmaComponentSetKey: c.setKey,
                    swiftView: c.suggestedSwiftView,
                    sourceFile: `TODO: Path to ${c.suggestedSwiftView}.swift`,
                    params: Object.keys(params).length > 0 ? params : undefined,
                };
            }),
    };
}

// Main execution
const args = process.argv.slice(2);
if (args.length === 0) {
    console.error('Usage: npx ts-node scripts/extract_design_keys.ts <path-to-figma-json>');
    console.error('');
    console.error('Options:');
    console.error('  --components-json   Output in components.json format');
    console.error('');
    process.exit(1);
}

const jsonPath = args.find(a => !a.startsWith('--'));
const outputComponentsJson = args.includes('--components-json');

if (!jsonPath) {
    console.error('Error: No JSON file path provided');
    process.exit(1);
}

const absolutePath = path.resolve(jsonPath);

if (!fs.existsSync(absolutePath)) {
    console.error(`Error: File not found: ${absolutePath}`);
    process.exit(1);
}

try {
    const content = fs.readFileSync(absolutePath, 'utf-8');
    const figmaJson: FigmaFileResponse = JSON.parse(content);

    const designKeys = extractDesignKeys(figmaJson);

    if (outputComponentsJson) {
        console.log(JSON.stringify(generateComponentsJson(designKeys), null, 2));
    } else {
        console.log('# Extracted Design System Components\n');
        console.log(`Found ${designKeys.length} unique component sets with remote=true\n`);

        console.log('| Component | Set Key | Params |');
        console.log('|-----------|---------|--------|');
        for (const comp of designKeys) {
            const paramCount = comp.params.length;
            console.log(`| ${comp.setName} | \`${comp.setKey.substring(0, 12)}...\` | ${paramCount} params |`);
        }

        console.log('\n## Full JSON Output\n');
        console.log('```json');
        console.log(JSON.stringify(designKeys, null, 2));
        console.log('```');
    }
} catch (error) {
    console.error('Error parsing JSON:', error instanceof Error ? error.message : error);
    process.exit(1);
}
