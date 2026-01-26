import { ComponentTranslator, TranslationContext } from '../core/types';
import { FigmaNode } from '../../figma/types';

/**
 * Known component IDs from your design system.
 * Replace these with actual component IDs from your Figma library.
 */
const DS_COMPONENT_IDS = {
    BUTTON_PRIMARY: 'ds:button-primary',
    BUTTON_SECONDARY: 'ds:button-secondary',
    BUTTON_TERTIARY: 'ds:button-tertiary',
    // Add more as needed
};

/**
 * Stub translator for design system buttons.
 * Matches by componentId for reliable identification.
 */
export class StubButtonTranslator implements ComponentTranslator {
    canHandle(node: FigmaNode): boolean {
        // INSTANCE nodes have componentId pointing to their main component
        if (node.type !== 'INSTANCE' && node.type !== 'COMPONENT') {
            return false;
        }

        // Primary: Match by component ID (most reliable)
        if (node.componentId && this.isButtonComponent(node.componentId)) {
            return true;
        }

        // Fallback: Match by component name if it contains "Button" 
        // (less reliable, but useful during development)
        if (node.componentName?.toLowerCase().includes('button')) {
            return true;
        }

        // Secondary fallback: Check node name (least reliable)
        // Only for development - remove in production
        if (node.name.toLowerCase().includes('dsbutton') ||
            node.name.toLowerCase().includes('ds button')) {
            return true;
        }

        return false;
    }

    translate(node: FigmaNode, context: TranslationContext): string {
        const indent = '    '.repeat(context.indentionLevel);

        // Determine button variant from componentId or name
        const variant = this.getButtonVariant(node);

        // Extract label from children or component properties
        let label = this.getOverriddenLabel(node) ?? this.extractLabel(node);

        // Check for disabled state
        const isDisabled = this.getIsDisabled(node);

        // Generate appropriate DSButton call
        let code = `${indent}DSButton(title: "${label}", style: .${variant}, action: {})`;

        if (isDisabled) {
            code += `\n${indent}    .disabled(true)`;
        }

        return code;
    }

    private isButtonComponent(componentId: string): boolean {
        return Object.values(DS_COMPONENT_IDS).includes(componentId) ||
            componentId.includes('button');
    }

    private getButtonVariant(node: FigmaNode): string {
        // Priority 1: Check componentProperties for VARIANT type (P2)
        if (node.componentProperties) {
            // Look for common variant property names
            const variantKeys = ['Style', 'Type', 'Variant', 'Configuration'];
            for (const key of variantKeys) {
                const prop = node.componentProperties[key];
                if (prop?.type === 'VARIANT' && typeof prop.value === 'string') {
                    const value = prop.value.toLowerCase();
                    if (value.includes('secondary')) return 'secondary';
                    if (value.includes('tertiary')) return 'tertiary';
                    if (value.includes('primary')) return 'primary';
                    // Use the variant value directly if it's a known style
                    if (['primary', 'secondary', 'tertiary', 'ghost', 'link', 'destructive'].includes(value)) {
                        return value;
                    }
                }
            }
        }

        // Priority 2: Fall back to componentId/name-based detection
        const id = node.componentId?.toLowerCase() ?? '';
        const name = (node.componentName ?? node.name).toLowerCase();

        if (id.includes('secondary') || name.includes('secondary')) {
            return 'secondary';
        }
        if (id.includes('tertiary') || name.includes('tertiary')) {
            return 'tertiary';
        }
        return 'primary';
    }

    private getOverriddenLabel(node: FigmaNode): string | undefined {
        if (!node.componentProperties) return undefined;

        // Look for common text property names
        const textKeys = ['Label', 'Text', 'Title', 'Content', 'Button Text'];
        for (const key of textKeys) {
            const prop = node.componentProperties[key];
            if (prop?.type === 'TEXT' && typeof prop.value === 'string') {
                return prop.value.replace(/"/g, '\\"');
            }
        }
        return undefined;
    }

    private getIsDisabled(node: FigmaNode): boolean {
        if (!node.componentProperties) return false;

        // Check BOOLEAN properties
        const boolKeys = ['Disabled', 'Is Disabled', 'State: Disabled'];
        for (const key of boolKeys) {
            const prop = node.componentProperties[key];
            if (prop?.type === 'BOOLEAN' && prop.value === true) {
                return true;
            }
        }

        // Check VARIANT properties (e.g. State=Disabled)
        const stateKeys = ['State', 'Status'];
        for (const key of stateKeys) {
            const prop = node.componentProperties[key];
            if (prop?.type === 'VARIANT' && typeof prop.value === 'string') {
                if (prop.value.toLowerCase() === 'disabled') {
                    return true;
                }
            }
        }

        return false;
    }

    private extractLabel(node: FigmaNode): string {
        if (!node.children) {
            return 'Button';
        }

        // Find text node in children (recursively if needed)
        const textNode = this.findTextNode(node);
        if (textNode?.characters) {
            return textNode.characters.replace(/"/g, '\\"');
        }

        return 'Button';
    }

    private findTextNode(node: FigmaNode): FigmaNode | undefined {
        if (node.type === 'TEXT') {
            return node;
        }

        if (node.children) {
            for (const child of node.children) {
                const found = this.findTextNode(child);
                if (found) return found;
            }
        }

        return undefined;
    }
}
