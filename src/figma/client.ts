import axios from 'axios';
import { FigmaDataSource, FigmaNode, FigmaNodeData, FigmaApiResponse, ImageExportResult } from './types';
import { config } from '../config';
import sampleNode from './mocks/sample_node_v2.json';

export class RemoteFigmaClient implements FigmaDataSource {
    private accessToken: string;
    private baseUrl = 'https://api.figma.com/v1';

    constructor(accessToken: string) {
        this.accessToken = accessToken;
    }

    async getNode(fileKey: string, nodeId: string): Promise<FigmaNodeData> {
        try {
            const response = await axios.get<FigmaApiResponse>(
                `${this.baseUrl}/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}`,
                {
                    headers: {
                        'X-Figma-Token': this.accessToken,
                    },
                }
            );

            const nodeData = response.data.nodes[nodeId];
            if (!nodeData) {
                throw new Error(`Node ${nodeId} not found in file ${fileKey}`);
            }

            return {
                document: nodeData.document,
                components: nodeData.components || {},
                componentSets: nodeData.componentSets || {}
            };
        } catch (error: any) {
            if (axios.isAxiosError(error) && error.response) {
                throw new Error(`Figma API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
            }
            throw error;
        }
    }

    async getNodeImage(fileKey: string, nodeId: string, scale: number = 2): Promise<ImageExportResult> {
        try {
            // 1. Request image export URL from Figma
            const exportResponse = await axios.get<{ images: Record<string, string> }>(
                `${this.baseUrl}/images/${fileKey}?ids=${encodeURIComponent(nodeId)}&format=png&scale=${scale}`,
                {
                    headers: {
                        'X-Figma-Token': this.accessToken,
                    },
                }
            );

            const imageUrl = exportResponse.data.images[nodeId];
            if (!imageUrl) {
                throw new Error(`Failed to export image for node ${nodeId}`);
            }

            // 2. Download the image
            const imageResponse = await axios.get(imageUrl, {
                responseType: 'arraybuffer',
            });

            // 3. Get dimensions from the node
            const nodeData = await this.getNode(fileKey, nodeId);
            const width = nodeData.document.absoluteBoundingBox?.width ?? 0;
            const height = nodeData.document.absoluteBoundingBox?.height ?? 0;

            // 4. Convert to base64
            const base64Data = Buffer.from(imageResponse.data).toString('base64');

            return {
                imageUrl,
                base64Data,
                width: Math.round(width * scale),
                height: Math.round(height * scale),
            };
        } catch (error: any) {
            if (axios.isAxiosError(error) && error.response) {
                throw new Error(`Figma Image API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
            }
            throw error;
        }
    }
}

export class MockFigmaClient implements FigmaDataSource {
    async getNode(fileKey: string, nodeId: string): Promise<FigmaNodeData> {
        console.log(`[MockFigmaClient] Fetching node ${nodeId} from file ${fileKey}`);
        const sample = sampleNode as any;

        // Check if sample has the Figma API response structure with nodes
        if (sample.nodes) {
            // Try to find the requested nodeId first
            if (sample.nodes[nodeId]) {
                const nodeEntry = sample.nodes[nodeId];
                return {
                    document: nodeEntry.document,
                    components: nodeEntry.components || {},
                    componentSets: nodeEntry.componentSets || {}
                };
            }

            // Fallback: Use the first available node from the sample
            const availableNodeIds = Object.keys(sample.nodes);
            if (availableNodeIds.length > 0) {
                const firstNodeId = availableNodeIds[0];
                console.log(`[MockFigmaClient] Node ${nodeId} not found, using ${firstNodeId}`);
                const nodeEntry = sample.nodes[firstNodeId];
                return {
                    document: nodeEntry.document,
                    components: nodeEntry.components || {},
                    componentSets: nodeEntry.componentSets || {}
                };
            }
        }

        // Legacy structure: sample is the node entry itself
        if (sample.document) {
            return {
                document: sample.document,
                components: sample.components || {},
                componentSets: sample.componentSets || {}
            };
        }

        // Fallback: sample is just the document node
        return {
            document: sample as FigmaNode,
            components: {},
            componentSets: {}
        };
    }
}

export const getFigmaClient = (): FigmaDataSource => {
    if (config.useMockFigma) {
        return new MockFigmaClient();
    }

    if (!config.figmaAccessToken) {
        throw new Error("FIGMA_ACCESS_TOKEN is required when not in mock mode.");
    }

    return new RemoteFigmaClient(config.figmaAccessToken);
};
