import { ComponentTranslator, TranslationContext } from '../core/types';
import { FigmaNode } from '../../figma/types';
import { ComponentDefinition, ComponentConfiguration } from '../../core/schemas';

/**
 * A generic translator that uses external configuration to map Figma components to SwiftUI.
 * 
 * Streamlined approach: The config just specifies the Swift View name and parameter mappings.
 * This translator generates `SwiftViewName(param1: value1, param2: value2, ...)`.
 * 
 * In handoff mode (default), includes TODO comments for actions and references source files.
 */
export class ConfigurableComponentTranslator implements ComponentTranslator {
    private config: ComponentConfiguration;

    constructor(config: ComponentConfiguration) {
        this.config = config;
    }

    get handoffMode(): boolean {
        return this.config.handoffMode ?? true;
    }

    canHandle(node: FigmaNode, context?: Partial<TranslationContext>): boolean {
        if (node.type !== 'INSTANCE' && node.type !== 'COMPONENT') {
            return false;
        }

        return !!this.findDefinition(node, context?.componentSets, context?.components);
    }

    translate(node: FigmaNode, context: TranslationContext): string {
        const indent = '    '.repeat(context.indentionLevel);
        const definition = this.findDefinition(node, context.componentSets, context.components);

        if (!definition) {
            return `${indent}// Error: No definition found for component`;
        }

        const lines: string[] = [];

        // In handoff mode, add header comment with source reference
        if (this.handoffMode) {
            lines.push(`${indent}// HANDOFF: ${definition.swiftView} from Figma`);
            if (definition.sourceFile) {
                lines.push(`${indent}// Reference: ${definition.sourceFile}`);
            }
        }

        // Build parameter list
        const params: string[] = [];

        if (definition.params) {
            for (const [figmaProp, swiftParam] of Object.entries(definition.params)) {
                const value = this.resolveValue(node, figmaProp);
                params.push(`${swiftParam}: ${value}`);
            }
        }

        // Generate clean SwiftUI call
        const paramString = params.length > 0 ? params.join(', ') : '';
        lines.push(`${indent}${definition.swiftView}(${paramString})`);

        // In handoff mode, add TODO for action/callback if this looks like an interactive component
        if (this.handoffMode && this.looksInteractive(definition, node)) {
            lines.push(`${indent}    // TODO: Add action handler`);
        }

        return lines.join('\n');
    }

    private findDefinition(node: FigmaNode, componentSets?: Record<string, import('../../figma/types').FigmaComponentSetMetadata>, components?: Record<string, import('../../figma/types').FigmaComponentMetadata>): ComponentDefinition | undefined {
        const componentId = node.componentId;
        const componentName = node.componentName || node.name;

        // Resolve metadata from the root dictionaries
        const componentMetadata = componentId ? components?.[componentId] : undefined;
        const componentKey = componentMetadata?.key;
        const componentSetId = componentMetadata?.componentSetId;
        const componentSetMetadata = componentSetId ? componentSets?.[componentSetId] : undefined;
        const componentSetKey = componentSetMetadata?.key;

        // Priority 1: Match by stable component key (most reliable for specific variants)
        if (componentKey) {
            const match = this.config.components.find(def => def.figmaKey === componentKey);
            if (match) return match;
        }

        // Priority 2: Match by stable componentSet key (matches any variant of the set)
        if (componentSetKey) {
            const match = this.config.components.find(def => def.figmaComponentSetKey === componentSetKey);
            if (match) return match;
        }

        // Priority 3 (Backward Compatibility): Check componentSets via componentId directly
        if (componentId && componentSets && componentSets[componentId]) {
            const setMetadata = componentSets[componentId];
            const match = this.config.components.find(def =>
                def.figmaId === setMetadata.name || def.figmaId === componentId
            );
            if (match) return match;
        }

        // Priority 4 (Backward Compatibility): Check via components map using figmaId
        if (componentId && components && components[componentId] && componentSets) {
            const variantMetadata = components[componentId];
            if (variantMetadata.componentSetId && componentSets[variantMetadata.componentSetId]) {
                const setMetadata = componentSets[variantMetadata.componentSetId];
                const match = this.config.components.find(def =>
                    def.figmaId === setMetadata.name || def.figmaId === variantMetadata.componentSetId
                );
                if (match) return match;
            }
        }

        // Priority 5 (Fallback): Standard figmaId or name check
        return this.config.components.find(def =>
            def.figmaId === componentId || def.figmaId === componentName
        );
    }

    private resolveValue(node: FigmaNode, figmaProp: string): string {
        if (node.componentProperties && node.componentProperties[figmaProp]) {
            const prop = node.componentProperties[figmaProp];

            if (prop.type === 'BOOLEAN') {
                return prop.value.toString();
            }
            if (prop.type === 'TEXT') {
                return `"${prop.value}"`;
            }
            if (prop.type === 'VARIANT') {
                return `.${String(prop.value).toLowerCase()}`;
            }
        }

        return "/* missing */";
    }

    /**
     * Heuristic: determine if a component likely needs an action handler.
     * Checks for common interactive component patterns in the name.
     */
    private looksInteractive(definition: ComponentDefinition, node: FigmaNode): boolean {
        const name = (definition.swiftView + ' ' + node.name).toLowerCase();
        const interactivePatterns = ['button', 'tap', 'click', 'link', 'toggle', 'switch', 'checkbox', 'radio'];
        return interactivePatterns.some(pattern => name.includes(pattern));
    }
}
