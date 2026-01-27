import { ComponentTranslator, TranslationContext } from '../core/types';
import { FigmaNode } from '../../figma/types';
import { ComponentDefinition, ComponentConfiguration } from '../../core/schemas';

/**
 * A generic translator that uses external configuration to map Figma components to SwiftUI.
 * 
 * Streamlined approach: The config just specifies the Swift View name and parameter mappings.
 * This translator generates `SwiftViewName(param1: value1, param2: value2, ...)`.
 */
export class ConfigurableComponentTranslator implements ComponentTranslator {
    private config: ComponentConfiguration;

    constructor(config: ComponentConfiguration) {
        this.config = config;
    }

    canHandle(node: FigmaNode): boolean {
        if (node.type !== 'INSTANCE' && node.type !== 'COMPONENT') {
            return false;
        }

        const componentId = node.componentId;
        const componentName = node.componentName || node.name;

        return this.config.components.some(def =>
            def.figmaId === componentId || def.figmaId === componentName
        );
    }

    translate(node: FigmaNode, context: TranslationContext): string {
        const indent = '    '.repeat(context.indentionLevel);
        const definition = this.findDefinition(node);

        if (!definition) {
            return `${indent}// Error: No definition found for component`;
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
        return `${indent}${definition.swiftView}(${paramString})`;
    }

    private findDefinition(node: FigmaNode): ComponentDefinition | undefined {
        const componentId = node.componentId;
        const componentName = node.componentName || node.name;

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

        return "/* missing */"
    }
}
