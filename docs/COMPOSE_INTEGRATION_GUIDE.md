# Compose Integration Guide

Configure the Figma MCP server to generate Jetpack Compose code for your Android design system.

## Quick Start

1. **Set Environment Variables**:
   ```bash
   FIGMA_ACCESS_TOKEN=your_figma_token
   DESIGN_SYSTEM_ROOT_COMPOSE=/path/to/your/compose-config
   ```

2. **Create Configuration Files**:
   ```bash
   mkdir -p ~/my-compose-config
   ```

---

## Configuration Files

### `tokens.json`

Define design tokens with Kotlin-style naming:

```json
{
  "colors": [
    { "name": "AppColors.Primary", "r": 0.0, "g": 0.478, "b": 1.0 },
    { "name": "MaterialTheme.colorScheme.primary", "r": 0.0, "g": 0.478, "b": 1.0 }
  ],
  "spacing": [
    { "name": "AppDimens.small", "value": 8 },
    { "name": "AppDimens.medium", "value": 16 }
  ],
  "typography": [
    { "name": "AppTypography.titleLarge", "fontFamily": "Roboto", "fontWeight": 700, "fontSize": 28 }
  ],
  "cornerRadius": [
    { "name": "AppShapes.medium", "value": 8 }
  ]
}
```

### `components.json`

Map Figma components to Composable functions:

```json
{
  "handoffMode": true,
  "components": [
    {
      "figmaKey": "abc123xyz",
      "composeComposable": "AppButton",
      "kotlinSourceFile": "ui/components/AppButton.kt",
      "params": {
        "Label": "text",
        "Variant": "variant"
      }
    }
  ]
}
```

| Field | Description |
|-------|-------------|
| `figmaKey` | Stable Figma component key |
| `composeComposable` | The `@Composable` function name |
| `kotlinSourceFile` | Reference path to source (for handoff) |
| `params` | Maps Figma properties → Compose parameters |

---

## MCP Client Configuration

**Example** (`~/.copilot/mcp-config.json`):

```json
{
  "mcpServers": {
    "figma-mcp": {
      "command": "node",
      "args": ["/path/to/figma-mcp/dist/index.js"],
      "env": {
        "FIGMA_ACCESS_TOKEN": "your_token",
        "DESIGN_SYSTEM_ROOT_COMPOSE": "/path/to/compose-config"
      }
    }
  }
}
```

---

## Available Tools

| Tool | Description |
|------|-------------|
| `figma_to_compose` | Translates Figma node to Jetpack Compose code |

### Example Usage

> "Translate Figma node '12:345' from file 'XYZ' to Compose"

### Output Example

```kotlin
Column(
    verticalArrangement = Arrangement.spacedBy(16.dp),
    modifier = Modifier
        .fillMaxWidth()
        .padding(16.dp)
) {
    Text(
        text = "Welcome",
        style = AppTypography.titleLarge,
        color = AppColors.Primary
    )
    AppButton(
        text = "Continue",
        variant = Primary
    )
    // TODO: Add onClick handler
}
```

---

## Figma → Compose Mapping

| Figma Layout | Compose |
|--------------|---------|
| `HORIZONTAL` | `Row` |
| `VERTICAL` | `Column` |
| `NONE` (absolute) | `Box` |

| SwiftUI Modifier | Compose Equivalent |
|------------------|-------------------|
| `.padding(...)` | `Modifier.padding(...)` |
| `.background(...)` | `Modifier.background(...)` |
| `.frame(maxWidth: .infinity)` | `Modifier.fillMaxWidth()` |
| `.cornerRadius(...)` | `Modifier.clip(RoundedCornerShape(...))` |
