
import { pruneNodeData } from '../src/core/optimization';
import { optimizeForCli } from '../src/core/image_processor';
import sampleNode from '../src/figma/mocks/sample_node-2.json';
import { FigmaNode } from '../src/figma/types';
import fs from 'fs';
import path from 'path';

// Helper to estimate size
function getSize(obj: any) {
    return JSON.stringify(obj).length;
}

async function validateJSONPruning() {
    console.log("--- Validating figma_get_node_data (JSON Pruning) ---");

    // Setup sample node
    let node: FigmaNode;
    if ((sampleNode as any).document) {
        node = (sampleNode as any).document;
    } else if ((sampleNode as any).nodes) {
        const key = Object.keys((sampleNode as any).nodes)[0];
        node = (sampleNode as any).nodes[key].document;
    } else {
        node = sampleNode as any;
    }

    const rawSize = getSize(node);
    console.log(`Raw Node Size: ${(rawSize / 1024).toFixed(2)} KB`);

    const pruned = pruneNodeData(node);
    const prunedSize = getSize(pruned);
    console.log(`Pruned Node Size: ${(prunedSize / 1024).toFixed(2)} KB`);

    const reduction = ((rawSize - prunedSize) / rawSize) * 100;
    console.log(`Reduction: ${reduction.toFixed(2)}%`);

    if (prunedSize > 5 * 1024) { // Allow up to 5KB for complex nodes, but aim for less
        console.warn("WARNING: Pruned JSON is still > 5KB");
    } else {
        console.log("PASS: JSON is concise.");
    }
}

async function validateImageOptimization() {
    console.log("\n--- Validating figma_get_node_snapshot (Image Optimization) ---");

    // Create a dummy large image (simulate 4MB)
    // In a real test we'd load a real image, but here we just want to ensure the pipeline runs
    // and produces a valid output. However, without a real image buffer, sharp might fail.
    // So let's create a minimal valid PNG buffer.

    // Minimal 1x1 PNG Base64
    const validPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const inputBuffer = Buffer.from(validPngBase64, 'base64');

    console.log("Running optimization pipeline on sample image...");
    try {
        const optimized = await optimizeForCli(inputBuffer);
        const outputSize = optimized.length;
        console.log(`Optimized Image Size: ${outputSize} bytes`);
        console.log("PASS: Image pipeline executed without error.");
    } catch (e: any) {
        console.error("FAIL: Image optimization failed:", e.message);
    }
}

async function main() {
    await validateJSONPruning();
    await validateImageOptimization();
}

main().catch(console.error);
