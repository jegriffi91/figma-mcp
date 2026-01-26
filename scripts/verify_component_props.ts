
import { TranslatorRegistry } from '../src/translator/registry';
import { StubButtonTranslator } from '../src/translator/swiftui/stub_components';
import { DesignTokenResolver } from '../src/tokens/resolver';
import { FigmaNode } from '../src/figma/types';

// Mock Resolver
class MockResolver extends DesignTokenResolver {
    constructor() {
        super({} as any);
    }
}

// Setup
const registry = new TranslatorRegistry();
registry.register(new StubButtonTranslator());
const resolver = new MockResolver();
const context = {
    registry,
    tokenResolver: resolver,
    depth: 0,
    indentionLevel: 0
};

// Test Node 1: Button with Text Property and Boolean Property
const buttonNode: FigmaNode = {
    id: '1:1',
    name: 'DS Button',
    type: 'INSTANCE',
    componentId: 'ds:button-primary',
    componentProperties: {
        'Label': { type: 'TEXT', value: 'Override Label' },
        'Disabled': { type: 'BOOLEAN', value: true },
        'Style': { type: 'VARIANT', value: 'Secondary' }
    }
};

console.log("--- Translating Button with Component Properties ---");
const output = registry.translate(buttonNode, context);
console.log(output);
console.log("--------------------------------------------------");

// Asserts
let pass = true;
if (!output.includes('title: "Override Label"')) {
    console.error("FAIL: Label override not found.");
    pass = false;
}
if (!output.includes('.disabled(true)')) {
    console.error("FAIL: Disabled modifier not found.");
    pass = false;
}
if (!output.includes('style: .secondary')) {
    console.error("FAIL: Style variant not found.");
    pass = false;
}

if (pass) {
    console.log("PASS: All component properties handled correctly.");
} else {
    process.exit(1);
}
