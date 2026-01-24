/**
 * Design Token Resolver
 * 
 * Maps raw Figma values to Design System tokens.
 * When no exact match exists, returns a failure with guidance for the agent.
 */

import {
    DesignTokenDefinitions,
    SpacingToken,
    ColorToken,
    TypographyToken,
    CornerRadiusToken,
    TokenResolutionResult,
} from './types';
import { stubTokenDefinitions } from './stub_definitions';
import { FigmaTextStyle, FigmaColor } from '../figma/types';

export class DesignTokenResolver {
    private definitions: DesignTokenDefinitions;

    // Tolerance for matching (how close a value must be to match)
    private static SPACING_TOLERANCE = 2;    // pixels
    private static COLOR_TOLERANCE = 0.05;   // 0-1 range
    private static FONT_SIZE_TOLERANCE = 1;  // points

    constructor(definitions?: DesignTokenDefinitions) {
        this.definitions = definitions ?? stubTokenDefinitions;
    }

    /**
     * Resolve a pixel spacing value to a DS spacing token
     */
    resolveSpacing(pixelValue: number): TokenResolutionResult<SpacingToken> {
        // Find exact or close match
        const match = this.findClosestSpacing(pixelValue);

        if (match && Math.abs(match.value - pixelValue) <= DesignTokenResolver.SPACING_TOLERANCE) {
            return {
                success: true,
                token: match,
                swiftUIValue: match.name,
            };
        }

        // No match - return failure with guidance
        const closest = this.getClosestSpacingMatches(pixelValue, 2);
        return {
            success: false,
            rawValue: `${pixelValue}px`,
            message: `⚠️ No DS spacing token found for ${pixelValue}px.`,
            closestMatches: closest.map(t => ({ name: t.name, value: `${t.value}px` })),
        };
    }

    /**
     * Resolve a Figma color to a DS color token
     */
    resolveColor(color: FigmaColor): TokenResolutionResult<ColorToken> {
        const match = this.definitions.colors.find(token =>
            Math.abs(token.r - color.r) <= DesignTokenResolver.COLOR_TOLERANCE &&
            Math.abs(token.g - color.g) <= DesignTokenResolver.COLOR_TOLERANCE &&
            Math.abs(token.b - color.b) <= DesignTokenResolver.COLOR_TOLERANCE
        );

        if (match) {
            return {
                success: true,
                token: match,
                swiftUIValue: match.name,
            };
        }

        // No match - return failure with hex representation
        const hex = this.colorToHex(color);
        const closest = this.getClosestColorMatches(color, 2);
        return {
            success: false,
            rawValue: hex,
            message: `⚠️ No DS color token found for ${hex}.`,
            closestMatches: closest.map(t => ({ name: t.name, value: this.colorToHex(t) })),
        };
    }

    /**
     * Resolve a Figma text style to a DS typography token
     */
    resolveTypography(style: FigmaTextStyle): TokenResolutionResult<TypographyToken> {
        // Match primarily on font size and weight
        const match = this.definitions.typography.find(token =>
            Math.abs(token.fontSize - style.fontSize) <= DesignTokenResolver.FONT_SIZE_TOLERANCE &&
            token.fontWeight === style.fontWeight
        );

        if (match) {
            return {
                success: true,
                token: match,
                swiftUIValue: `.font(${match.name})`,
            };
        }

        // No match
        const closest = this.getClosestTypographyMatches(style, 2);
        return {
            success: false,
            rawValue: `${style.fontFamily} ${style.fontWeight} ${style.fontSize}pt`,
            message: `⚠️ No DS typography token found for ${style.fontSize}pt weight ${style.fontWeight}.`,
            closestMatches: closest.map(t => ({ name: t.name, value: `${t.fontSize}pt weight ${t.fontWeight}` })),
        };
    }

    /**
     * Resolve a corner radius to a DS radius token
     */
    resolveCornerRadius(pixelValue: number): TokenResolutionResult<CornerRadiusToken> {
        const match = this.definitions.cornerRadius.find(token =>
            Math.abs(token.value - pixelValue) <= DesignTokenResolver.SPACING_TOLERANCE
        );

        if (match) {
            return {
                success: true,
                token: match,
                swiftUIValue: match.name,
            };
        }

        const closest = this.getClosestRadiusMatches(pixelValue, 2);
        return {
            success: false,
            rawValue: `${pixelValue}px`,
            message: `⚠️ No DS radius token found for ${pixelValue}px.`,
            closestMatches: closest.map(t => ({ name: t.name, value: `${t.value}px` })),
        };
    }

    // ==================== Helper Methods ====================

    private findClosestSpacing(value: number): SpacingToken | undefined {
        let closest: SpacingToken | undefined;
        let closestDiff = Infinity;

        for (const token of this.definitions.spacing) {
            const diff = Math.abs(token.value - value);
            if (diff < closestDiff) {
                closestDiff = diff;
                closest = token;
            }
        }
        return closest;
    }

    private getClosestSpacingMatches(value: number, count: number): SpacingToken[] {
        return [...this.definitions.spacing]
            .sort((a, b) => Math.abs(a.value - value) - Math.abs(b.value - value))
            .slice(0, count);
    }

    private getClosestColorMatches(color: FigmaColor, count: number): ColorToken[] {
        return [...this.definitions.colors]
            .sort((a, b) => {
                const distA = Math.sqrt(
                    Math.pow(a.r - color.r, 2) +
                    Math.pow(a.g - color.g, 2) +
                    Math.pow(a.b - color.b, 2)
                );
                const distB = Math.sqrt(
                    Math.pow(b.r - color.r, 2) +
                    Math.pow(b.g - color.g, 2) +
                    Math.pow(b.b - color.b, 2)
                );
                return distA - distB;
            })
            .slice(0, count);
    }

    private getClosestTypographyMatches(style: FigmaTextStyle, count: number): TypographyToken[] {
        return [...this.definitions.typography]
            .sort((a, b) => {
                const diffA = Math.abs(a.fontSize - style.fontSize) + Math.abs(a.fontWeight - style.fontWeight) / 100;
                const diffB = Math.abs(b.fontSize - style.fontSize) + Math.abs(b.fontWeight - style.fontWeight) / 100;
                return diffA - diffB;
            })
            .slice(0, count);
    }

    private getClosestRadiusMatches(value: number, count: number): CornerRadiusToken[] {
        return [...this.definitions.cornerRadius]
            .filter(t => t.value < 9999)  // Exclude "full" for suggestions
            .sort((a, b) => Math.abs(a.value - value) - Math.abs(b.value - value))
            .slice(0, count);
    }

    private colorToHex(color: FigmaColor | ColorToken): string {
        const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0');
        return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
    }
}
