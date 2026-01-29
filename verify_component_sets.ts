import { MockFigmaClient } from './src/figma/client';
import { ConfigurableComponentTranslator } from './src/translator/swiftui/configurable_component';
import { TranslatorRegistry } from './src/translator/registry';
import { DesignTokenResolver } from './src/tokens';
import { FigmaNode } from './src/figma/types';

async function verify() {
    console.log("Starting Component Set Verification...");

    // 1. Setup Mock Client
    const client = new MockFigmaClient();

    // 2. Fetch Node Data (should include componentSets)
    // Using the ID from sample_node_v2.json
    const nodeId = "125:6077";
    const fileKey = "mock_file_key";

    const nodeData = await client.getNode(fileKey, nodeId);

    if (!nodeData.componentSets || Object.keys(nodeData.componentSets).length === 0) {
        console.error("FAILED: No componentSets found in response!");
        return;
    }

    console.log(`SUCCESS: Found ${Object.keys(nodeData.componentSets).length} component sets.`);

    // 3. Setup Translator with a config that relies on the Component Set name
    // In sample_node_v2.json, node 125:6077 has:
    // "componentId": "125:5248" (This specific variant)
    // "name": "Atlas Section" (Instance name)

    // Let's test with a deeply nested child where the instance name might differ from the main component set name.
    // Node I125:6077;120368:6005 is "Atlas Section Title"
    // componentId: "125:4929"
    // componentSets has "125:4928" -> "Atlas Section Title"

    // Let's try to find that specific child node manually for testing
    const findNode = (node: FigmaNode, name: string): FigmaNode | undefined => {
        if (node.name === name) return node;
        if (node.children) {
            for (const child of node.children) {
                const found = findNode(child, name);
                if (found) return found;
            }
        }
        return undefined;
    };

    const targetNode = findNode(nodeData.document, "Atlas Section Title");

    if (!targetNode) {
        console.error("FAILED: Could not find target node 'Atlas Section Title' in document.");
        return;
    }

    console.log(`Found target node: ${targetNode.name} (${targetNode.id})`);

    // Configure translator to match "Atlas Section Title"
    // If our logic works, it should match this even if we change the node name to something generic,
    // assuming we can link it back to the component set.
    // 
    // Wait, the "componentId" on the instance usually points to a VARIANT. 
    // The "componentSetId" is what links to the set.
    // Let's check sample_node_v2.json again.
    // The componentSets keys are IDs like "125:4928".
    // 
    // The instance node has "componentId": "125:4929". 
    // Use grep to see if 125:4929 is related to 125:4928.
    // 
    // Actually, looking at the sample, "125:4929" is NOT in componentSets keys. 
    // But usually Figma components have a `componentSetId` field if they belong to a set.
    // Let's assume for this test that we can match by name if the ID lookup fails?
    // 
    // In our implementation of `configurable_component.ts`:
    // We check `componentSets[componentId]`. 
    // If componentId is the VARIANT ID, it might NOT be a key in componentSets (which usually keys by Set ID).
    //
    // However, looking at `sample_node_v2.json`:
    // "nodes": { "125:6077": { ... "componentSets": { "125:5247": { ... } } } }
    //
    // If the instance points to a specific variant, how do we get the Set ID?
    // The Instance node itself doesn't always have `componentSetId`.
    // It has `componentId`.
    //
    // If our `componentSets` map maps VARIANT_ID -> Metadata, then `componentSets[componentId]` works.
    // If it maps SET_ID -> Metadata, we need a way to go Instance -> Variant -> Set.
    //
    // Let's re-read the JSON structure description provided by the user.
    // The user said: `nodes.<nodeId>.componentSets[]` path which looks to hold the metadata.
    // 
    // In `sample_node_v2.json`:
    // "componentSets": { "125:5247": { "name": "Atlas Section" ... } }
    // The root node "125:6077" is an INSTANCE with "componentId": "125:5248".
    // 
    // Is "125:5248" (the variant) related to "125:5247" (the set)?
    // Usually via the `components` map which lists all components (variants) and their `componentSetId`.
    // `sample_node_v2.json` might have a `components` section too?
    //
    // Let's verify if `configurable_component.ts` logic `componentSets[componentId]` is correct.
    // If the keys in `componentSets` are Set IDs, and `componentId` on the instance is a Variant ID, this lookup will FAIL.
    //
    // We might need an intermediate lookup using the `components` dictionary if available.

    const config = {
        name: "Test Config",
        handoffMode: true,
        components: [
            {
                figmaId: "Atlas Section Title", // We want to match this name from the Component Set
                swiftView: "AtlasSectionTitleView",
                params: {
                    "title#17004:0": "title"
                }
            }
        ]
    };

    // Mock Token Resolver
    const tokenResolver = {
        resolveColor: () => undefined,
        resolveSize: () => undefined,
        resolveTypography: () => undefined
    } as unknown as DesignTokenResolver;

    const registry = new TranslatorRegistry(tokenResolver);
    const translator = new ConfigurableComponentTranslator(config);
    registry.register(translator);

    // Simulate Translation Context
    const context = {
        componentSets: nodeData.componentSets,
        components: nodeData.components
    };

    // Mangle the node name to prove we are looking up via ID -> Set
    const originalName = targetNode.name;
    console.log(`Mangling node name from "${originalName}" to "Wrong Name" to test ID-based lookup...`);
    targetNode.name = "Wrong Name";

    // Run Translation
    console.log("Translating node...");
    const result = translator.translate(targetNode, {
        registry,
        tokenResolver,
        depth: 0,
        indentionLevel: 0,
        componentSets: nodeData.componentSets,
        components: nodeData.components
    });

    console.log("Translation Result:");
    console.log(result);

    if (result.includes("AtlasSectionTitleView")) {
        console.log("SUCCESS: Correctly translated using component set name (despite wrong node name)!");
    } else {
        console.log("FAILURE: Did not translate to AtlasSectionTitleView.");

        // Debugging why it failed
        console.log("Debug Info:");
        console.log("Instance Component ID:", targetNode.componentId);
        if (targetNode.componentId && nodeData.components[targetNode.componentId]) {
            console.log("Linked Component Metadata:", nodeData.components[targetNode.componentId]);
            const setID = nodeData.components[targetNode.componentId].componentSetId;
            console.log("Linked Component Set ID:", setID);
            if (setID && nodeData.componentSets[setID]) {
                console.log("Linked Component Set Metadata:", nodeData.componentSets[setID]);
            } else {
                console.log("Set Metadata NOT FOUND");
            }
        } else {
            console.log("Component Metadata NOT FOUND for ID", targetNode.componentId);
        }
    }
}

verify().catch(console.error);
