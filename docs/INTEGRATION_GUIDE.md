# Integration Guide

This guide explains how to integrate your Design System with the Figma MCP server.

## Prerequisites

1. **Build the Project**:
   ```bash
   npm run build
   ```

2. **Set Environment Variables** (in `.env` or your MCP config):
   ```bash
   FIGMA_ACCESS_TOKEN=your_figma_token
   DESIGN_SYSTEM_ROOT=/path/to/your/config
   ```

---

## Step 1: Create Your Configuration Directory

Create a directory where your design system configuration will live:

```bash
mkdir -p ~/my-design-system-config
```

This path will be your `DESIGN_SYSTEM_ROOT`.

---

## Step 2: Create `tokens.json`

This file defines your design tokens (colors, spacing, typography, corner radius).

**File:** `~/my-design-system-config/tokens.json`

```json
{
  "colors": [
    { "name": "Color.primary", "r": 0.0, "g": 0.478, "b": 1.0 },
    { "name": "Color.secondary", "r": 0.345, "g": 0.337, "b": 0.839 },
    { "name": "Color.background", "r": 1.0, "g": 1.0, "b": 1.0 },
    { "name": "Color.textPrimary", "r": 0.0, "g": 0.0, "b": 0.0 }
  ],
  "spacing": [
    { "name": "Spacing.none", "value": 0 },
    { "name": "Spacing.xs", "value": 4 },
    { "name": "Spacing.small", "value": 8 },
    { "name": "Spacing.medium", "value": 16 },
    { "name": "Spacing.large", "value": 24 }
  ],
  "typography": [
    { "name": "Font.title", "fontFamily": "SF Pro Display", "fontWeight": 700, "fontSize": 28 },
    { "name": "Font.body", "fontFamily": "SF Pro Text", "fontWeight": 400, "fontSize": 17 }
  ],
  "cornerRadius": [
    { "name": "Radius.small", "value": 4 },
    { "name": "Radius.medium", "value": 8 },
    { "name": "Radius.large", "value": 16 }
  ]
}
```

### How to Get Token Values

| Field | Where to Find It |
|-------|------------------|
| `name` | The exact Swift property name you use in code (e.g., `Color.primary`) |
| `r`, `g`, `b` | RGB values from 0.0 to 1.0. Divide hex by 255 (e.g., `#007AFF` → `r: 0, g: 0.478, b: 1`) |
| `value` (spacing/radius) | Pixel/point value from Figma or your Swift constants |
| `fontWeight` | 400 = Regular, 500 = Medium, 600 = Semibold, 700 = Bold |

---

## Step 3: Create `components.json`

This file maps Figma components to SwiftUI Views.

**File:** `~/my-design-system-config/components.json`

```json
{
  "components": [
    {
      "figmaId": "12345:67890",
      "figmaFileKey": "ABC123XYZ",
      "swiftView": "DSButton",
      "sourceFile": "Sources/DesignSystem/Button/DSButton.swift",
      "params": {
        "Label": "title",
        "Variant": "style"
      }
    },
    {
      "figmaId": "12345:67891",
      "figmaFileKey": "ABC123XYZ",
      "swiftView": "DSCard",
      "sourceFile": "Sources/DesignSystem/Card/DSCard.swift",
      "params": {
        "Elevation": "elevation"
      }
    }
  ]
}
```

### Field Reference

| Field | Description | Example |
|-------|-------------|---------|
| `figmaId` | The Figma Component ID or Instance name | `"12345:67890"` or `"DSButton"` |
| `figmaFileKey` | Figma file key (optional, for reference/automation) | `"ABC123XYZ"` |
| `swiftView` | Your SwiftUI View struct name | `"DSButton"` |
| `sourceFile` | Path to Swift source file (for reference) | `"Sources/.../DSButton.swift"` |
| `params` | Maps Figma property → Swift parameter | `{ "Label": "title" }` |

### How to Find Your Figma Component ID

1. **In Figma**: Right-click on a component instance → **Copy link**
2. **In the URL**: Find the `node-id` parameter
   ```
   https://figma.com/file/ABC123?node-id=12345:67890
                                           ↑↑↑↑↑↑↑↑↑↑↑
   ```
3. Use `12345:67890` as your `figmaId`

**Alternative**: Use the component name (less reliable but works for development):
```json
{ "figmaId": "DSButton", "swiftView": "DSButton", ... }
```

### How to Map Parameters

1. **In Figma**: Select the component instance and look at the right panel
2. **Find Component Properties**: These are labeled like `Label`, `Variant`, `Disabled`, etc.
3. **Map to Swift params**: Match them to your SwiftUI initializer parameters

**Example Figma Properties → Swift Mapping:**

| Figma Property | Swift Parameter | JSON |
|----------------|-----------------|------|
| `Label` (TEXT) | `title: String` | `"Label": "title"` |
| `Variant` (VARIANT) | `style: DSButtonStyle` | `"Variant": "style"` |
| `Disabled` (BOOLEAN) | `isDisabled: Bool` | `"Disabled": "isDisabled"` |

---

## Step 4: Configure the MCP Server

Update your MCP configuration to point to your config directory.

**File:** `~/.copilot/mcp-config.json`

```json
{
  "mcpServers": {
    "figma-mcp": {
      "command": "node",
      "args": ["/path/to/figma-mcp/dist/index.js"],
      "env": {
        "FIGMA_ACCESS_TOKEN": "your_token_here",
        "DESIGN_SYSTEM_ROOT": "/Users/you/my-design-system-config"
      }
    }
  }
}
```

---

## Step 5: Verify Configuration

1. **Restart your IDE** (or reload the Copilot extension)
2. **Test with a Figma node**:
   > "Translate Figma node '12345:67890' from file 'ABC123XYZ' into SwiftUI."

3. **Check logs** for confirmation:
   ```
   [Init] Loading Design System from: /Users/you/my-design-system-config
   [Init] Registering 2 configurable components
   ```

---

## Example: Full Walkthrough

Let's say your Design System has:
- A `DSButton` component in Figma with ID `55:1234`
- A `DSCard` component in Figma with ID `55:1235`

### 1. Create the config files

**tokens.json:**
```json
{
  "colors": [
    { "name": "AppColor.brand", "r": 0.2, "g": 0.4, "b": 0.8 }
  ],
  "spacing": [
    { "name": "AppSpacing.standard", "value": 16 }
  ],
  "typography": [],
  "cornerRadius": []
}
```

**components.json:**
```json
{
  "components": [
    {
      "figmaId": "55:1234",
      "swiftView": "DSButton",
      "sourceFile": "DesignSystem/DSButton.swift",
      "params": {
        "Label": "title",
        "Style": "style"
      }
    },
    {
      "figmaId": "55:1235",
      "swiftView": "DSCard",
      "sourceFile": "DesignSystem/DSCard.swift",
      "params": {}
    }
  ]
}
```

### 2. Set environment variable

```bash
export DESIGN_SYSTEM_ROOT=/Users/me/my-design-system-config
```

### 3. Run the MCP server

```bash
npm run build && node dist/index.js
```

### 4. Expected output for node `55:1234`

If the Figma node has properties `Label: "Submit"` and `Style: "Primary"`:

```swift
DSButton(title: "Submit", style: .primary)
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "No translator found" | Component not in `components.json`. Add it or rely on generic fallback. |
| Wrong parameter values | Check that Figma property names match the `params` keys exactly (case-sensitive). |
| Empty output | Verify `DESIGN_SYSTEM_ROOT` path is correct and files are valid JSON. |
| Build errors | Run `npm run build` and check for TypeScript errors. |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      DESIGN_SYSTEM_ROOT                         │
├─────────────────────────────────────────────────────────────────┤
│  tokens.json          →  DesignTokenResolver                    │
│  components.json      →  ConfigurableComponentTranslator        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     TranslatorRegistry                          │
├─────────────────────────────────────────────────────────────────┤
│  1. ConfigurableComponentTranslator (from JSON)                 │
│  2. TextTranslator (generic TEXT nodes)                         │
│  3. FrameTranslator (generic layout fallback)                   │
└─────────────────────────────────────────────────────────────────┘
```

All component mappings come from `components.json`. No code changes needed.
