import axios from 'axios';
import { FigmaDataSource, FigmaNode, FigmaApiResponse, ImageExportResult } from './types';
import { config } from '../config';
import sampleNode from './mocks/sample_node.json';

export class RemoteFigmaClient implements FigmaDataSource {
    private accessToken: string;
    private baseUrl = 'https://api.figma.com/v1';

    constructor(accessToken: string) {
        this.accessToken = accessToken;
    }

    async getNode(fileKey: string, nodeId: string): Promise<FigmaNode> {
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

            return nodeData.document;
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
            const node = await this.getNode(fileKey, nodeId);
            const width = node.absoluteBoundingBox?.width ?? 0;
            const height = node.absoluteBoundingBox?.height ?? 0;

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
    async getNode(fileKey: string, nodeId: string): Promise<FigmaNode> {
        console.log(`[MockFigmaClient] Fetching node ${nodeId} from file ${fileKey}`);
        // In a real mock, we might switch based on ID, but for now return sample
        return sampleNode as unknown as FigmaNode;
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
