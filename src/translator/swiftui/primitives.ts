import { ComponentTranslator, TranslationContext } from '../core/types';
import { FigmaNode, FigmaAlignItems, FigmaSolidFill } from '../../figma/types';

/**
 * Translates FRAME, GROUP, COMPONENT, INSTANCE nodes to SwiftUI stacks.
 * Respects layoutMode and uses DS spacing tokens.
 */
export class FrameTranslator implements ComponentTranslator {
    canHandle(node: FigmaNode, _context?: Partial<TranslationContext>): boolean {
        return node.type === 'FRAME' || node.type === 'GROUP' || node.type === 'COMPONENT' || node.type === 'INSTANCE';
    }

    translate(node: FigmaNode, context: TranslationContext): string {
        const lines: string[] = [];
        const indent = '    '.repeat(context.indentionLevel);
        const childIndent = '    '.repeat(context.indentionLevel + 1);

        // Separate children into flow (regular) and absolute (positioned)
        const allChildren = node.children || [];
        const flowChildren = allChildren.filter(c => c.layoutPositioning !== 'ABSOLUTE');
        const absoluteChildren = allChildren.filter(c => c.layoutPositioning === 'ABSOLUTE');

        // Determine if we need a ZStack wrapper (for absolute children)
        // If the layoutMode is NONE, it's already a ZStack, so we don't wrap, just treat all as flow (or handled by ZStack logic)
        // Actually, if layoutMode is NONE, getStackType returns ZStack.
        // But for Auto Layout (VERTICAL/HORIZONTAL), we need to wrap if there are absolute children.
        const stackType = this.getStackType(node);
        const isAutoLayout = node.layoutMode === 'VERTICAL' || node.layoutMode === 'HORIZONTAL';
        const needsWrapper = isAutoLayout && absoluteChildren.length > 0;

        // If wrapping, start with ZStack
        if (needsWrapper) {
            lines.push(`${indent}ZStack(alignment: .topLeading) {`);
            // We increase indentation for the inner content
            // However, to keep variable scopes simple, we'll just manually manage indentation strings for lines we push
            // or we could update context. But context is passed to recursive calls.
        }

        const effectiveIndent = needsWrapper ? childIndent : indent;
        const effectiveChildIndent = needsWrapper ? '    '.repeat(context.indentionLevel + 2) : childIndent;

        // --- Build Main Flow Stack ---

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
                lines.push(`${effectiveIndent}// ${spacingResult.message}`);
                if (spacingResult.closestMatches?.length) {
                    lines.push(`${effectiveIndent}// Closest: ${spacingResult.closestMatches.map(m => `${m.name} (${m.value})`).join(', ')}`);
                }
                spacingParam = `, spacing: ${node.itemSpacing!}`; // Fall back to raw value
            }
        }

        // Build alignment parameter
        const alignment = this.getAlignment(node, stackType);

        // Open stack (VStack/HStack/ZStack)
        lines.push(`${effectiveIndent}${stackType}(alignment: ${alignment}${spacingParam}) {`);

        // Translate flow children
        if (flowChildren.length > 0) {
            const childContext: TranslationContext = {
                ...context,
                depth: context.depth + 1,
                indentionLevel: context.indentionLevel + (needsWrapper ? 2 : 1),
            };

            // Check if we need to add Spacers for SPACE_BETWEEN
            const useSpaceBetween = node.primaryAxisAlignItems === 'SPACE_BETWEEN';

            for (let i = 0; i < flowChildren.length; i++) {
                const child = flowChildren[i];

                const childCode = context.registry.translate(child, childContext);

                // Add frame modifiers for FILL sizing
                const childWithSizing = this.wrapChildWithSizing(childCode, child, effectiveChildIndent);
                lines.push(childWithSizing);

                // Insert Spacer between children for SPACE_BETWEEN
                if (useSpaceBetween && i < flowChildren.length - 1) {
                    lines.push(`${effectiveChildIndent}Spacer()`);
                }
            }
        }

        // Close stack
        lines.push(`${effectiveIndent}}`);

        // --- End Main Flow Stack ---

        // --- Handle Absolute Children ---
        if (needsWrapper) {
            const absChildContext: TranslationContext = {
                ...context,
                depth: context.depth + 1,
                indentionLevel: context.indentionLevel + 1,
            };

            for (const child of absoluteChildren) {
                const childCode = context.registry.translate(child, absChildContext);

                // Calculate Offset
                let offsetModifiers = '';
                if (child.absoluteBoundingBox && node.absoluteBoundingBox) {
                    const x = child.absoluteBoundingBox.x - node.absoluteBoundingBox.x;
                    const y = child.absoluteBoundingBox.y - node.absoluteBoundingBox.y;
                    // Round to reasonable precision
                    const rX = Math.round(x * 10) / 10;
                    const rY = Math.round(y * 10) / 10;
                    offsetModifiers = `\n${childIndent}    .offset(x: ${rX}, y: ${rY})`;
                }

                // Append .offset to the last line of childCode is tricky if we don't parse it.
                // But wrapChildWithSizing logic appends lines.
                // We can just append the offset line.
                lines.push(childCode + offsetModifiers);
            }

            // Close ZStack
            lines.push(`${indent}}`);
        }

        // Add modifiers (Padding, Background, etc.)
        // These apply to the OUTERMOST container (ZStack if wrapped, or the Flow Stack if not)
        const modifiers = this.buildModifiers(node, context, indent);
        if (modifiers.length > 0) {
            // Remove the closing brace, add modifiers, then close?
            // Wait, existing logic:
            /*
            const lastLine = lines.pop()!;
            lines.push(lastLine); // This does nothing? Ah, it pushes back the '}' ?
            for (const mod of modifiers) { lines.push(...) }
            */
            // The existing logic doesn't seemingly attach modifiers *to* the brace correctly
            // It just pushes lines.
            // Correct SwiftUI:
            // Stack {
            // }
            // .mod()
            // .mod()

            // So we just push the modifiers at `indent` level.
            // The existing logic had:
            /*
            const lastLine = lines.pop()!;
            lines.push(lastLine);
            for (const mod of modifiers) ...
            */
            // This suggests it was just ensuring we are at the end.

            for (const mod of modifiers) {
                lines.push(`${indent}${mod}`);
            }
        }

        // Add node name as comment for debugging
        if (lines.length > 0) {
            lines[lines.length - 1] += ` // ${node.name}`;
        }

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

        // Frame sizing (for this node as a child)
        const frameSizing = this.buildFrameSizingModifier(node);
        if (frameSizing) modifiers.push(frameSizing);

        // Padding
        const padding = this.buildPaddingModifier(node, context);
        if (padding) modifiers.push(padding);

        // Background color
        const background = this.buildBackgroundModifier(node, context);
        if (background) modifiers.push(background);

        // Corner radius
        const radius = this.buildCornerRadiusModifier(node, context);
        if (radius) modifiers.push(radius);

        // Clipping (P1)
        if (node.clipsContent) {
            modifiers.push('.clipped()');
        }

        // Opacity
        if (node.opacity !== undefined && node.opacity < 1) {
            modifiers.push(`.opacity(${node.opacity.toFixed(2)})`);
        }

        return modifiers;
    }

    /**
     * Wraps child code with sizing modifiers based on layoutSizingHorizontal/Vertical
     */
    private wrapChildWithSizing(childCode: string, child: FigmaNode, indent: string): string {
        const sizingModifiers: string[] = [];

        // Horizontal sizing
        if (child.layoutSizingHorizontal === 'FILL') {
            sizingModifiers.push('.frame(maxWidth: .infinity)');
        }

        // Vertical sizing
        if (child.layoutSizingVertical === 'FILL') {
            sizingModifiers.push('.frame(maxHeight: .infinity)');
        }

        if (sizingModifiers.length === 0) {
            return childCode;
        }

        // Append modifiers to the last line of childCode
        const lines = childCode.split('\n');
        const lastLineIndex = lines.length - 1;
        for (const mod of sizingModifiers) {
            lines.push(`${indent}    ${mod}`);
        }
        return lines.join('\n');
    }

    /**
     * Build frame sizing modifier for this node based on its layoutSizing properties
     */
    private buildFrameSizingModifier(node: FigmaNode): string | null {
        const parts: string[] = [];

        if (node.layoutSizingHorizontal === 'FILL') {
            parts.push('maxWidth: .infinity');
        }
        if (node.layoutSizingVertical === 'FILL') {
            parts.push('maxHeight: .infinity');
        }

        if (parts.length === 0) return null;
        return `.frame(${parts.join(', ')})`;
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
    canHandle(node: FigmaNode, _context?: Partial<TranslationContext>): boolean {
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
