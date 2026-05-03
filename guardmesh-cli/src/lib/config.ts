import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

export interface GuardMeshConfig {
  rpcUrl?: string;
  registryAddress?: string;
  auditAddress?: string;
  apiUrl?: string;
  guardians?: string[];
  privateKey?: string;
}

export function loadConfig(): GuardMeshConfig {
  // Try to load from local .env first
  const localConfig: GuardMeshConfig = {
    rpcUrl: process.env.RPC_URL,
    registryAddress: process.env.REGISTRY_ADDRESS,
    auditAddress: process.env.AUDIT_ADDRESS,
    apiUrl: process.env.API_URL,
    privateKey: process.env.PRIVATE_KEY,
  };

  // Try to load from global config
  const configPath = getConfigPath();
  if (fs.existsSync(configPath)) {
    try {
      const globalConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return { ...globalConfig, ...localConfig };
    } catch (error) {
      // Ignore errors, use local config only
    }
  }

  return localConfig;
}

export function saveConfig(config: GuardMeshConfig): void {
  const configPath = getConfigPath();
  const configDir = path.dirname(configPath);

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

export function getConfigPath(): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  return path.join(homeDir, '.guardmesh', 'config.json');
}
