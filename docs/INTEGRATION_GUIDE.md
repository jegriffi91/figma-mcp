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
