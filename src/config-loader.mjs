import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const DEFAULT_CONFIG = {
  // Viewport widths for the browser audit (--url). null uses the built-in set.
  viewports: null,
  audit: {
    codeQuality: true,
    dependencies: true,
    assets: true,
  },
  rules: {
    maxComponentLines: 300,
    maxAssetSizeKB: 500,
    disallowConsole: true,
    disallowDebugger: true,
    checkUnusedImports: true,
    checkUnusedDeps: true,
  },
  fixes: {
    safeOnly: true,
  },
  reporting: {
    outputDir: "./audit-reports",
  },
};

const NESTED_SECTIONS = ["audit", "rules", "fixes", "reporting"];

export async function loadConfig(rootDir) {
  const configPath = join(rootDir, "config", "auditor.config.json");
  if (existsSync(configPath)) {
    try {
      const content = await readFile(configPath, "utf-8");
      const userConfig = JSON.parse(content);
      const merged = { ...DEFAULT_CONFIG, ...userConfig };
      for (const section of NESTED_SECTIONS) {
        merged[section] = { ...DEFAULT_CONFIG[section], ...userConfig[section] };
      }
      return merged;
    } catch {
      // Fallback to default on parse error
    }
  }
  return DEFAULT_CONFIG;
}
