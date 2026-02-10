---
description: Converts Figma designs into clean, production-ready code (SwiftUI/Compose) using a token-efficient workflow.
---

# Figma to Code Skill

This skill guides you through the process of converting a Figma node into high-quality UI code. It is optimized for efficiency, ensuring you don't waste tokens on unnecessary image data.

## 1. Capabilities
- **Inspect**: Analyze node hierarchy and content without seeing pixels.
- **Visualize**: Request a visual snapshot only when layout is ambiguous.
- **Translate**: Generate code using the project's Design System.

## 2. Token-Efficient Workflow (The "Look-Then-See" Pattern)

You must follow this sequence to minimize costs:

### Step 1: Low-Cost Inspection
**Tool**: `figma_get_node_data` (STAGE 1: EXPLORE)
- Always start here.
- Returns a lightweight JSON schema (~2KB) containing:
  - `type` (FRAME, TEXT, INSTANCE)
  - `name` (helps identify purpose, e.g., "Submit Button")
  - `text` (content)
  - `fills` (semantic tokens or hex codes)
  - `children` (heirarchy depth limited to 4)

**Decision Point**:
- Is the node a simple list, text block, or standard component? -> **Skip to Step 3**.
- Is the layout complex (absolute positioning, unique alignment)? -> **Proceed to Step 2**.
- Is the "vibe" or specific visual style unclear from JSON? -> **Proceed to Step 2**.

### Step 2: High-Fidelity Visualization (Optional)
**Tool**: `figma_get_node_snapshot` (STAGE 2: VISUALIZE)
- Use this *only* if Step 1 was insufficient.
- Returns the same JSON *plus* an optimized 512px WebP image.
- Use the image to verify:
  - Complex alignment/spacing.
  - shadow/gradient subtleties.
  - "Vibe" check against the design system.

### Step 3: Code Generation
**Tool**: `figma_to_swiftui` or `figma_to_compose` (STAGE 3: GENERATE)
- Call the translation tool to generate the final code.
- **Guideline**: Trust the Design System. If the tool identifies a component (e.g., `DSButton`), use it. Do not hardcode styles if a component exists.

## 3. Example Usage

**User**: "Implement the 'Profile Card' from Figma file ABC..."

**Agent**:
1.  `figma_get_node_data(file="ABC", node="Profile Card")`
    *   *Result*: It's a vertically stacked frame with an image and text.
    *   *Analysis*: Structure is clear, but I need to see the exact corner radius and shadow style to match the "Card" vibe.
2.  `figma_get_node_snapshot(file="ABC", node="Profile Card")`
    *   *Result*: Image shows a specific 16px radius and soft drop shadow.
3.  `figma_to_swiftui(file="ABC", node="Profile Card")`
    *   *Result*: Generates `VStack { ... }` with correct modifiers.

## 4. Troubleshooting
- **Missing Components**: If you see a raw Frame where a component should be, suggest running `discover_components` to update the configuration.
- **Too Many Tokens**: If the JSON from Step 1 is still too large (>10KB), rely on the `name` and `type` fields primarily and request a snapshot if strictly necessary.
