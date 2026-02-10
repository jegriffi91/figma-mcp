
import { FigmaNode, FigmaColor, FigmaSolidFill, FigmaGradientFill } from "../figma/types";

export interface PrunedFigmaNode {
    id: string;
    name: string;
    type: string;
    children?: PrunedFigmaNode[];
    characters?: string; // For TEXT
    fills?: string[]; // Hex codes only
    strokes?: string[]; // Hex codes only
    absoluteBoundingBox?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    componentId?: string;
    // Computed style hints for "Metadata" tool
    style?: {
        fontFamily?: string;
        fontSize?: number;
        fontWeight?: number;
        cornerRadius?: number;
        layoutMode?: string; // AUTO_LAYOUT hint
    }
}

/**
 * Converts Figma color (0-1 RGBA) to hex string
 */
function colorToHex(color: FigmaColor): string {
    const r = Math.round(color.r * 255);
    const g = Math.round(color.g * 255);
    const b = Math.round(color.b * 255);
    // Optional: Handle alpha if needed, but hex is usually sufficient for "vibe"
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function extractColors(fills: any[] | undefined): string[] {
    if (!fills) return [];
    const colors: string[] = [];
    for (const fill of fills) {
        if (fill.type === 'SOLID' && fill.visible !== false) {
            const f = fill as FigmaSolidFill;
            colors.push(colorToHex(f.color));
        } else if (fill.type.startsWith('GRADIENT') && fill.visible !== false) {
            // Simplified gradient representation
            const f = fill as FigmaGradientFill;
            if (f.gradientStops && f.gradientStops.length > 0) {
                colors.push(`Gradient(${colorToHex(f.gradientStops[0].color)} -> ${colorToHex(f.gradientStops[f.gradientStops.length - 1].color)})`);
            }
        }
    }
    return colors;
}

/**
 * Prunes a massive Figma node tree into a lightweight schema for LLM context.
 */
export function pruneNodeData(node: FigmaNode, depth: number = 0): PrunedFigmaNode {
    const pruned: PrunedFigmaNode = {
        id: node.id,
        name: node.name,
        type: node.type,
        // coordinates are useful but maybe round them to integers to save bytes?
        absoluteBoundingBox: node.absoluteBoundingBox ? {
            x: Math.round(node.absoluteBoundingBox.x),
            y: Math.round(node.absoluteBoundingBox.y),
            width: Math.round(node.absoluteBoundingBox.width),
            height: Math.round(node.absoluteBoundingBox.height),
        } : undefined,
    };

    // 1. Text Content
    if (node.characters) {
        pruned.characters = node.characters;
    }

    // 2. Extracts Fills/Strokes as Hex Codes
    const fillColors = extractColors(node.fills);
    if (fillColors.length > 0) pruned.fills = fillColors;

    const strokeColors = extractColors(node.strokes);
    if (strokeColors.length > 0) pruned.strokes = strokeColors;

    // 3. Key Style Metadata (for logical inspection)
    // This helps the LLM know "This is a button" or "This is a headline" without seeing pixels
    if (node.style || node.cornerRadius || node.layoutMode) {
        pruned.style = {};
        if (node.style) {
            pruned.style.fontFamily = node.style.fontFamily;
            pruned.style.fontSize = node.style.fontSize;
            pruned.style.fontWeight = node.style.fontWeight;
        }
        if (node.cornerRadius) {
            pruned.style.cornerRadius = node.cornerRadius;
        }
        if (node.layoutMode && node.layoutMode !== 'NONE') {
            pruned.style.layoutMode = node.layoutMode;
        }
    }

    if (node.componentId) {
        pruned.componentId = node.componentId;
    }

    // 4. Recursion with Depth Limit and Visibility Check
    // Stop at depth 4 to prevent massive trees (usually sufficient for "vibe" check)
    // Also filter out invisible children
    if (depth < 4 && node.children) {
        const visibleChildren = node.children.filter(c => c.visible !== false);
        if (visibleChildren.length > 0) {
            pruned.children = visibleChildren.map(child => pruneNodeData(child, depth + 1));
        }
    }

    return pruned;
}
