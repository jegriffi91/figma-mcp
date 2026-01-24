/**
 * Stub Design Token Definitions
 * 
 * Replace these with your actual design system values.
 * These are loaded from DESIGN_SYSTEM_ROOT in production.
 */

import { DesignTokenDefinitions } from './types';

export const stubTokenDefinitions: DesignTokenDefinitions = {
    spacing: [
        { name: 'DSSpacing.none', value: 0 },
        { name: 'DSSpacing.xxs', value: 2 },
        { name: 'DSSpacing.xs', value: 4 },
        { name: 'DSSpacing.small', value: 8 },
        { name: 'DSSpacing.medium', value: 16 },
        { name: 'DSSpacing.large', value: 24 },
        { name: 'DSSpacing.xl', value: 32 },
        { name: 'DSSpacing.xxl', value: 48 },
    ],

    colors: [
        { name: 'DSColor.primary', r: 0, g: 0.478, b: 1 },           // Blue
        { name: 'DSColor.secondary', r: 0.345, g: 0.337, b: 0.839 }, // Purple
        { name: 'DSColor.success', r: 0.204, g: 0.78, b: 0.349 },    // Green
        { name: 'DSColor.warning', r: 1, g: 0.8, b: 0 },             // Yellow
        { name: 'DSColor.error', r: 1, g: 0.231, b: 0.188 },         // Red
        { name: 'DSColor.background', r: 1, g: 1, b: 1 },            // White
        { name: 'DSColor.backgroundSecondary', r: 0.95, g: 0.95, b: 0.97 },
        { name: 'DSColor.textPrimary', r: 0, g: 0, b: 0 },           // Black
        { name: 'DSColor.textSecondary', r: 0.5, g: 0.5, b: 0.5 },   // Gray
    ],

    typography: [
        { name: 'DSTypography.largeTitle', fontFamily: 'SF Pro Display', fontWeight: 700, fontSize: 34 },
        { name: 'DSTypography.title1', fontFamily: 'SF Pro Display', fontWeight: 700, fontSize: 28 },
        { name: 'DSTypography.title2', fontFamily: 'SF Pro Display', fontWeight: 700, fontSize: 22 },
        { name: 'DSTypography.title3', fontFamily: 'SF Pro Display', fontWeight: 600, fontSize: 20 },
        { name: 'DSTypography.headline', fontFamily: 'SF Pro Text', fontWeight: 600, fontSize: 17 },
        { name: 'DSTypography.body', fontFamily: 'SF Pro Text', fontWeight: 400, fontSize: 17 },
        { name: 'DSTypography.callout', fontFamily: 'SF Pro Text', fontWeight: 400, fontSize: 16 },
        { name: 'DSTypography.subheadline', fontFamily: 'SF Pro Text', fontWeight: 400, fontSize: 15 },
        { name: 'DSTypography.footnote', fontFamily: 'SF Pro Text', fontWeight: 400, fontSize: 13 },
        { name: 'DSTypography.caption1', fontFamily: 'SF Pro Text', fontWeight: 400, fontSize: 12 },
        { name: 'DSTypography.caption2', fontFamily: 'SF Pro Text', fontWeight: 400, fontSize: 11 },
    ],

    cornerRadius: [
        { name: 'DSRadius.none', value: 0 },
        { name: 'DSRadius.small', value: 4 },
        { name: 'DSRadius.medium', value: 8 },
        { name: 'DSRadius.large', value: 12 },
        { name: 'DSRadius.xl', value: 16 },
        { name: 'DSRadius.full', value: 9999 },  // Fully rounded
    ],
};
