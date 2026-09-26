import { relative } from "node:path";
import { detectProject } from "./analyzers/project-detector.mjs";
import { discoverRoutes } from "./analyzers/route-discovery.mjs";
import { analyzeDependencies } from "./analyzers/dependency-analyzer.mjs";
import { analyzeAssets } from "./analyzers/asset-analyzer.mjs";
import { analyzeCodeQuality, findSourceFiles } from "./analyzers/code-analyzer.mjs";
import { analyzeFileImports } from "./analyzers/import-analyzer.mjs";
import { runBrowserAudit } from "./analyzers/run-browser-audit.mjs";
import { loadConfig } from "./config-loader.mjs";
import { printTerminalReport } from "./reporters/terminal.mjs";
import { generateMarkdownReport } from "./reporters/markdown.mjs";
import { formatJsonReport } from "./reporters/json.mjs";
import { applySafeFixes } from "./fixes/safe-fixes.mjs";

/**
 * Runs a complete audit on a frontend directory.
 * @param {string} rootDir
 * @param {object} options Options for the audit (e.g., options.url)
 * @returns {object}
 */
export async function runFrontendAudit(rootDir = process.cwd(), options = {}) {
  const config = await loadConfig(rootDir);
  const project = await detectProject(rootDir);
  const routes = await discoverRoutes(rootDir, project);

  const [depIssues, assetIssues, codeIssues, sourceFiles, browserIssues] = await Promise.all([
    analyzeDependencies(rootDir),
    analyzeAssets(rootDir, { maxAssetSizeKB: config.rules.maxAssetSizeKB }),
    analyzeCodeQuality(rootDir, { maxComponentLines: config.rules.maxComponentLines }),
    findSourceFiles(rootDir),
    options.url ? runBrowserAudit(options.url) : Promise.resolve([])
  ]);

  const importIssuesResults = await Promise.all(
    sourceFiles.map(file => analyzeFileImports(file))
  );
  
  const importIssues = [];
  for (const issues of importIssuesResults) {
    if (issues && issues.length > 0) {
      importIssues.push(...issues);
    }
  }

  const allIssues = [
    ...codeIssues.map(i => ({ category: "Code Quality", ...i })),
    ...depIssues.map(i => ({ category: "Dependencies", severity: "P2", ...i })),
    ...assetIssues.map(i => ({ category: "Assets", ...i })),
    ...browserIssues,
    ...importIssues.map(i => ({
      category: "Imports",
      severity: "P2",
      type: "unused-import",
      file: relative(rootDir, i.file).replace(/\\/g, "/"),
      line: i.line,
      confidence: "High",
      problem: `Unused import '${i.identifier}' from '${i.source}'.`,
      recommendation: `Remove the unused import to keep the file clean and reduce bundle noise.`,
    })),
  ];

  // Calculate severity counts
  let p0 = 0, p1 = 0, p2 = 0, p3 = 0;
  for (const i of allIssues) {
    if (i.severity === "P0") p0++;
    else if (i.severity === "P1") p1++;
    else if (i.severity === "P2") p2++;
    else p3++;
  }

  // Derive quick wins
  const quickWins = [];
  const logsCount = allIssues.filter(i => i.type === "console-log").length;
  if (logsCount > 0) quickWins.push(`Remove ${logsCount} active console.log statement(s).`);

  const debuggers = allIssues.filter(i => i.type === "debugger").length;
  if (debuggers > 0) quickWins.push(`Remove ${debuggers} active debugger breakpoint(s).`);

  const unusedDeps = allIssues.filter(i => i.status === "Confirmed Unused").length;
  if (unusedDeps > 0) quickWins.push(`Uninstall ${unusedDeps} confirmed unused package(s) from package.json.`);

  const largeAssets = allIssues.filter(i => i.type === "oversized-asset").length;
  if (largeAssets > 0) quickWins.push(`Compress or convert ${largeAssets} oversized image(s) to WebP/AVIF.`);

  const unusedImports = allIssues.filter(i => i.type === "unused-import").length;
  if (unusedImports > 0) quickWins.push(`Remove ${unusedImports} unused import(s) across the codebase.`);

  return {
    project: {
      ...project,
      routesCount: routes.length,
    },
    routes,
    summary: {
      total: allIssues.length,
      p0,
      p1,
      p2,
      p3,
    },
    quickWins,
    issues: allIssues,
  };
}

export {
  printTerminalReport,
  generateMarkdownReport,
  formatJsonReport,
  applySafeFixes,
};
