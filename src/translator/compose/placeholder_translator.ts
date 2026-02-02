import { ComponentTranslator, TranslationContext } from '../core/types';
import { FigmaNode } from '../../figma/types';

/**
 * Placeholder translator for unknown Compose components.
 * Generates a scaffold with TODO markers for the developer to implement.
 */
export class ComposePlaceholderTranslator implements ComponentTranslator {
    canHandle(node: FigmaNode, _context?: Partial<TranslationContext>): boolean {
        // This should be registered as a fallback, so it handles INSTANCE/COMPONENT
        // nodes that weren't matched by ConfigurableComponentTranslator
        return node.type === 'INSTANCE' || node.type === 'COMPONENT';
    }

    translate(node: FigmaNode, context: TranslationContext): string {
        const indent = '    '.repeat(context.indentionLevel);
        const componentName = node.componentName || node.name || 'UnknownComponent';
        const safeName = componentName.replace(/[^a-zA-Z0-9]/g, '');

        const lines: string[] = [];

        lines.push(`${indent}// HANDOFF: Unknown component "${componentName}"`);
        if (node.componentId) {
            lines.push(`${indent}// Figma Component ID: ${node.componentId}`);
        }
        lines.push(`${indent}// TODO: Implement ${safeName} composable`);

        // Generate a placeholder Box with approximate sizing
        const width = node.absoluteBoundingBox?.width || 100;
        const height = node.absoluteBoundingBox?.height || 50;

        lines.push(`${indent}Box(`);
        lines.push(`${indent}    modifier = Modifier`);
        lines.push(`${indent}        .size(width = ${Math.round(width)}.dp, height = ${Math.round(height)}.dp)`);
        lines.push(`${indent}        .background(Color.LightGray.copy(alpha = 0.2f))`);
        lines.push(`${indent}        .border(1.dp, Color.Gray, RoundedCornerShape(4.dp)),`);
        lines.push(`${indent}    contentAlignment = Alignment.Center`);
        lines.push(`${indent}) {`);
        lines.push(`${indent}    Text(`);
        lines.push(`${indent}        text = "${safeName}",`);
        lines.push(`${indent}        color = Color.Gray`);
        lines.push(`${indent}    )`);
        lines.push(`${indent}}`);

        return lines.join('\n');
    }
}
