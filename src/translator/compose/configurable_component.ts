import { ComponentTranslator, TranslationContext } from '../core/types';
import { FigmaNode } from '../../figma/types';
import { ComponentDefinition, ComponentConfiguration } from '../../core/schemas';

/**
 * A generic translator that uses external configuration to map Figma components to Jetpack Compose.
 * 
 * Uses composeComposable field from component definitions to generate Composable function calls.
 * In handoff mode (default), includes TODO comments for actions and references source files.
 */
export class ComposeConfigurableComponentTranslator implements ComponentTranslator {
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

        const definition = this.findDefinition(node, context?.componentSets, context?.components);
        // Only handle if we have a Compose-specific definition
        return !!definition?.composeComposable;
    }

    translate(node: FigmaNode, context: TranslationContext): string {
        const indent = '    '.repeat(context.indentionLevel);
        const definition = this.findDefinition(node, context.componentSets, context.components);

        if (!definition || !definition.composeComposable) {
            return `${indent}// Error: No Compose definition found for component`;
        }

        const lines: string[] = [];

        // In handoff mode, add header comment with source reference
        if (this.handoffMode) {
            lines.push(`${indent}// HANDOFF: ${definition.composeComposable} from Figma`);
            if (definition.kotlinSourceFile) {
                lines.push(`${indent}// Reference: ${definition.kotlinSourceFile}`);
            }
        }

        // Build parameter list
        const params: string[] = [];

        if (definition.params) {
            for (const [figmaProp, composeParam] of Object.entries(definition.params)) {
                const value = this.resolveValue(node, figmaProp);
                params.push(`${composeParam} = ${value}`);
            }
        }

        // Generate Composable call
        if (params.length > 0) {
            lines.push(`${indent}${definition.composeComposable}(`);
            for (let i = 0; i < params.length; i++) {
                const comma = i < params.length - 1 ? ',' : '';
                lines.push(`${indent}    ${params[i]}${comma}`);
            }
            lines.push(`${indent})`);
        } else {
            lines.push(`${indent}${definition.composeComposable}()`);
        }

        // In handoff mode, add TODO for action/callback if this looks like an interactive component
        if (this.handoffMode && this.looksInteractive(definition, node)) {
            lines.push(`${indent}// TODO: Add onClick or action handler`);
        }

        return lines.join('\n');
    }

    private findDefinition(
        node: FigmaNode,
        componentSets?: Record<string, import('../../figma/types').FigmaComponentSetMetadata>,
        components?: Record<string, import('../../figma/types').FigmaComponentMetadata>
    ): ComponentDefinition | undefined {
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
            const match = this.config.components.find(def => def.figmaKey === componentKey && def.composeComposable);
            if (match) return match;
        }

        // Priority 2: Match by stable componentSet key (matches any variant of the set)
        if (componentSetKey) {
            const match = this.config.components.find(def => def.figmaComponentSetKey === componentSetKey && def.composeComposable);
            if (match) return match;
        }

        // Priority 3 (Fallback): Standard figmaId or name check
        return this.config.components.find(def =>
            (def.figmaId === componentId || def.figmaId === componentName) && def.composeComposable
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
                // Compose enum style: EnumName.Value
                return `${String(prop.value)}`;
            }
        }

        return "/* missing */";
    }

    /**
     * Heuristic: determine if a component likely needs an action handler.
     */
    private looksInteractive(definition: ComponentDefinition, node: FigmaNode): boolean {
        const name = ((definition.composeComposable || '') + ' ' + node.name).toLowerCase();
        const interactivePatterns = ['button', 'tap', 'click', 'link', 'toggle', 'switch', 'checkbox', 'radio'];
        return interactivePatterns.some(pattern => name.includes(pattern));
    }
}
