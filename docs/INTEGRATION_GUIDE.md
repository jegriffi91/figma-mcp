# GitHub Copilot Integration Guide

This guide explains how to connect this Figma MCP server to various GitHub Copilot clients, including **VS Code**, **Copilot CLI**, and **GitHub for Xcode**.

## 1. Prerequisites

1.  **Build the Project**: Ensure the project is compiled to JavaScript.
    ```bash
    npm run build
    ```
2.  **Verify Path**: Standardize on absolute paths for configuration.
    ```bash
    # Run this to get the path to use in configs
    echo "$(pwd)/dist/index.js"
    ```

## 2. Configuration for VS Code & Copilot CLI

Both the **VS Code Chat extension** and the **GitHub Copilot CLI** share the same configuration file location.

1.  **File Location**: `~/.copilot/mcp-config.json` (Create it if it doesn't exist).
2.  **Add Entry**: Insert the configuration for `figma-mcp`:

```json
{
  "mcpServers": {
    "figma-mcp": {
      "command": "node",
      "args": ["/Users/YOUR_USER/path/to/figma-mcp/dist/index.js"],
      "env": {
        "FIGMA_ACCESS_TOKEN": "your_figma_token_here",
        "USE_MOCK_FIGMA": "false",
        "DESIGN_SYSTEM_ROOT": "../../Modules/DesignSystem"
      }
    }
  }
}
```

> [!NOTE]
> For the **CLI**, you can also add this interactively using the `/mcp add` command if your version supports it, though manual editing is more reliable for passing multiple environment variables like `DESIGN_SYSTEM_ROOT`.

## 3. Configuration for GitHub for Xcode

If you are using the **GitHub for Xcode** extension (or the Copilot for Xcode application):

1.  **Open Settings**: Navigate to the extension settings/companion app.
2.  **MCP Settings**: Look for the **MCP Servers** or **External Tools** section.
3.  **Local Server Setup**:
    -   Some versions allow adding a "Local" or "Stdio" server by providing the `node` command and arguments.
    -   If the UI only supports **HTTP** servers: You may need to run this server through an MCP-over-HTTP proxy (like `mcp-proxy`) since this server is built for Stdio by default.
4.  **Environment Variables**: Ensure you provide `FIGMA_ACCESS_TOKEN` and `USE_MOCK_FIGMA` in the client's "Environment Variables" section.

## 4. Usage in Copilot Chat / CLI


> [!TIP]
> To find your absolute path, run `pwd` in the project root and append `/dist/index.js`.

## 3. Usage in Copilot

Once configured:
1.  **Restart VS Code** (or reload the window).
2.  In Copilot Chat, you can now ask questions type `@mcp` (or simply ask about Figma nodes if your client supports auto-tool usage).
3.  **Example Command**:
    > "Translate Figma node '1:2' from file 'ABC123XYZ' into SwiftUI."

## 4. Troubleshooting

-   **Logs**: The server logs errors to `stderr`, which Copilot captures. Check the Copilot extension logs in your IDE (Output > GitHub Copilot) for any "[MCP Error]" messages.
-   **Mock Mode**: If you are hitting Figma API limits, set `"USE_MOCK_FIGMA": "true"` in the `mcp-config.json` entry to use the local sample data.
-   **Path Issues**: Ensure the `command` is mapped to a valid `node` executable and the `args` path is correct.

---

## 5. Translator Registry Architecture

The server uses a **Registry + Strategy pattern** to translate Figma nodes to SwiftUI. Understanding this flow is essential for adding your own Design System components.

### How Translation Works

```
┌─────────────────────────────────────────────────────────────────────┐
│                         TranslatorRegistry                          │
├─────────────────────────────────────────────────────────────────────┤
│  Translators (checked in order):                                    │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ 1. StubButtonTranslator  →  canHandle(node)?  →  ✓ translate() ││
│  │ 2. TextTranslator        →  canHandle(node)?  →  ✓ translate() ││
│  │ 3. FrameTranslator       →  canHandle(node)?  →  ✓ translate() ││
│  │ 4. (fallback)            →  always matches                      ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

**Flow for each node:**

1. The registry iterates through registered translators **in order**
2. Each translator's `canHandle(node)` is called
3. The **first translator that returns `true`** handles the node
4. That translator's `translate(node, context)` generates SwiftUI code
5. If no translator matches, the **fallback** is used

### Registration Order Matters

Translators are checked in registration order. **Specific component translators must be registered before generic ones:**

```typescript
// In src/index.ts → initializeRegistry()

// ✅ CORRECT ORDER
registry.register(new StubButtonTranslator());   // Specific DS component
registry.register(new TextTranslator());         // TEXT nodes
registry.register(new FrameTranslator());        // FRAME/GROUP/etc.
registry.setFallback(new FrameTranslator());     // Catch-all

// ❌ WRONG ORDER - FrameTranslator would match INSTANCE nodes first!
registry.register(new FrameTranslator());
registry.register(new StubButtonTranslator());   // Never reached for INSTANCE
```

### Do You Need a Translator for Every Component?

**No.** The system is designed with graceful fallback:

| Node Type | Has Specific Translator? | Result |
|-----------|--------------------------|--------|
| DS Button (INSTANCE) | ✅ Yes | `DSButton(title: "...", style: .primary)` |
| DS Card (INSTANCE) | ❌ No | Falls back to `FrameTranslator` → `VStack { ... }` |
| Unknown FRAME | ❌ No | Falls back to `FrameTranslator` → `VStack { ... }` |
| TEXT | ✅ Yes | `Text("...").font(...)` |

**The fallback produces valid SwiftUI**, just not DS-specific code. You only need to add translators for components where you want **specific DS API calls** (e.g., `DSButton`, `DSCard`, `DSAvatar`).

### Adding a Custom DS Component Translator

**Example: Adding a Card translator for your company's `DSCard` component.**

1. **Create the translator file:**

```typescript
// src/translator/swiftui/ds_card.ts
import { ComponentTranslator, TranslationContext } from '../core/types';
import { FigmaNode } from '../../figma/types';

export class DSCardTranslator implements ComponentTranslator {
    // Known component IDs from your Figma library
    private readonly CARD_COMPONENT_IDS = [
        '12345:67890',  // Card / Default variant
        '12345:67891',  // Card / Elevated variant
    ];

    canHandle(node: FigmaNode): boolean {
        // Match by componentId (most reliable)
        if (node.type === 'INSTANCE' && node.componentId) {
            return this.CARD_COMPONENT_IDS.includes(node.componentId);
        }
        return false;
    }

    translate(node: FigmaNode, context: TranslationContext): string {
        const indent = '    '.repeat(context.indentionLevel);
        
        // Determine variant from componentProperties
        const elevation = node.componentProperties?.['Elevation'];
        const style = elevation?.value === 'Elevated' ? '.elevated' : '.default';
        
        // Recursively translate children
        let childCode = '';
        if (node.children) {
            const childContext = { ...context, indentionLevel: context.indentionLevel + 1 };
            childCode = node.children
                .map(child => context.registry.translate(child, childContext))
                .join('\n');
        }
        
        return `${indent}DSCard(style: ${style}) {\n${childCode}\n${indent}}`;
    }
}
```

2. **Register it in `src/index.ts`:**

```typescript
import { DSCardTranslator } from './translator/swiftui/ds_card';

private initializeRegistry(): TranslatorRegistry {
    const registry = new TranslatorRegistry();

    // Register specific DS components first
    registry.register(new StubButtonTranslator());
    registry.register(new DSCardTranslator());      // ← ADD HERE

    // Generic translators
    registry.register(new TextTranslator());
    registry.register(new FrameTranslator());
    registry.setFallback(new FrameTranslator());

    return registry;
}
```

3. **Find your `componentId`:**
   - In Figma, right-click the component instance → "Copy link"
   - The URL contains the node ID: `...?node-id=12345:67890`
   - Or use the Figma API to list components in your library

### The Translation Context

Each translator receives a `TranslationContext` with:

| Property | Purpose |
|----------|---------|
| `registry` | Call `registry.translate(child, context)` for recursive translation |
| `tokenResolver` | Resolve Figma values to DS tokens (colors, spacing, etc.) |
| `depth` | Current nesting depth (for debugging) |
| `indentionLevel` | Current indentation (for code formatting) |

### Recursive Translation Example

When translating a Card with nested content:

```typescript
translate(node: FigmaNode, context: TranslationContext): string {
    // Recursively translate children using the registry
    const childContext = { 
        ...context, 
        depth: context.depth + 1,
        indentionLevel: context.indentionLevel + 1 
    };
    
    const childrenCode = node.children?.map(child => 
        context.registry.translate(child, childContext)  // ← RECURSIVE
    ).join('\n') ?? '';
    
    return `DSCard {\n${childrenCode}\n}`;
}
```

This allows a `DSCard` containing a `DSButton` to correctly output:

```swift
DSCard {
    DSButton(title: "Submit", style: .primary)
}
```

---

## 6. Token Definitions

The server maps Figma values (colors, spacing, typography) to your Design System tokens using `src/tokens/stub_definitions.ts`.

### Customizing for Your Company

Replace the stub values with your actual DS tokens:

```typescript
// src/tokens/stub_definitions.ts
export const stubTokenDefinitions: DesignTokenDefinitions = {
    spacing: [
        { name: 'YourDS.Spacing.none', value: 0 },
        { name: 'YourDS.Spacing.xs', value: 4 },
        { name: 'YourDS.Spacing.sm', value: 8 },
        // ... your actual values
    ],
    colors: [
        { name: 'YourDS.Color.primary', r: 0.2, g: 0.4, b: 0.9 },
        // ... your actual RGB values (0-1 range)
    ],
    // ...
};
```

The resolver uses **tolerance matching** to find the closest token, so exact matches aren't required.
