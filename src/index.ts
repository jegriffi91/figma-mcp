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
import { VisionContextExtractor } from './translator/vision_context';
import { discoverComponents, mergeComponents } from './core/component_discovery';
import { ComponentConfigurationSchema } from './core/schemas';
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
    private visionExtractor?: VisionContextExtractor;

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
        this.visionExtractor = new VisionContextExtractor(tokenResolver);

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
                        name: 'figma_to_swiftui',
                        description: 'Fetches a node from Figma and converts it to SwiftUI code based on the internal design system stub.',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                file_key: {
                                    type: 'string',
                                    description: 'The key of the Figma file',
                                },
                                node_id: {
                                    type: 'string',
                                    description: 'The ID of the node to translate (e.g., "1:2")',
                                },
                                handoff_mode: {
                                    type: 'boolean',
                                    description: 'Generate scaffold with TODOs instead of full implementations (default: true)',
                                },
                            },
                            required: ['file_key', 'node_id'],
                        },
                    },
                    {
                        name: 'figma_vision_translate',
                        description: 'Exports a Figma node as PNG image with extracted metadata for vision-based SwiftUI generation. Returns base64 image + colors/typography/spacing data.',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                file_key: {
                                    type: 'string',
                                    description: 'The key of the Figma file',
                                },
                                node_id: {
                                    type: 'string',
                                    description: 'The ID of the node to export (e.g., "1:2")',
                                },
                                scale: {
                                    type: 'number',
                                    description: 'Export scale factor (1-4), default 2',
                                },
                            },
                            required: ['file_key', 'node_id'],
                        },
                    },
                    {
                        name: 'discover_components',
                        description: 'Discover new design system components from a Figma node and add them to components.json. Preserves existing mappings and only adds net-new components.',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                file_key: {
                                    type: 'string',
                                    description: 'The key of the Figma file',
                                },
                                node_id: {
                                    type: 'string',
                                    description: 'The ID of the node to scan for components',
                                },
                                config_path: {
                                    type: 'string',
                                    description: 'Path to components.json (default: ./sample-config/components.json)',
                                },
                            },
                            required: ['file_key', 'node_id'],
                        },
                    },
                    {
                        name: 'figma_to_compose',
                        description: 'Fetches a node from Figma and converts it to Jetpack Compose code based on the internal design system configuration.',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                file_key: {
                                    type: 'string',
                                    description: 'The key of the Figma file',
                                },
                                node_id: {
                                    type: 'string',
                                    description: 'The ID of the node to translate (e.g., "1:2")',
                                },
                                handoff_mode: {
                                    type: 'boolean',
                                    description: 'Generate scaffold with TODOs instead of full implementations (default: true)',
                                },
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
            if (toolName === 'figma_vision_translate') {
                return this.handleVisionTranslate(request.params.arguments as any);
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

    private async handleVisionTranslate(args: { file_key: string; node_id: string; scale?: number }) {
        if (!args.file_key || !args.node_id) {
            throw new McpError(ErrorCode.InvalidParams, 'Missing required arguments: file_key, node_id');
        }

        try {
            console.error(`[Tool] figma_vision_translate called for node ${args.node_id} in file ${args.file_key}`);
            const scale = args.scale ?? 2;

            // Check if client supports image export
            if (!this.figmaClient.getNodeImage) {
                throw new Error('Image export not supported in mock mode. Use real Figma client.');
            }

            // 1. Export node as image
            const imageResult = await this.figmaClient.getNodeImage(args.file_key, args.node_id, scale);

            // 2. Fetch node metadata
            const nodeData = await this.figmaClient.getNode(args.file_key, args.node_id);
            const node = nodeData.document;

            // 3. Extract flattened metadata
            const metadata = this.visionExtractor!.extract(node);

            // 4. Generate analysis prompt
            const prompt = this.visionExtractor!.generateAnalysisPrompt(node.name, metadata);

            // 5. Return structured payload
            const payload = {
                image: {
                    base64: imageResult.base64Data,
                    width: imageResult.width,
                    height: imageResult.height,
                    mimeType: 'image/png',
                },
                metadata,
                prompt,
            };

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(payload, null, 2),
                    },
                ],
            };
        } catch (error: any) {
            console.error(`[Error] Vision translate failed:`, error);
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
