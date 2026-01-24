import { ComponentTranslator, TranslationContext } from '../core/types';
import { FigmaNode, FigmaAlignItems, FigmaSolidFill } from '../../figma/types';

/**
 * Translates FRAME, GROUP, COMPONENT, INSTANCE nodes to SwiftUI stacks.
 * Respects layoutMode and uses DS spacing tokens.
 */
export class FrameTranslator implements ComponentTranslator {
    canHandle(node: FigmaNode): boolean {
        return node.type === 'FRAME' || node.type === 'GROUP' || node.type === 'COMPONENT' || node.type === 'INSTANCE';
    }

    translate(node: FigmaNode, context: TranslationContext): string {
        const lines: string[] = [];
        const indent = '    '.repeat(context.indentionLevel);
        const childIndent = '    '.repeat(context.indentionLevel + 1);

        // Determine stack type based on layoutMode
        const stackType = this.getStackType(node);

        // Resolve spacing
        const spacingResult = node.itemSpacing !== undefined
            ? context.tokenResolver.resolveSpacing(node.itemSpacing)
            : null;

        // Build spacing parameter
        let spacingParam = '';
        if (spacingResult) {
            if (spacingResult.success) {
                spacingParam = `, spacing: ${spacingResult.swiftUIValue}`;
            } else {
                // Add warning as comment
                lines.push(`${indent}// ${spacingResult.message}`);
                if (spacingResult.closestMatches?.length) {
                    lines.push(`${indent}// Closest: ${spacingResult.closestMatches.map(m => `${m.name} (${m.value})`).join(', ')}`);
                }
                spacingParam = `, spacing: ${node.itemSpacing!}`; // Fall back to raw value
            }
        }

        // Build alignment parameter
        const alignment = this.getAlignment(node, stackType);

        // Open stack
        lines.push(`${indent}${stackType}(alignment: ${alignment}${spacingParam}) {`);

        // Translate children
        if (node.children) {
            const childContext: TranslationContext = {
                ...context,
                depth: context.depth + 1,
                indentionLevel: context.indentionLevel + 1,
            };

            for (const child of node.children) {
                const childCode = context.registry.translate(child, childContext);
                lines.push(childCode);
            }
        }

        // Close stack
        lines.push(`${indent}}`);

        // Add modifiers
        const modifiers = this.buildModifiers(node, context, indent);
        if (modifiers.length > 0) {
            // Remove the closing brace, add modifiers, then close
            const lastLine = lines.pop()!;
            lines.push(lastLine);
            for (const mod of modifiers) {
                lines.push(`${indent}${mod}`);
            }
        }

        // Add node name as comment for debugging
        lines[lines.length - 1] += ` // ${node.name}`;

        return lines.join('\n');
    }

    private getStackType(node: FigmaNode): 'VStack' | 'HStack' | 'ZStack' {
        switch (node.layoutMode) {
            case 'HORIZONTAL':
                return 'HStack';
            case 'VERTICAL':
                return 'VStack';
            case 'NONE':
            default:
                // No auto-layout = absolute positioning = ZStack
                // But if it has children in a list, default to VStack
                return node.layoutMode === 'NONE' ? 'ZStack' : 'VStack';
        }
    }

    private getAlignment(node: FigmaNode, stackType: string): string {
        // For VStack/HStack, map Figma alignment to SwiftUI
        const alignItems = stackType === 'VStack'
            ? node.counterAxisAlignItems  // Cross-axis for vertical
            : node.primaryAxisAlignItems;

        return this.mapAlignment(alignItems, stackType);
    }

    private mapAlignment(align: FigmaAlignItems | undefined, stackType: string): string {
        if (stackType === 'ZStack') {
            return '.center'; // ZStack uses Alignment, default center
        }

        // VStack/HStack use HorizontalAlignment/VerticalAlignment
        switch (align) {
            case 'MIN':
                return stackType === 'VStack' ? '.leading' : '.top';
            case 'CENTER':
                return '.center';
            case 'MAX':
                return stackType === 'VStack' ? '.trailing' : '.bottom';
            case 'BASELINE':
                return stackType === 'HStack' ? '.firstTextBaseline' : '.center';
            default:
                return stackType === 'VStack' ? '.leading' : '.center';
        }
    }

    private buildModifiers(node: FigmaNode, context: TranslationContext, indent: string): string[] {
        const modifiers: string[] = [];

        // Padding
        const padding = this.buildPaddingModifier(node, context);
        if (padding) modifiers.push(padding);

        // Background color
        const background = this.buildBackgroundModifier(node, context);
        if (background) modifiers.push(background);

        // Corner radius
        const radius = this.buildCornerRadiusModifier(node, context);
        if (radius) modifiers.push(radius);

        // Opacity
        if (node.opacity !== undefined && node.opacity < 1) {
            modifiers.push(`.opacity(${node.opacity.toFixed(2)})`);
        }

        return modifiers;
    }

    private buildPaddingModifier(node: FigmaNode, context: TranslationContext): string | null {
        const { paddingTop, paddingBottom, paddingLeft, paddingRight } = node;

        if (!paddingTop && !paddingBottom && !paddingLeft && !paddingRight) {
            return null;
        }

        // Check if all sides equal
        if (paddingTop === paddingBottom && paddingTop === paddingLeft && paddingTop === paddingRight && paddingTop) {
            const result = context.tokenResolver.resolveSpacing(paddingTop);
            if (result.success) {
                return `.padding(${result.swiftUIValue})`;
            }
            return `.padding(${paddingTop}) // ${result.message}`;
        }

        // Individual sides - use EdgeInsets
        const edges: string[] = [];
        if (paddingTop) edges.push(`top: ${paddingTop}`);
        if (paddingLeft) edges.push(`leading: ${paddingLeft}`);
        if (paddingBottom) edges.push(`bottom: ${paddingBottom}`);
        if (paddingRight) edges.push(`trailing: ${paddingRight}`);

        return `.padding(EdgeInsets(${edges.join(', ')}))`;
    }

    private buildBackgroundModifier(node: FigmaNode, context: TranslationContext): string | null {
        if (!node.fills?.length) return null;

        const solidFill = node.fills.find((f): f is FigmaSolidFill => f.type === 'SOLID');
        if (!solidFill) return null;

        const colorResult = context.tokenResolver.resolveColor(solidFill.color);
        if (colorResult.success) {
            return `.background(${colorResult.swiftUIValue})`;
        }

        // Fallback to raw Color
        const { r, g, b } = solidFill.color;
        return `.background(Color(red: ${r.toFixed(3)}, green: ${g.toFixed(3)}, blue: ${b.toFixed(3)})) // ${colorResult.message}`;
    }

    private buildCornerRadiusModifier(node: FigmaNode, context: TranslationContext): string | null {
        if (!node.cornerRadius) return null;

        const result = context.tokenResolver.resolveCornerRadius(node.cornerRadius);
        if (result.success) {
            return `.cornerRadius(${result.swiftUIValue})`;
        }

        return `.cornerRadius(${node.cornerRadius}) // ${result.message}`;
    }
}

/**
 * Translates TEXT nodes to SwiftUI Text views with styling.
 */
export class TextTranslator implements ComponentTranslator {
    canHandle(node: FigmaNode): boolean {
        return node.type === 'TEXT';
    }

    translate(node: FigmaNode, context: TranslationContext): string {
        const indent = '    '.repeat(context.indentionLevel);
        const text = node.characters || '';
        const safeText = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

        const lines: string[] = [];
        lines.push(`${indent}Text("${safeText}")`);

        // Typography
        if (node.style) {
            const typoResult = context.tokenResolver.resolveTypography(node.style);
            if (typoResult.success) {
                lines.push(`${indent}    ${typoResult.swiftUIValue}`);
            } else {
                lines.push(`${indent}    // ${typoResult.message}`);
                // Fallback to system font
                const weight = this.mapFontWeight(node.style.fontWeight);
                lines.push(`${indent}    .font(.system(size: ${node.style.fontSize}, weight: ${weight}))`);
            }
        }

        // Text color from fills
        const textColor = this.getTextColor(node, context);
        if (textColor) {
            lines.push(`${indent}    ${textColor}`);
        }

        // Text alignment
        const alignment = this.getTextAlignment(node);
        if (alignment) {
            lines.push(`${indent}    .multilineTextAlignment(${alignment})`);
        }

        return lines.join('\n');
    }

    private getTextColor(node: FigmaNode, context: TranslationContext): string | null {
        if (!node.fills?.length) return null;

        const solidFill = node.fills.find((f): f is FigmaSolidFill => f.type === 'SOLID');
        if (!solidFill) return null;

        const colorResult = context.tokenResolver.resolveColor(solidFill.color);
        if (colorResult.success) {
            return `.foregroundColor(${colorResult.swiftUIValue})`;
        }

        const { r, g, b } = solidFill.color;
        return `.foregroundColor(Color(red: ${r.toFixed(3)}, green: ${g.toFixed(3)}, blue: ${b.toFixed(3)})) // ${colorResult.message}`;
    }

    private getTextAlignment(node: FigmaNode): string | null {
        switch (node.style?.textAlignHorizontal) {
            case 'LEFT': return '.leading';
            case 'CENTER': return '.center';
            case 'RIGHT': return '.trailing';
            default: return null;
        }
    }

    private mapFontWeight(weight: number): string {
        if (weight <= 100) return '.ultraLight';
        if (weight <= 200) return '.thin';
        if (weight <= 300) return '.light';
        if (weight <= 400) return '.regular';
        if (weight <= 500) return '.medium';
        if (weight <= 600) return '.semibold';
        if (weight <= 700) return '.bold';
        if (weight <= 800) return '.heavy';
        return '.black';
    }
}
