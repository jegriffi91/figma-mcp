import { FigmaNode, FigmaColor, FigmaSolidFill, FigmaTextStyle } from '../figma/types';
import { DesignTokenResolver } from '../tokens/resolver';

/**
 * Extracted color information from a Figma node
 */
export interface ColorInfo {
    hex: string;
    rgba: { r: number; g: number; b: number; a: number };
    usage: 'fill' | 'stroke' | 'text';
    nodeName: string;
    tokenMatch?: string;
}

/**
 * Extracted typography information
 */
export interface TypographyInfo {
    fontSize: number;
    fontWeight: number;
    fontFamily: string;
    text: string;
    tokenMatch?: string;
}

/**
 * Extracted spacing information
 */
export interface SpacingInfo {
    type: 'padding' | 'gap';
    values: { top?: number; right?: number; bottom?: number; left?: number; gap?: number };
    nodeName: string;
    tokenMatch?: string;
}

/**
 * Resolved design tokens for extracted values
 */
export interface ResolvedTokens {
    colors: Array<{ value: string; token: string }>;
    spacing: Array<{ value: number; token: string }>;
    typography: Array<{ size: number; weight: number; token: string }>;
}

/**
 * Complete metadata payload for vision-based translation
 */
export interface VisionMetadata {
    name: string;
    componentId?: string;
    colors: ColorInfo[];
    typography: TypographyInfo[];
    spacing: SpacingInfo[];
    tokens: ResolvedTokens;
    boundingBox: { width: number; height: number };
}

/**
 * Converts Figma color (0-1 RGBA) to hex string
 */
function colorToHex(color: FigmaColor): string {
    const r = Math.round(color.r * 255);
    const g = Math.round(color.g * 255);
    const b = Math.round(color.b * 255);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Extracts flattened metadata from a Figma node tree without generating code.
 * This provides the semantic information needed for vision-based translation.
 */
export class VisionContextExtractor {
    private tokenResolver: DesignTokenResolver;

    constructor(tokenResolver: DesignTokenResolver) {
        this.tokenResolver = tokenResolver;
    }

    /**
     * Extract all relevant metadata from a node tree
     */
    extract(node: FigmaNode): VisionMetadata {
        const colors: ColorInfo[] = [];
        const typography: TypographyInfo[] = [];
        const spacing: SpacingInfo[] = [];

        this.traverseNode(node, colors, typography, spacing);

        // Match tokens
        const tokens = this.matchTokens(colors, typography, spacing);

        return {
            name: node.name,
            componentId: node.componentId,
            colors: this.deduplicateColors(colors),
            typography: this.deduplicateTypography(typography),
            spacing: this.deduplicateSpacing(spacing),
            tokens,
            boundingBox: {
                width: node.absoluteBoundingBox?.width ?? 0,
                height: node.absoluteBoundingBox?.height ?? 0,
            },
        };
    }

    private traverseNode(
        node: FigmaNode,
        colors: ColorInfo[],
        typography: TypographyInfo[],
        spacing: SpacingInfo[]
    ): void {
        // Extract fills
        if (node.fills) {
            for (const fill of node.fills) {
                if (fill.type === 'SOLID') {
                    const solidFill = fill as FigmaSolidFill;
                    const tokenResult = this.tokenResolver.resolveColor(solidFill.color);
                    colors.push({
                        hex: colorToHex(solidFill.color),
                        rgba: { ...solidFill.color, a: solidFill.opacity ?? solidFill.color.a },
                        usage: 'fill',
                        nodeName: node.name,
                        tokenMatch: tokenResult.success ? tokenResult.token.name : undefined,
                    });
                }
            }
        }

        // Extract text styles
        if (node.type === 'TEXT' && node.style && node.characters) {
            const tokenResult = this.tokenResolver.resolveTypography(node.style);
            typography.push({
                fontSize: node.style.fontSize,
                fontWeight: node.style.fontWeight,
                fontFamily: node.style.fontFamily,
                text: node.characters.substring(0, 50), // Truncate for summary
                tokenMatch: tokenResult.success ? tokenResult.token.name : undefined,
            });
        }

        // Extract spacing
        if (node.paddingTop || node.paddingRight || node.paddingBottom || node.paddingLeft) {
            spacing.push({
                type: 'padding',
                values: {
                    top: node.paddingTop,
                    right: node.paddingRight,
                    bottom: node.paddingBottom,
                    left: node.paddingLeft,
                },
                nodeName: node.name,
            });
        }

        if (node.itemSpacing && node.itemSpacing > 0) {
            const tokenResult = this.tokenResolver.resolveSpacing(node.itemSpacing);
            spacing.push({
                type: 'gap',
                values: { gap: node.itemSpacing },
                nodeName: node.name,
                tokenMatch: tokenResult.success ? tokenResult.token.name : undefined,
            });
        }

        // Recurse into children
        if (node.children) {
            for (const child of node.children) {
                this.traverseNode(child, colors, typography, spacing);
            }
        }
    }

    private matchTokens(
        colors: ColorInfo[],
        typography: TypographyInfo[],
        spacing: SpacingInfo[]
    ): ResolvedTokens {
        const colorTokens: Array<{ value: string; token: string }> = [];
        const spacingTokens: Array<{ value: number; token: string }> = [];
        const typographyTokens: Array<{ size: number; weight: number; token: string }> = [];

        // Collect matched color tokens
        for (const color of colors) {
            if (color.tokenMatch && !colorTokens.some(t => t.token === color.tokenMatch)) {
                colorTokens.push({ value: color.hex, token: color.tokenMatch });
            }
        }

        // Collect matched typography tokens
        for (const typo of typography) {
            if (typo.tokenMatch && !typographyTokens.some(t => t.token === typo.tokenMatch)) {
                typographyTokens.push({ size: typo.fontSize, weight: typo.fontWeight, token: typo.tokenMatch });
            }
        }

        // Collect matched spacing tokens
        for (const space of spacing) {
            if (space.tokenMatch && !spacingTokens.some(t => t.token === space.tokenMatch)) {
                const value = space.values.gap ?? space.values.top ?? 0;
                spacingTokens.push({ value, token: space.tokenMatch });
            }
        }

        return { colors: colorTokens, spacing: spacingTokens, typography: typographyTokens };
    }

    private deduplicateColors(colors: ColorInfo[]): ColorInfo[] {
        const seen = new Set<string>();
        return colors.filter(c => {
            const key = c.hex + c.usage;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    private deduplicateTypography(typography: TypographyInfo[]): TypographyInfo[] {
        const seen = new Set<string>();
        return typography.filter(t => {
            const key = `${t.fontSize}-${t.fontWeight}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    private deduplicateSpacing(spacing: SpacingInfo[]): SpacingInfo[] {
        const seen = new Set<string>();
        return spacing.filter(s => {
            const key = JSON.stringify(s.values);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    /**
     * Generate a suggested prompt for vision analysis
     */
    generateAnalysisPrompt(nodeName: string, metadata: VisionMetadata): string {
        const colorList = metadata.colors.slice(0, 5).map(c => c.tokenMatch ?? c.hex).join(', ');
        const typoList = metadata.typography.slice(0, 3).map(t => `${t.fontSize}pt`).join(', ');

        return `Analyze this Figma design "${nodeName}" and generate clean SwiftUI code.

Key colors: ${colorList || 'none extracted'}
Typography: ${typoList || 'none extracted'}
Size: ${metadata.boundingBox.width}x${metadata.boundingBox.height}

Generate idiomatic SwiftUI that:
1. Uses semantic containers (VStack, HStack) based on visual structure, not Figma's frame hierarchy
2. References design tokens where available
3. Avoids unnecessary nesting
4. Includes TODO comments for interactive behaviors`;
    }
}
