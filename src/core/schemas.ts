import { z } from 'zod';

/**
 * Token Schema Definitions
 * These define the structure of tokens.json
 */

export const ColorTokenSchema = z.object({
    name: z.string().describe("The swift usage name, e.g. 'Color.primary'"),
    hex: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().describe("Fallback hex value for matching"),
    r: z.number().min(0).max(1),
    g: z.number().min(0).max(1),
    b: z.number().min(0).max(1),
    a: z.number().min(0).max(1).optional(),
});

export const SpacingTokenSchema = z.object({
    name: z.string().describe("e.g. 'Spacing.small'"),
    value: z.number().describe("Value in pixels/points"),
});

export const TypographyTokenSchema = z.object({
    name: z.string().describe("e.g. 'Font.title'"),
    fontFamily: z.string(),
    fontWeight: z.number(),
    fontSize: z.number(),
    lineHeight: z.number().optional(),
});

export const CornerRadiusTokenSchema = z.object({
    name: z.string(),
    value: z.number(),
});

export const TokenConfigurationSchema = z.object({
    colors: z.array(ColorTokenSchema).default([]),
    spacing: z.array(SpacingTokenSchema).default([]),
    typography: z.array(TypographyTokenSchema).default([]),
    cornerRadius: z.array(CornerRadiusTokenSchema).default([]),
});

/**
 * Component Schema Definitions
 * These define the structure of components.json
 * 
 * Streamlined: Just reference the Swift View name and map params.
 * The translator generates `SwiftViewName(param1: value1, param2: value2)`.
 */

export const ComponentDefinitionSchema = z.object({
    figmaId: z.string().describe("Figma Component ID or name pattern"),
    figmaFileKey: z.string().optional().describe("Figma file key where this component lives (for reference/automation)"),
    swiftView: z.string().describe("The SwiftUI View struct name, e.g. 'DSButton'"),
    sourceFile: z.string().optional().describe("Path to the Swift source file for reference"),
    params: z.record(
        z.string(), // Figma Prop Name (e.g. 'Label')
        z.string()  // Swift param name (e.g. 'title')
    ).optional().describe("Maps Figma property names to Swift parameter names"),
});


export const ComponentConfigurationSchema = z.object({
    components: z.array(ComponentDefinitionSchema).default([]),
});


// TypeScript Types derived from Zod
export type ColorToken = z.infer<typeof ColorTokenSchema>;
export type SpacingToken = z.infer<typeof SpacingTokenSchema>;
export type TypographyToken = z.infer<typeof TypographyTokenSchema>;
export type CornerRadiusToken = z.infer<typeof CornerRadiusTokenSchema>;
export type TokenConfiguration = z.infer<typeof TokenConfigurationSchema>;
export type ComponentDefinition = z.infer<typeof ComponentDefinitionSchema>;
export type ComponentConfiguration = z.infer<typeof ComponentConfigurationSchema>;

// Alias for backward compatibility
export type DesignTokenDefinitions = TokenConfiguration;

// Result types for token resolution
export type TokenResolutionSuccess<T> = {
    success: true;
    token: T;
    swiftUIValue: string;
};

export type TokenResolutionFailure = {
    success: false;
    rawValue: string;
    message: string;
    closestMatches?: Array<{ name: string; value: string }>;
};

export type TokenResolutionResult<T> = TokenResolutionSuccess<T> | TokenResolutionFailure;
