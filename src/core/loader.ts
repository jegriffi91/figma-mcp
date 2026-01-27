import fs from 'fs/promises';
import path from 'path';
import {
    TokenConfigurationSchema,
    ComponentConfigurationSchema,
    TokenConfiguration,
    ComponentConfiguration
} from './schemas';

export class DesignSystemLoader {
    private rootPath: string;

    constructor(rootPath: string) {
        this.rootPath = rootPath;
    }

    async loadTokens(): Promise<TokenConfiguration> {
        const filePath = path.join(this.rootPath, 'tokens.json');
        try {
            const data = await fs.readFile(filePath, 'utf-8');
            const json = JSON.parse(data);
            return TokenConfigurationSchema.parse(json);
        } catch (error: any) {
            console.warn(`[DesignSystemLoader] Failed to load tokens.json from ${this.rootPath}: ${error.message}`);
            // Return empty config instead of crashing, so the tool can still function with fallbacks
            return { colors: [], spacing: [], typography: [], cornerRadius: [] };
        }
    }

    async loadComponents(): Promise<ComponentConfiguration> {
        const filePath = path.join(this.rootPath, 'components.json');
        try {
            const data = await fs.readFile(filePath, 'utf-8');
            const json = JSON.parse(data);
            return ComponentConfigurationSchema.parse(json);
        } catch (error: any) {
            console.warn(`[DesignSystemLoader] Failed to load components.json from ${this.rootPath}: ${error.message}`);
            return { handoffMode: true, components: [] };
        }
    }
}
