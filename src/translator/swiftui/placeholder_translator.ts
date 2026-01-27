import { ComponentTranslator, TranslationContext } from '../core/types';
import { FigmaNode } from '../../figma/types';

/**
 * Generates placeholder Views for unknown COMPONENT/INSTANCE nodes.
 * 
 * Used in handoff mode when a Figma component has no matching definition in components.json.
 * Produces a placeholder with correct frame sizing and a TODO comment.
 */
export class PlaceholderTranslator implements ComponentTranslator {
    canHandle(node: FigmaNode): boolean {
        // Only handle COMPONENT/INSTANCE nodes that weren't matched by ConfigurableComponentTranslator
        return node.type === 'COMPONENT' || node.type === 'INSTANCE';
    }

    translate(node: FigmaNode, context: TranslationContext): string {
        const indent = '    '.repeat(context.indentionLevel);
        const lines: string[] = [];

        // Extract a clean name for the placeholder
        const cleanName = this.sanitizeName(node.componentName || node.name);

        // Header comment
        lines.push(`${indent}// HANDOFF: Unknown component "${node.name}"`);
        if (node.componentId) {
            lines.push(`${indent}// Figma Component ID: ${node.componentId}`);
        }

        // Determine frame sizing from Figma
        const width = node.absoluteBoundingBox?.width;
        const height = node.absoluteBoundingBox?.height;

        // Generate placeholder view
        lines.push(`${indent}// TODO: Implement ${cleanName} component`);

        if (width && height) {
            lines.push(`${indent}Color.gray.opacity(0.2)`);
            lines.push(`${indent}    .frame(width: ${Math.round(width)}, height: ${Math.round(height)})`);
            lines.push(`${indent}    .overlay(`);
            lines.push(`${indent}        Text("${cleanName}")`);
            lines.push(`${indent}            .foregroundColor(.secondary)`);
            lines.push(`${indent}    )`);
        } else {
            lines.push(`${indent}Color.gray.opacity(0.2)`);
            lines.push(`${indent}    .overlay(`);
            lines.push(`${indent}        Text("${cleanName}")`);
            lines.push(`${indent}            .foregroundColor(.secondary)`);
            lines.push(`${indent}    )`);
        }

        return lines.join('\n');
    }

    /**
     * Convert Figma name to a valid Swift identifier.
     */
    private sanitizeName(name: string): string {
        return name
            .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special chars
            .split(/\s+/)                    // Split on whitespace
            .map((word, i) =>
                i === 0
                    ? word.charAt(0).toUpperCase() + word.slice(1)
                    : word.charAt(0).toUpperCase() + word.slice(1)
            )
            .join('') || 'UnknownComponent';
    }
}
