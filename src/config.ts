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

export const config: Config = {
  figmaAccessToken: getEnvVar('FIGMA_ACCESS_TOKEN'),
  useMockFigma: getEnvVar('USE_MOCK_FIGMA', false, 'false') === 'true',
  designSystemRoot: path.resolve(process.cwd(), getEnvVar('DESIGN_SYSTEM_ROOT', false, '../../Modules/DesignSystem')),
};
