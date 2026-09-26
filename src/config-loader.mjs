import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const DEFAULT_CONFIG = {
  rules: {
    maxComponentLines: 300,
    maxAssetSizeKB: 500,
  }
};

export async function loadConfig(rootDir) {
  const configPath = join(rootDir, "config", "auditor.config.json");
  if (existsSync(configPath)) {
    try {
      const content = await readFile(configPath, "utf-8");
      const userConfig = JSON.parse(content);
      return {
        ...DEFAULT_CONFIG,
        ...userConfig,
        rules: {
          ...DEFAULT_CONFIG.rules,
          ...userConfig.rules,
        }
      };
    } catch {
      // Fallback to default on parse error
    }
  }
  return DEFAULT_CONFIG;
}
