# Project Context: Figma MCP Server

## 1. Project Goal
To build a lightweight, customizable Model Context Protocol (MCP) server that acts as a bridge between Figma and the user's SwiftUI codebase. The server will:
1.  Fetch node data from the Figma API (using a personal access token).
2.  Translate that raw JSON data into production-ready SwiftUI code.
3.  Be capable of generic translation (Frames -> VStacks) and specific component mapping (Figma "Button" -> DesignSystem.Button).

## 2. Technical Stack & Constraints
-   **Language**: TypeScript (Node.js).
-   **Type Safety**: **STRICT** mode is enforced. No implicit `any`.
-   **Transport**: Stdio (for use with local clients like GitHub Copilot).
-   **Deployment**: Local execution.

## 3. Architecture & Patterns

### 3.1 Scalability: Registry + Strategy Pattern
To handle hundreds of design system components, we avoid a massive switch statement.
-   **Registry**: A central store of `ComponentTranslator` instances.
-   **Translators**: Each component (e.g., `ButtonTranslator`, `CardTranslator`) implements a common interface.
-   **Recursion**: Translators can request the translation of their types, enabling deep nesting (e.g., a Card containing a Button).

### 3.2 Hybrid "Net-New" Handling
-   **Design System Components**: If a node matches a registered component, use the specific translator.
-   **Net-New / Unknown**: If a node is a custom assemblage (e.g., a designer made a new layout), fall back to generic translators (`FrameTranslator`, `TextTranslator`) to produce raw SwiftUI (`VStack`, `HStack`, `Text`).

### 3.3 Data Layer: Mock vs Real
-   To save API limits and work offline, the system supports a **Mock Mode**.
-   `FigmaClient` is an interface with `RemoteFigmaClient` and `MockFigmaClient` implementations.

## 4. Environment & Integration
-   **Git Submodule**: This project is intended to be a submodule within a larger iOS repository.
-   **Relative Paths**: The server must be able to access file paths relative to the host repository (e.g., `../../Modules/DesignSystem`) to potentially read source files or configuration.
-   **Environment Variables**:
    -   `FIGMA_ACCESS_TOKEN`: For real API calls.
    -   `USE_MOCK_FIGMA`: Boolean to toggle mock mode.
    -   `DESIGN_SYSTEM_ROOT`: Path to the ios design system files.
