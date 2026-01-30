import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export interface Config {
  figmaAccessToken: string;
  useMockFigma: boolean;
  designSystemRoot: string;
}

const getEnvVar = (key: string, required: boolean = false, defaultValue: string = ''): string => {
  const value = process.env[key];
  if (required && !value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value || defaultValue;
};

// Get design system root - can be absolute or relative path
// Set DESIGN_SYSTEM_ROOT env var to point to your project's design system config
// Example: DESIGN_SYSTEM_ROOT=~/dev/DASH/ecw-ios/.design-system
const designSystemRootRaw = getEnvVar('DESIGN_SYSTEM_ROOT', false, './sample-config');
const designSystemRoot = designSystemRootRaw.startsWith('~')
  ? designSystemRootRaw.replace('~', process.env.HOME || '')
  : path.resolve(process.cwd(), designSystemRootRaw);

export const config: Config = {
  figmaAccessToken: getEnvVar('FIGMA_ACCESS_TOKEN'),
  useMockFigma: getEnvVar('USE_MOCK_FIGMA', false, 'false') === 'true',
  designSystemRoot,
};
