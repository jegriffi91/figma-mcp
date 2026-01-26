
import { TranslatorRegistry } from '../src/translator/registry';
import { FrameTranslator, TextTranslator } from '../src/translator/swiftui/primitives';
import { StubButtonTranslator } from '../src/translator/swiftui/stub_components';
import { DesignTokenResolver } from '../src/tokens/resolver';
import { FigmaNode } from '../src/figma/types';

// Mock Resolver
class MockResolver extends DesignTokenResolver {
    constructor() {
        super({} as any); // Pass dummy token set
    }
}

// Setup Registry
const registry = new TranslatorRegistry();
const resolver = new MockResolver();
registry.register(new StubButtonTranslator());
registry.register(new TextTranslator());
registry.register(new FrameTranslator());

// Create context
const context = {
    registry,
    tokenResolver: resolver,
    depth: 0,
    indentionLevel: 0
};

// Test Node with Absolute Child
const absoluteNode: FigmaNode = {
    id: '1:1',
    name: 'Parent Frame',
    type: 'FRAME',
    layoutMode: 'VERTICAL',
    layoutSizingHorizontal: 'FIXED',
    layoutSizingVertical: 'FIXED',
    absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
    fills: [],
    children: [
        {
            id: '1:2',
            name: 'Normal Child',
            type: 'TEXT',
            characters: 'I am normal flow',
            absoluteBoundingBox: { x: 10, y: 10, width: 50, height: 20 },
            fills: []
        },
        {
            id: '1:3',
            name: 'Absolute Child',
            type: 'TEXT',
            characters: 'I am absolute',
            layoutPositioning: 'ABSOLUTE',
            fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 } }],
            absoluteBoundingBox: { x: 50, y: 50, width: 20, height: 20 }
        }
    ]
};

console.log("--- Translating Node with Absolute Child ---");
const output = registry.translate(absoluteNode, context);
console.log(output);
console.log("--------------------------------------------");

if (!output.includes("I am absolute")) {
    console.error("FAIL: Absolute child is missing from output!");
    process.exit(1);
} else {
    console.log("PASS: Absolute child is present.");
}
