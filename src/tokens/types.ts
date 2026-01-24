// Design Token Types
// These define the structure of your design system tokens

export interface SpacingToken {
    name: string;          // e.g., "DSSpacing.small"
    value: number;         // pixel value
}

export interface ColorToken {
    name: string;          // e.g., "DSColor.primary"
    r: number;             // 0-1
    g: number;             // 0-1
    b: number;             // 0-1
    a?: number;            // 0-1, defaults to 1
}

export interface TypographyToken {
    name: string;          // e.g., "DSTypography.headline"
    fontFamily: string;
    fontWeight: number;    // 100-900
    fontSize: number;      // in points
    lineHeight?: number;
    letterSpacing?: number;
}

export interface CornerRadiusToken {
    name: string;          // e.g., "DSRadius.medium"
    value: number;
}

export interface DesignTokenDefinitions {
    spacing: SpacingToken[];
    colors: ColorToken[];
    typography: TypographyToken[];
    cornerRadius: CornerRadiusToken[];
}

// Result types for token resolution
export type TokenResolutionSuccess<T> = {
    success: true;
    token: T;
    swiftUIValue: string;  // The actual code to emit
};

export type TokenResolutionFailure = {
    success: false;
    rawValue: string;
    message: string;       // Guidance for the agent
    closestMatches?: Array<{ name: string; value: string }>;
};

export type TokenResolutionResult<T> = TokenResolutionSuccess<T> | TokenResolutionFailure;
