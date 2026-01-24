import axios from 'axios';
import { FigmaDataSource, FigmaNode, FigmaApiResponse } from './types';
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
