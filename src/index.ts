import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    ErrorCode,
    McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { config } from './config';
import { getFigmaClient } from './figma/client';
import { TranslatorRegistry } from './translator/registry';
import { DesignTokenResolver } from './tokens/resolver';
import { FrameTranslator, TextTranslator } from './translator/swiftui/primitives';
import { DesignSystemLoader } from './core/loader';
import { ConfigurableComponentTranslator } from './translator/swiftui/configurable_component';
import { PlaceholderTranslator } from './translator/swiftui/placeholder_translator';
import { discoverComponents, mergeComponents } from './core/component_discovery';
import { ComponentConfigurationSchema } from './core/schemas';
// Optimization Utilities
import { pruneNodeData } from './core/optimization';
import { optimizeForCli } from './core/image_processor';

// Compose translators
import { ComposeLayoutTranslator, ComposeTextTranslator } from './translator/compose/primitives';
import { ComposeConfigurableComponentTranslator } from './translator/compose/configurable_component';
import { ComposePlaceholderTranslator } from './translator/compose/placeholder_translator';

/**
 * Figma MCP Server
 * A Model Context Protocol server that interfaces with Figma to translate nodes to SwiftUI.
 */
class FigmaMcpServer {
    private server: Server;
    private figmaClient = getFigmaClient();
    private registry!: TranslatorRegistry; // SwiftUI registry
    private composeRegistry!: TranslatorRegistry; // Compose registry

    constructor() {
        this.server = new Server(
            {
                name: 'figma-mcp-server',
                version: '1.0.0',
            },
            {
                capabilities: {
                    tools: {},
                },
            }
        );

        this.setupHandlers();
        this.setupErrorHandling();
    }

    async initialize(): Promise<void> {
        // Load Design System Configuration (SwiftUI)
        const loader = new DesignSystemLoader(config.designSystemRoot);

        console.error(`[Init] Loading SwiftUI Design System from: ${config.designSystemRoot}`);
        const tokens = await loader.loadTokens();
        const components = await loader.loadComponents();

        // Initialize SwiftUI Registry with loaded tokens
        const tokenResolver = new DesignTokenResolver(tokens);
        this.registry = new TranslatorRegistry(tokenResolver);

        // Register SwiftUI Translators
        if (components.components.length > 0) {
            console.error(`[Init] Registering ${components.components.length} SwiftUI configurable components`);
            this.registry.register(new ConfigurableComponentTranslator(components));
        }
        this.registry.register(new PlaceholderTranslator());
        this.registry.register(new TextTranslator());
        this.registry.register(new FrameTranslator());
        this.registry.setFallback(new FrameTranslator());

        // Load Compose Design System Configuration
        const composeLoader = new DesignSystemLoader(config.designSystemRootCompose);
        console.error(`[Init] Loading Compose Design System from: ${config.designSystemRootCompose}`);
        const composeTokens = await composeLoader.loadTokens();
        const composeComponents = await composeLoader.loadComponents();

        // Initialize Compose Registry
        const composeTokenResolver = new DesignTokenResolver(composeTokens);
        this.composeRegistry = new TranslatorRegistry(composeTokenResolver);

        // Register Compose Translators
        if (composeComponents.components.length > 0) {
            console.error(`[Init] Registering ${composeComponents.components.length} Compose configurable components`);
            this.composeRegistry.register(new ComposeConfigurableComponentTranslator(composeComponents));
        }
        this.composeRegistry.register(new ComposePlaceholderTranslator());
        this.composeRegistry.register(new ComposeTextTranslator());
        this.composeRegistry.register(new ComposeLayoutTranslator());
        this.composeRegistry.setFallback(new ComposeLayoutTranslator());
    }

    private setupHandlers() {
        this.setupListToolsHandler();
        this.setupCallToolHandler();
    }

    private setupListToolsHandler() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    {
                        name: 'figma_get_node_data',
                        description: 'STAGE 1: EXPLORE. Retrieves standard metadata (name, type, text, simple colors) for a Figma node. LOW COST. Use this FIRST to explore the node hierarchy or get content.',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                file_key: { type: 'string', description: 'The key of the Figma file' },
                                node_id: { type: 'string', description: 'The ID of the node to inspect' },
                            },
                            required: ['file_key', 'node_id'],
                        },
                    },
                    {
                        name: 'figma_get_node_snapshot',
                        description: 'STAGE 2: VISUALIZE. Retrieves a visual snapshot AND metadata for a Figma node. EXPENSIVE. Use ONLY when you need to see layout, specific styling details, or "vibe" that metadata cannot capture. Returns pruned JSON and WebP image.',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                file_key: { type: 'string', description: 'The key of the Figma file' },
                                node_id: { type: 'string', description: 'The ID of the node to snapshot' },
                            },
                            required: ['file_key', 'node_id'],
                        },
                    },
                    {
                        name: 'figma_to_swiftui',
                        description: 'STAGE 3: GENERATE (SWIFTUI). Fetches a node from Figma and converts it to SwiftUI code based on the internal design system stub. Best used after exploring node metadata.',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                file_key: { type: 'string', description: 'The key of the Figma file' },
                                node_id: { type: 'string', description: 'The ID of the node to translate (e.g., "1:2")' },
                                handoff_mode: { type: 'boolean', description: 'Generate scaffold with TODOs instead of full implementations (default: true)' },
                            },
                            required: ['file_key', 'node_id'],
                        },
                    },
                    {
                        name: 'figma_to_compose',
                        description: 'STAGE 3: GENERATE (ANDROID). Fetches a node from Figma and converts it to Jetpack Compose code based on the internal design system configuration. Best used after exploring node metadata.',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                file_key: { type: 'string', description: 'The key of the Figma file' },
                                node_id: { type: 'string', description: 'The ID of the node to translate (e.g., "1:2")' },
                                handoff_mode: { type: 'boolean', description: 'Generate scaffold with TODOs instead of full implementations (default: true)' },
                            },
                            required: ['file_key', 'node_id'],
                        },
                    },
                    {
                        name: 'discover_components',
                        description: 'MAINTENANCE: Discover new design system components from a Figma node and add them to components.json. Preserves existing mappings and only adds net-new components.',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                file_key: { type: 'string', description: 'The key of the Figma file' },
                                node_id: { type: 'string', description: 'The ID of the node to scan for components' },
                                config_path: { type: 'string', description: 'Path to components.json (default: ./sample-config/components.json)' },
                            },
                            required: ['file_key', 'node_id'],
                        },
                    },
                ],
            };
        });
    }

    private setupCallToolHandler() {
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const toolName = request.params.name;

            // Route to appropriate handler
            if (toolName === 'figma_get_node_data') {
                return this.handleGetNodeData(request.params.arguments as any);
            }

            if (toolName === 'figma_get_node_snapshot') {
                return this.handleGetNodeSnapshot(request.params.arguments as any);
            }

            // Legacy Support/Alias
            if (toolName === 'figma_vision_translate') {
                console.error('[Deprecation Warning] figma_vision_translate is deprecated. Redirecting to figma_get_node_snapshot.');
                return this.handleGetNodeSnapshot(request.params.arguments as any);
            }

            if (toolName === 'discover_components') {
                return this.handleDiscoverComponents(request.params.arguments as any);
            }

            if (toolName === 'figma_to_compose') {
                return this.handleFigmaToCompose(request.params.arguments as any);
            }

            if (toolName !== 'figma_to_swiftui') {
                throw new McpError(ErrorCode.MethodNotFound, `Tool not found: ${toolName}`);
            }

            const args = request.params.arguments as { file_key: string; node_id: string };
            if (!args.file_key || !args.node_id) {
                throw new McpError(ErrorCode.InvalidParams, 'Missing required arguments: file_key, node_id');
            }

            try {
                console.error(`[Tool] figma_to_swiftui called for node ${args.node_id} in file ${args.file_key}`);

                // 1. Fetch Node Data (includes document, components, componentSets)
                const nodeData = await this.figmaClient.getNode(args.file_key, args.node_id);
                const node = nodeData.document;

                // 2. Translate Node
                const swiftUICode = this.registry.translate(node);

                return {
                    content: [
                        {
                            type: 'text',
                            text: swiftUICode,
                        },
                    ],
                };
            } catch (error: any) {
                console.error(`[Error] Tool execution failed:`, error);
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Error: ${error.message}`,
                        },
                    ],
                    isError: true,
                };
            }
        });
    }

    private async handleGetNodeData(args: { file_key: string; node_id: string }) {
        if (!args.file_key || !args.node_id) {
            throw new McpError(ErrorCode.InvalidParams, 'Missing required arguments: file_key, node_id');
        }

        try {
            console.error(`[Tool] figma_get_node_data called for node ${args.node_id} in file ${args.file_key}`);
            const nodeData = await this.figmaClient.getNode(args.file_key, args.node_id);
            const pruned = pruneNodeData(nodeData.document, this.registry.getTokenResolver());

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(pruned, null, 2),
                    },
                    {
                        type: 'text',
                        text: `[Visuals] To view layout and "vibe", call "figma_get_node_snapshot".`
                    }
                ],
            };

        } catch (error: any) {
            console.error(`[Error] figma_get_node_data failed:`, error);
            return {
                content: [{ type: 'text', text: `Error: ${error.message}` }],
                isError: true,
            };
        }
    }

    private async handleGetNodeSnapshot(args: { file_key: string; node_id: string }) {
        if (!args.file_key || !args.node_id) {
            throw new McpError(ErrorCode.InvalidParams, 'Missing required arguments: file_key, node_id');
        }

        try {
            console.error(`[Tool] figma_get_node_snapshot called for node ${args.node_id} in file ${args.file_key}`);

            // 1. & 2. Fetch Node Data and Image Export in Parallel
            const [nodeData, imageResult] = await Promise.all([
                this.figmaClient.getNode(args.file_key, args.node_id),
                this.figmaClient.getNodeImage ?
                    this.figmaClient.getNodeImage(args.file_key, args.node_id, 2.0) :
                    Promise.resolve({ base64Data: "[Mock Image Data]", imageUrl: "", width: 0, height: 0 })
            ]);

            const pruned = pruneNodeData(nodeData.document, this.registry.getTokenResolver());

            // 3. Optimize Image
            let imageBase64: string | null = null;
            if (imageResult && imageResult.base64Data && imageResult.base64Data !== "[Mock Image Data]") {
                const buffer = Buffer.from(imageResult.base64Data, 'base64');
                const optimizedBuffer = await optimizeForCli(buffer);
                imageBase64 = optimizedBuffer.toString('base64');
            } else {
                imageBase64 = imageResult?.base64Data || null;
            }

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(pruned, null, 2),
                    },
                    {
                        type: 'image',
                        data: imageBase64 || '',
                        mimeType: 'image/webp'
                    }
                ],
            };
        } catch (error: any) {
            console.error(`[Error] figma_get_node_snapshot failed:`, error);
            return {
                content: [{ type: 'text', text: `Error: ${error.message}` }],
                isError: true,
            };
        }
    }

    private async handleFigmaToCompose(args: { file_key: string; node_id: string }) {
        if (!args.file_key || !args.node_id) {
            throw new McpError(ErrorCode.InvalidParams, 'Missing required arguments: file_key, node_id');
        }

        try {
            console.error(`[Tool] figma_to_compose called for node ${args.node_id} in file ${args.file_key}`);

            // 1. Fetch Node Data (includes document, components, componentSets)
            const nodeData = await this.figmaClient.getNode(args.file_key, args.node_id);
            const node = nodeData.document;

            // 2. Translate Node using Compose registry
            const composeCode = this.composeRegistry.translate(node);

            return {
                content: [
                    {
                        type: 'text',
                        text: composeCode,
                    },
                ],
            };
        } catch (error: any) {
            console.error(`[Error] figma_to_compose failed:`, error);
            return {
                content: [
                    {
                        type: 'text',
                        text: `Error: ${error.message}`,
                    },
                ],
                isError: true,
            };
        }
    }

    private async handleDiscoverComponents(args: { file_key: string; node_id: string; config_path?: string }) {
        if (!args.file_key || !args.node_id) {
            throw new McpError(ErrorCode.InvalidParams, 'Missing required arguments: file_key, node_id');
        }

        try {
            console.error(`[Tool] discover_components called for node ${args.node_id} in file ${args.file_key}`);

            // Default config path
            const configPath = args.config_path || path.join(config.designSystemRoot, 'components.json');

            // 1. Fetch node data from Figma
            const nodeData = await this.figmaClient.getNode(args.file_key, args.node_id);

            // 2. Discover components
            const discovered = discoverComponents(
                nodeData.document,
                nodeData.components,
                nodeData.componentSets
            );

            // 3. Load existing config or create empty one
            let existingConfig = { handoffMode: true, components: [] as any[] };
            if (fs.existsSync(configPath)) {
                const content = fs.readFileSync(configPath, 'utf-8');
                const parsed = JSON.parse(content);
                existingConfig = ComponentConfigurationSchema.parse(parsed);
            }

            // 4. Merge components
            const result = mergeComponents(existingConfig, discovered);

            // 5. Write updated config
            fs.writeFileSync(configPath, JSON.stringify(result.config, null, 2));

            // 6. Return summary
            const summary = {
                configPath,
                totalComponents: result.config.components.length,
                added: result.added,
                skipped: result.skipped,
                message: result.added.length > 0
                    ? `Added ${result.added.length} new component(s): ${result.added.join(', ')}`
                    : 'No new components found to add.',
            };

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(summary, null, 2),
                    },
                ],
            };
        } catch (error: any) {
            console.error(`[Error] Discover components failed:`, error);
            return {
                content: [
                    {
                        type: 'text',
                        text: `Error: ${error.message}`,
                    },
                ],
                isError: true,
            };
        }
    }

    private setupErrorHandling() {
        this.server.onerror = (error) => {
            console.error('[MCP Error]', error);
        };

        process.on('SIGINT', async () => {
            await this.server.close();
            process.exit(0);
        });
    }

    async run() {
        await this.initialize();
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('Figma MCP Server running on stdio');

        if (config.useMockFigma) {
            console.error('Running in MOCK mode');
        }
    }
}

const server = new FigmaMcpServer();
server.run().catch(console.error);
