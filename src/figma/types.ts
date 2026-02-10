// Figma Layout Modes
export type FigmaLayoutMode = 'NONE' | 'HORIZONTAL' | 'VERTICAL';

// Figma Alignment
export type FigmaAlignItems =
    | 'MIN'           // Start (leading)
    | 'CENTER'        // Center
    | 'MAX'           // End (trailing)
    | 'BASELINE'      // Text baseline (for horizontal layouts)
    | 'STRETCH'       // Stretch to fill
    | 'SPACE_BETWEEN'; // Distribute with space between

// Figma Color (0-1 RGBA)
export interface FigmaColor {
    r: number;
    g: number;
    b: number;
    a: number;
}

// Figma Fill
export interface FigmaSolidFill {
    type: 'SOLID';
    color: FigmaColor;
    opacity?: number;
}

export interface FigmaGradientFill {
    type: 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'GRADIENT_ANGULAR' | 'GRADIENT_DIAMOND';
    gradientStops: Array<{ color: FigmaColor; position: number }>;
}

export type FigmaFill = FigmaSolidFill | FigmaGradientFill | { type: string };

// Figma Text Style
export interface FigmaTextStyle {
    fontFamily: string;
    fontWeight: number;      // 100-900
    fontSize: number;        // in pixels
    lineHeightPx?: number;
    letterSpacing?: number;
    textAlignHorizontal?: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
    textAlignVertical?: 'TOP' | 'CENTER' | 'BOTTOM';
    textCase?: 'ORIGINAL' | 'UPPER' | 'LOWER' | 'TITLE';
}

// Figma Effect (shadows, blurs)
export interface FigmaShadowEffect {
    type: 'DROP_SHADOW' | 'INNER_SHADOW';
    color: FigmaColor;
    offset: { x: number; y: number };
    radius: number;
    spread?: number;
    visible: boolean;
}

export interface FigmaBlurEffect {
    type: 'LAYER_BLUR' | 'BACKGROUND_BLUR';
    radius: number;
    visible: boolean;
}

export type FigmaEffect = FigmaShadowEffect | FigmaBlurEffect;

// Layout Sizing (child behavior in Auto Layout)
export type FigmaLayoutSizing = 'HUG' | 'FILL' | 'FIXED';

// Variable Alias (token reference from Figma Variables)
export interface FigmaVariableAlias {
    type: 'VARIABLE_ALIAS';
    id: string;  // e.g., "VariableID:54778:426"
}

// Component Property (for INSTANCE nodes with variants)
export interface FigmaComponentProperty {
    type: 'VARIANT' | 'BOOLEAN' | 'INSTANCE_SWAP' | 'TEXT';
    value: string | boolean;
    preferredValues?: string[];
    boundVariables?: Record<string, unknown>;
}

// Bound Variables on fills (for token resolution)
export interface FigmaSolidFillWithBinding extends FigmaSolidFill {
    boundVariables?: {
        color?: FigmaVariableAlias;
    };
}

// Main FigmaNode interface
export interface FigmaNode {
    id: string;
    name: string;
    type: 'FRAME' | 'TEXT' | 'COMPONENT' | 'INSTANCE' | 'RECTANGLE' | 'GROUP' | 'VECTOR' | 'ELLIPSE' | 'LINE' | string;

    // Children
    children?: FigmaNode[];

    // Text content (for TEXT nodes)
    characters?: string;
    style?: FigmaTextStyle;

    // Component info (for INSTANCE nodes)
    componentId?: string;           // ID of the main component
    componentName?: string;         // Name of the main component

    // Visibility
    visible?: boolean;

    // Layout properties (Auto Layout)
    layoutMode?: FigmaLayoutMode;
    primaryAxisSizingMode?: 'FIXED' | 'AUTO';
    counterAxisSizingMode?: 'FIXED' | 'AUTO';
    primaryAxisAlignItems?: FigmaAlignItems;
    counterAxisAlignItems?: FigmaAlignItems;
    itemSpacing?: number;           // Gap between children

    // Padding
    paddingTop?: number;
    paddingRight?: number;
    paddingBottom?: number;
    paddingLeft?: number;

    // Appearance
    fills?: FigmaFill[];
    strokes?: FigmaFill[];
    strokeWeight?: number;
    cornerRadius?: number;
    opacity?: number;
    effects?: FigmaEffect[];

    // Constraints (for fixed layouts)
    constraints?: {
        horizontal: 'LEFT' | 'RIGHT' | 'CENTER' | 'LEFT_RIGHT' | 'SCALE';
        vertical: 'TOP' | 'BOTTOM' | 'CENTER' | 'TOP_BOTTOM' | 'SCALE';
    };

    // Bounds
    absoluteBoundingBox?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };

    // Layout Sizing (child behavior in Auto Layout) - P0
    layoutSizingHorizontal?: FigmaLayoutSizing;
    layoutSizingVertical?: FigmaLayoutSizing;
    layoutPositioning?: 'AUTO' | 'ABSOLUTE';
    layoutAlign?: 'INHERIT' | 'STRETCH';
    layoutGrow?: number;

    // Clipping - P1
    clipsContent?: boolean;

    // Bound Variables (token references) - P1
    boundVariables?: {
        fills?: FigmaVariableAlias[];
        strokes?: FigmaVariableAlias[];
    };

    // Component Properties (for INSTANCE nodes) - P2
    componentProperties?: Record<string, FigmaComponentProperty>;
}

export interface FigmaComponentMetadata {
    key: string;
    name: string;
    description: string;
    remote?: boolean;
    componentSetId?: string;
    documentationLinks?: unknown[];
}

export interface FigmaComponentSetMetadata {
    key: string;
    name: string;
    description: string;
    remote?: boolean;
    documentationLinks?: unknown[];
}

export interface FigmaNodeData {
    document: FigmaNode;
    components: Record<string, FigmaComponentMetadata>;
    componentSets: Record<string, FigmaComponentSetMetadata>;
}

export interface ImageExportResult {
    imageUrl: string;
    base64Data: string;
    width: number;
    height: number;
}

export interface FigmaDataSource {
    getNode(fileKey: string, nodeId: string): Promise<FigmaNodeData>;
    getNodeImage?(fileKey: string, nodeId: string, scale?: number): Promise<ImageExportResult>;
}

export interface FigmaApiResponse {
    nodes: {
        [key: string]: {
            document: FigmaNode;
            components?: Record<string, FigmaComponentMetadata>;
            componentSets?: Record<string, FigmaComponentSetMetadata>;
        };
    };
}
