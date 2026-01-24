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

        // Extract label from children
        let label = this.extractLabel(node);

        // Generate appropriate DSButton call
        return `${indent}DSButton(title: "${label}", style: .${variant}, action: {})`;
    }

    private isButtonComponent(componentId: string): boolean {
        return Object.values(DS_COMPONENT_IDS).includes(componentId) ||
            componentId.includes('button');
    }

    private getButtonVariant(node: FigmaNode): string {
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
