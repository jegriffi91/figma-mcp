import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export interface Config {
  figmaAccessToken: string;
  useMockFigma: boolean;
  designSystemRoot: string;
  designSystemRootCompose: string;
}

const getEnvVar = (key: string, required: boolean = false, defaultValue: string = ''): string => {
  const value = process.env[key];
  if (required && !value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value || defaultValue;
};

const resolvePath = (rawPath: string): string => {
  if (rawPath.startsWith('~')) {
    return rawPath.replace('~', process.env.HOME || '');
  }
  return path.resolve(process.cwd(), rawPath);
};

// Get design system root - can be absolute or relative path
// Set DESIGN_SYSTEM_ROOT env var to point to your project's design system config
// Example: DESIGN_SYSTEM_ROOT=~/dev/DASH/ecw-ios/.design-system
const designSystemRootRaw = getEnvVar('DESIGN_SYSTEM_ROOT', false, './sample-config');
const designSystemRoot = resolvePath(designSystemRootRaw);

// Get Compose design system root (separate config for Android/Compose)
// Set DESIGN_SYSTEM_ROOT_COMPOSE env var for Jetpack Compose projects
// Example: DESIGN_SYSTEM_ROOT_COMPOSE=~/dev/android-app/.design-system
const designSystemRootComposeRaw = getEnvVar('DESIGN_SYSTEM_ROOT_COMPOSE', false, './sample-config-compose');
const designSystemRootCompose = resolvePath(designSystemRootComposeRaw);

export const config: Config = {
  figmaAccessToken: getEnvVar('FIGMA_ACCESS_TOKEN'),
  useMockFigma: getEnvVar('USE_MOCK_FIGMA', false, 'false') === 'true',
  designSystemRoot,
  designSystemRootCompose,
};
