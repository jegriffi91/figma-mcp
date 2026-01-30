import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    ErrorCode,
    McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { config } from './config';
import { getFigmaClient } from './figma/client';
import { TranslatorRegistry } from './translator/registry';
import { DesignTokenResolver } from './tokens/resolver';
import { FrameTranslator, TextTranslator } from './translator/swiftui/primitives';
import { DesignSystemLoader } from './core/loader';
import { ConfigurableComponentTranslator } from './translator/swiftui/configurable_component';
import { PlaceholderTranslator } from './translator/swiftui/placeholder_translator';
import { VisionContextExtractor } from './translator/vision_context';

/**
 * Figma MCP Server
 * A Model Context Protocol server that interfaces with Figma to translate nodes to SwiftUI.
 */
class FigmaMcpServer {
    private server: Server;
    private figmaClient = getFigmaClient();
    private registry!: TranslatorRegistry; // Initialized in initialize()
    private visionExtractor?: VisionContextExtractor; // Initialized in initialize()

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
        // Load Design System Configuration
        const loader = new DesignSystemLoader(config.designSystemRoot);

        console.error(`[Init] Loading Design System from: ${config.designSystemRoot}`);
        const tokens = await loader.loadTokens();
        const components = await loader.loadComponents();

        // Initialize Registry with loaded tokens
        // We recreate the registry here because we need the async loaded tokens
        // A better approach in refactor would be to make registry async or having a 'configure' method
        const tokenResolver = new DesignTokenResolver(tokens);
        this.registry = new TranslatorRegistry(tokenResolver);
        this.visionExtractor = new VisionContextExtractor(tokenResolver);

        // Register Translators

        // 1. Dynamic Configurable Translator (Highest Priority for matched known IDs)
        if (components.components.length > 0) {
            console.error(`[Init] Registering ${components.components.length} configurable components`);
            this.registry.register(new ConfigurableComponentTranslator(components));
        }

        // 2. Placeholder for unknown components (handoff mode)
        this.registry.register(new PlaceholderTranslator());

        // 3. Generic Primitives
        this.registry.register(new TextTranslator());
        this.registry.register(new FrameTranslator());

        // 4. Fallback
        this.registry.setFallback(new FrameTranslator());
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
