/**
 * Test script to verify translation output with mock data.
 * Run with: npx ts-node scripts/test_translation.ts
 */

import { TranslatorRegistry } from '../src/translator/registry';
import { FrameTranslator, TextTranslator } from '../src/translator/swiftui/primitives';
import { StubButtonTranslator } from '../src/translator/swiftui/stub_components';
import sampleNode from '../src/figma/mocks/sample_node.json';
import { FigmaNode } from '../src/figma/types';

// Initialize registry
const registry = new TranslatorRegistry();
registry.register(new StubButtonTranslator());
registry.register(new TextTranslator());
registry.register(new FrameTranslator());
registry.setFallback(new FrameTranslator());

// Translate the sample node
console.log('=== Translating sample_node.json ===\n');

const swiftUICode = registry.translate(sampleNode as unknown as FigmaNode);

console.log(swiftUICode);
console.log('\n=== End of translation ===');
