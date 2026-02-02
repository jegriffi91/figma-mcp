import { ComponentTranslator, TranslationContext } from '../core/types';
import { FigmaNode, FigmaAlignItems, FigmaSolidFill } from '../../figma/types';

/**
 * Translates FRAME, GROUP, COMPONENT, INSTANCE nodes to Jetpack Compose layouts.
 * Uses Row/Column/Box equivalents to SwiftUI's HStack/VStack/ZStack.
 */
export class ComposeLayoutTranslator implements ComponentTranslator {
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

        const layoutType = this.getLayoutType(node);
        const isAutoLayout = node.layoutMode === 'VERTICAL' || node.layoutMode === 'HORIZONTAL';
        const needsWrapper = isAutoLayout && absoluteChildren.length > 0;

        // If wrapping, start with Box (for overlay of absolute children)
        if (needsWrapper) {
            lines.push(`${indent}Box(`);
            lines.push(`${childIndent}contentAlignment = Alignment.TopStart`);
            lines.push(`${indent}) {`);
        }

        const effectiveIndent = needsWrapper ? childIndent : indent;
        const effectiveChildIndent = needsWrapper ? '    '.repeat(context.indentionLevel + 2) : childIndent;

        // --- Build Main Flow Layout ---

        // Build modifiers
        const modifiers = this.buildModifiers(node, context);
        const modifierString = modifiers.length > 0
            ? `modifier = ${modifiers.join('\n' + effectiveIndent + '    ')}`
            : '';

        // Resolve spacing
        const spacingResult = node.itemSpacing !== undefined
            ? context.tokenResolver.resolveSpacing(node.itemSpacing)
            : null;

        // Build arrangement/alignment parameters
        const arrangementAndAlignment = this.getArrangementAndAlignment(node, layoutType, spacingResult);

        // Open layout (Row/Column/Box)
        const params = [arrangementAndAlignment, modifierString].filter(Boolean).join(',\n' + effectiveIndent + '    ');
        if (params) {
            lines.push(`${effectiveIndent}${layoutType}(`);
            lines.push(`${effectiveIndent}    ${params}`);
            lines.push(`${effectiveIndent}) {`);
        } else {
            lines.push(`${effectiveIndent}${layoutType} {`);
        }

        // Translate flow children
        if (flowChildren.length > 0) {
            const childContext: TranslationContext = {
                ...context,
                depth: context.depth + 1,
                indentionLevel: context.indentionLevel + (needsWrapper ? 2 : 1),
            };

            const useSpaceBetween = node.primaryAxisAlignItems === 'SPACE_BETWEEN';

            for (let i = 0; i < flowChildren.length; i++) {
                const child = flowChildren[i];
                const childCode = context.registry.translate(child, childContext);
                const childWithSizing = this.wrapChildWithSizing(childCode, child, effectiveChildIndent);
                lines.push(childWithSizing);

                // Insert Spacer between children for SPACE_BETWEEN
                if (useSpaceBetween && i < flowChildren.length - 1) {
                    lines.push(`${effectiveChildIndent}Spacer()`);
                }
            }
        }

        // Close layout
        lines.push(`${effectiveIndent}}`);

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
                    const rX = Math.round(x * 10) / 10;
                    const rY = Math.round(y * 10) / 10;
                    offsetModifiers = `\n${childIndent}    .offset(x = ${rX}.dp, y = ${rY}.dp)`;
                }

                lines.push(childCode + offsetModifiers);
            }

            // Close Box
            lines.push(`${indent}}`);
        }

        // Add node name as comment for debugging
        if (lines.length > 0) {
            lines[lines.length - 1] += ` // ${node.name}`;
        }

        return lines.join('\n');
    }

    private getLayoutType(node: FigmaNode): 'Column' | 'Row' | 'Box' {
        switch (node.layoutMode) {
            case 'HORIZONTAL':
                return 'Row';
            case 'VERTICAL':
                return 'Column';
            case 'NONE':
            default:
                return 'Box';
        }
    }

    private getArrangementAndAlignment(
        node: FigmaNode,
        layoutType: string,
        spacingResult: import('../../core/schemas').TokenResolutionResult<import('../../core/schemas').SpacingToken> | null
    ): string {
        const parts: string[] = [];

        // Arrangement (main axis)
        if (layoutType === 'Row' || layoutType === 'Column') {
            const arrangementProp = layoutType === 'Row' ? 'horizontalArrangement' : 'verticalArrangement';

            if (node.primaryAxisAlignItems === 'SPACE_BETWEEN') {
                parts.push(`${arrangementProp} = Arrangement.SpaceBetween`);
            } else if (spacingResult) {
                if (spacingResult.success) {
                    parts.push(`${arrangementProp} = Arrangement.spacedBy(${spacingResult.swiftUIValue}.dp)`);
                } else {
                    parts.push(`${arrangementProp} = Arrangement.spacedBy(${node.itemSpacing}.dp) // ${spacingResult.message}`);
                }
            }
        }

        // Alignment (cross axis)
        const alignment = this.mapAlignment(node, layoutType);
        if (alignment) {
            const alignmentProp = layoutType === 'Row' ? 'verticalAlignment' : 'horizontalAlignment';
            if (layoutType !== 'Box') {
                parts.push(`${alignmentProp} = ${alignment}`);
            }
        }

        return parts.join(',\n        ');
    }

    private mapAlignment(node: FigmaNode, layoutType: string): string | null {
        const alignItems = layoutType === 'Column'
            ? node.counterAxisAlignItems
            : node.primaryAxisAlignItems;

        if (layoutType === 'Box') {
            return 'Alignment.TopStart';
        }

        switch (alignItems) {
            case 'MIN':
                return layoutType === 'Column' ? 'Alignment.Start' : 'Alignment.Top';
            case 'CENTER':
                return layoutType === 'Column' ? 'Alignment.CenterHorizontally' : 'Alignment.CenterVertically';
            case 'MAX':
                return layoutType === 'Column' ? 'Alignment.End' : 'Alignment.Bottom';
            default:
                return null;
        }
    }

    private buildModifiers(node: FigmaNode, context: TranslationContext): string[] {
        const modifiers: string[] = ['Modifier'];

        // Frame sizing
        if (node.layoutSizingHorizontal === 'FILL') {
            modifiers.push('.fillMaxWidth()');
        }
        if (node.layoutSizingVertical === 'FILL') {
            modifiers.push('.fillMaxHeight()');
        }

        // Padding
        const padding = this.buildPaddingModifier(node, context);
        if (padding) modifiers.push(padding);

        // Background color
        const background = this.buildBackgroundModifier(node, context);
        if (background) modifiers.push(background);

        // Corner radius (must come before clip or as part of clip)
        const clip = this.buildClipModifier(node, context);
        if (clip) modifiers.push(clip);

        // Opacity
        if (node.opacity !== undefined && node.opacity < 1) {
            modifiers.push(`.alpha(${node.opacity.toFixed(2)}f)`);
        }

        return modifiers.length > 1 ? modifiers : [];
    }

    private wrapChildWithSizing(childCode: string, child: FigmaNode, indent: string): string {
        const sizingModifiers: string[] = [];

        if (child.layoutSizingHorizontal === 'FILL') {
            sizingModifiers.push('.fillMaxWidth()');
        }
        if (child.layoutSizingVertical === 'FILL') {
            sizingModifiers.push('.fillMaxHeight()');
        }

        if (sizingModifiers.length === 0) {
            return childCode;
        }

        const lines = childCode.split('\n');
        for (const mod of sizingModifiers) {
            lines.push(`${indent}    ${mod}`);
        }
        return lines.join('\n');
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
                return `.padding(${result.swiftUIValue}.dp)`;
            }
            return `.padding(${paddingTop}.dp) // ${result.message}`;
        }

        // Individual sides
        const edges: string[] = [];
        if (paddingTop) edges.push(`top = ${paddingTop}.dp`);
        if (paddingLeft) edges.push(`start = ${paddingLeft}.dp`);
        if (paddingBottom) edges.push(`bottom = ${paddingBottom}.dp`);
        if (paddingRight) edges.push(`end = ${paddingRight}.dp`);

        return `.padding(${edges.join(', ')})`;
    }

    private buildBackgroundModifier(node: FigmaNode, context: TranslationContext): string | null {
        if (!node.fills?.length) return null;

        const solidFill = node.fills.find((f): f is FigmaSolidFill => f.type === 'SOLID');
        if (!solidFill) return null;

        const colorResult = context.tokenResolver.resolveColor(solidFill.color);
        if (colorResult.success) {
            return `.background(${colorResult.swiftUIValue})`;
        }

        const { r, g, b } = solidFill.color;
        const toInt = (v: number) => Math.round(v * 255);
        return `.background(Color(0xFF${toInt(r).toString(16).padStart(2, '0')}${toInt(g).toString(16).padStart(2, '0')}${toInt(b).toString(16).padStart(2, '0')})) // ${colorResult.message}`;
    }

    private buildClipModifier(node: FigmaNode, context: TranslationContext): string | null {
        if (!node.cornerRadius && !node.clipsContent) return null;

        if (node.cornerRadius) {
            const result = context.tokenResolver.resolveCornerRadius(node.cornerRadius);
            if (result.success) {
                return `.clip(RoundedCornerShape(${result.swiftUIValue}.dp))`;
            }
            return `.clip(RoundedCornerShape(${node.cornerRadius}.dp)) // ${result.message}`;
        }

        if (node.clipsContent) {
            return '.clip(RectangleShape)';
        }

        return null;
    }
}

/**
 * Translates TEXT nodes to Jetpack Compose Text composables with styling.
 */
export class ComposeTextTranslator implements ComponentTranslator {
    canHandle(node: FigmaNode, _context?: Partial<TranslationContext>): boolean {
        return node.type === 'TEXT';
    }

    translate(node: FigmaNode, context: TranslationContext): string {
        const indent = '    '.repeat(context.indentionLevel);
        const text = node.characters || '';
        const safeText = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

        const lines: string[] = [];
        const params: string[] = [`text = "${safeText}"`];

        // Typography
        if (node.style) {
            const typoResult = context.tokenResolver.resolveTypography(node.style);
            if (typoResult.success) {
                params.push(`style = ${typoResult.swiftUIValue}`);
            } else {
                // Fallback to inline style
                const weight = this.mapFontWeight(node.style.fontWeight);
                params.push(`fontSize = ${node.style.fontSize}.sp`);
                params.push(`fontWeight = FontWeight.${weight}`);
            }
        }

        // Text color from fills
        const textColor = this.getTextColor(node, context);
        if (textColor) {
            params.push(`color = ${textColor}`);
        }

        // Text alignment
        const alignment = this.getTextAlignment(node);
        if (alignment) {
            params.push(`textAlign = ${alignment}`);
        }

        // Build Text composable
        lines.push(`${indent}Text(`);
        for (let i = 0; i < params.length; i++) {
            const comma = i < params.length - 1 ? ',' : '';
            lines.push(`${indent}    ${params[i]}${comma}`);
        }
        lines.push(`${indent})`);

        return lines.join('\n');
    }

    private getTextColor(node: FigmaNode, context: TranslationContext): string | null {
        if (!node.fills?.length) return null;

        const solidFill = node.fills.find((f): f is FigmaSolidFill => f.type === 'SOLID');
        if (!solidFill) return null;

        const colorResult = context.tokenResolver.resolveColor(solidFill.color);
        if (colorResult.success) {
            return colorResult.swiftUIValue;
        }

        const { r, g, b } = solidFill.color;
        const toInt = (v: number) => Math.round(v * 255);
        return `Color(0xFF${toInt(r).toString(16).padStart(2, '0')}${toInt(g).toString(16).padStart(2, '0')}${toInt(b).toString(16).padStart(2, '0')}) // ${colorResult.message}`;
    }

    private getTextAlignment(node: FigmaNode): string | null {
        switch (node.style?.textAlignHorizontal) {
            case 'LEFT': return 'TextAlign.Start';
            case 'CENTER': return 'TextAlign.Center';
            case 'RIGHT': return 'TextAlign.End';
            default: return null;
        }
    }

    private mapFontWeight(weight: number): string {
        if (weight <= 100) return 'Thin';
        if (weight <= 200) return 'ExtraLight';
        if (weight <= 300) return 'Light';
        if (weight <= 400) return 'Normal';
        if (weight <= 500) return 'Medium';
        if (weight <= 600) return 'SemiBold';
        if (weight <= 700) return 'Bold';
        if (weight <= 800) return 'ExtraBold';
        return 'Black';
    }
}
