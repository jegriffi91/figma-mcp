# Figma MCP Server

A Model Context Protocol (MCP) server that bridges the gap between Figma designs and SwiftUI code. This tool allows AI agents to fetch Figma node data and translate it into clean, production-ready SwiftUI code that follows your specific design system constraints.

## Overview

The Figma MCP Server provides a configuration-driven approach to UI code generation. Instead of generic "div-soup" translations, it uses your own `tokens.json` and `components.json` to map Figma styles and components directly to your internal SwiftUI library.

### Key Features:
- **Design System Native**: Maps Figma tokens (colors, spacing, typography) to your Swift constants.
- **Component Mapping**: Automatically identifies and uses your custom SwiftUI components based on Figma IDs.
- **Handoff Mode**: Generates scaffolds with `TODO` markers for action handlers, state management, and asset resolution.
- **Vision Integration**: Provides visual context (PNG + metadata) for LLMs to perform high-level structural analysis.
- **Component Discovery**: Automatically scans Figma files to discover and register new components into your configuration.

---

## Available Tools

The server exposes the following tools to MCP-compatible clients:

| Tool | Description |
|------|-------------|
| `figma_to_swiftui` | Fetches a Figma node and converts it to SwiftUI. Use `handoff_mode: true` (default) for scaffolds or `false` for full implementations. |
| `figma_to_compose` | Fetches a Figma node and converts it to Jetpack Compose. Uses separate `DESIGN_SYSTEM_ROOT_COMPOSE` configuration. |
| `figma_get_node_data` | **LOW COST**. Retrieves standard metadata (name, text, simple colors) for exploring the node hierarchy. Use this first. |
| `figma_get_node_snapshot` | **EXPENSIVE**. Retrieves a visual snapshot (WebP) AND metadata. Use only when visual layout/vibe is needed. Replaces `figma_vision_translate`. |
| `discover_components` | Scans a Figma node/file for reusable components and adds them to your `components.json` configuration. |

---

## Quick Start Guide

### 1. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/jegriffi91/figma-mcp.git
cd figma-mcp
npm install
npm run build
```

### 2. Configuration
Create a `.env` file or set the following environment variables:
```bash
FIGMA_ACCESS_TOKEN=your_figma_personal_access_token
DESIGN_SYSTEM_ROOT=./sample-config # Path to your tokens and components config
```

### 3. Add to Parent Project (MCP Client)
Add the server to your MCP client configuration (e.g., Antigravity, VS Code, or Desktop app).

**Example Config (`~/.copilot/mcp-config.json`):**
```json
{
  "mcpServers": {
    "figma-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/figma-mcp/dist/index.js"],
      "env": {
        "FIGMA_ACCESS_TOKEN": "your_token_here",
        "DESIGN_SYSTEM_ROOT": "/absolute/path/to/your/design-system-config"
      }
    }
  }
}
```

---

## Common Use Cases

### 🛠️ UI Scaffolding
Quickly generate the foundation of a new screen. The server will use your design system's `tokens` (e.g., `Color.appBrand`) and `components` (e.g., `DSButton`) instead of hardcoded values.

### 🔍 Design System Auditing
Use `discover_components` to identify inconsistencies between your Figma designs and implemented components. It helps keep your `components.json` mapping in sync with design updates.

### 🎨 Vision-First Generation
For complex layouts where JSON hierarchy alone is insufficient, use `figma_get_node_snapshot`. This allows an AI agent to "see" the design (via optimized 512px WebP) while having access to the exact metadata (spacing, font names), leading to more accurate layout inference.

### ⚡️ Efficient Exploration
Use `figma_get_node_data` to quickly explore the node hierarchy without incurring the cost of image generation or massive JSON payloads. This tool returns a pruned, token-efficient schema.

### 🚀 Developer Handoff
Generate code with clear `// TODO` markers for logic and state. This accelerates the "boring" parts of UI implementation while leaving the critical architectural decisions to the developer.

---

## Documentation
For detailed information on configuring tokens and component mappings, see the [Integration Guide](./docs/INTEGRATION_GUIDE.md).
