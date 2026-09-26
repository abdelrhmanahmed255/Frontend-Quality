import { detectProject } from "./analyzers/project-detector.mjs";
import { discoverRoutes } from "./analyzers/route-discovery.mjs";
import { analyzeDependencies } from "./analyzers/dependency-analyzer.mjs";
import { analyzeAssets } from "./analyzers/asset-analyzer.mjs";
import { analyzeCodeQuality } from "./analyzers/code-analyzer.mjs";
import { printTerminalReport } from "./reporters/terminal.mjs";
import { generateMarkdownReport } from "./reporters/markdown.mjs";
import { formatJsonReport } from "./reporters/json.mjs";
import { applySafeFixes } from "./fixes/safe-fixes.mjs";

/**
 * Runs a complete audit on a frontend directory.
 * @param {string} rootDir
 * @returns {object}
 */
export async function runFrontendAudit(rootDir = process.cwd()) {
  const project = detectProject(rootDir);
  const routes = discoverRoutes(rootDir, project);
  const depIssues = analyzeDependencies(rootDir);
  const assetIssues = analyzeAssets(rootDir);
  const codeIssues = analyzeCodeQuality(rootDir);

  const allIssues = [
    ...codeIssues.map(i => ({ category: "Code Quality", ...i })),
    ...depIssues.map(i => ({ category: "Dependencies", severity: "P2", ...i })),
    ...assetIssues.map(i => ({ category: "Assets", ...i })),
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
