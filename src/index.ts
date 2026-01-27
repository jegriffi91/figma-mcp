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
import { StubButtonTranslator } from './translator/swiftui/stub_components';
import { DesignSystemLoader } from './core/loader';
import { ConfigurableComponentTranslator } from './translator/swiftui/configurable_component';

/**
 * Figma MCP Server
 * A Model Context Protocol server that interfaces with Figma to translate nodes to SwiftUI.
 */
class FigmaMcpServer {
    private server: Server;
    private figmaClient = getFigmaClient();
    private registry: TranslatorRegistry;

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

        this.registry = this.initializeRegistry();
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

        // Register Translators

        // 1. Dynamic Configurable Translator (Highest Priority for matched known IDs)
        if (components.components.length > 0) {
            console.error(`[Init] Registering ${components.components.length} configurable components`);
            this.registry.register(new ConfigurableComponentTranslator(components));
        }

        // 2. Specific Code-based Stubs (Fallbacks or Special Logic)
        this.registry.register(new StubButtonTranslator());

        // 3. Generic Primitives
        this.registry.register(new TextTranslator());
        this.registry.register(new FrameTranslator()); // Serves as a fallback for most layout nodes

        // 4. Fallback
        this.registry.setFallback(new FrameTranslator());
    }

    private initializeRegistry(): TranslatorRegistry {
        // Initial sync registry (will be overwritten by initialize)
        const registry = new TranslatorRegistry();

        // Register specific components first (Strategy Pattern)
        registry.register(new StubButtonTranslator());

        // Register generic primitives
        registry.register(new TextTranslator());
        registry.register(new FrameTranslator()); // Serves as a fallback for most layout nodes

        // Explicit fallback for unknown types
        registry.setFallback(new FrameTranslator());

        return registry;
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
            if (request.params.name !== 'figma_to_swiftui') {
                throw new McpError(ErrorCode.MethodNotFound, `Tool not found: ${request.params.name}`);
            }

            const args = request.params.arguments as { file_key: string; node_id: string };
            if (!args.file_key || !args.node_id) {
                throw new McpError(ErrorCode.InvalidParams, 'Missing required arguments: file_key, node_id');
            }

            try {
                console.error(`[Tool] figma_to_swiftui called for node ${args.node_id} in file ${args.file_key}`);

                // 1. Fetch Node
                const node = await this.figmaClient.getNode(args.file_key, args.node_id);

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
