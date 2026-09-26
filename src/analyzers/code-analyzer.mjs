import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

function findSourceFiles(dir, files = []) {
  if (!existsSync(dir)) return files;
  const entries = readdirSync(dir);
  for (const entry of entries) {
    if (["node_modules", ".git", ".next", "dist", "build", "coverage"].includes(entry)) continue;
    const full = join(dir, entry);
    try {
      const s = statSync(full);
      if (s.isDirectory()) {
        findSourceFiles(full, files);
      } else if (/\.(jsx?|tsx?|mjs|cjs)$/.test(entry)) {
        files.push(full);
      }
    } catch {
      // skip
    }
  }
  return files;
}

/**
 * Scans JavaScript and TypeScript source files for code hygiene smells.
 * @param {string} rootDir
 * @returns {Array<object>}
 */
export function analyzeCodeQuality(rootDir = process.cwd()) {
  const sourceFiles = findSourceFiles(rootDir);
  const findings = [];

  for (const file of sourceFiles) {
    const relPath = relative(rootDir, file).replace(/\\/g, "/");
    let content = "";
    try {
      content = readFileSync(file, "utf-8");
    } catch {
      continue;
    }

    const lines = content.split("\n");

    // 1. Monster Component Check (> 300 lines)
    if (lines.length > 300) {
      findings.push({
        type: "monster-component",
        severity: "P2",
        file: relPath,
        line: 1,
        confidence: "High",
        problem: `File contains ${lines.length} lines of code.`,
        recommendation: `Consider breaking down this component into smaller subcomponents or extracting business logic into custom hooks.`,
      });
    }

    // Line-by-line inspection
    lines.forEach((lineText, idx) => {
      const lineNum = idx + 1;
      const trimmed = lineText.trim();

      // Skip commented lines
      if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) return;

      // 2. console.log / console.debug detection
      if (/\bconsole\.(log|debug|info)\(/.test(trimmed)) {
        findings.push({
          type: "console-log",
          severity: "P3",
          file: relPath,
          line: lineNum,
          confidence: "High",
          problem: `Active console logging: '${trimmed.substring(0, 60)}...'`,
          recommendation: `Remove debugging console statements before shipping to production to avoid performance and privacy leaks.`,
        });
      }

      // 3. debugger statements
      if (/\bdebugger;?/.test(trimmed)) {
        findings.push({
          type: "debugger",
          severity: "P1",
          file: relPath,
          line: lineNum,
          confidence: "High",
          problem: `Active debugger statement detected.`,
          recommendation: `Remove 'debugger' breakpoint before production deployment.`,
        });
      }

      // 4. Hardcoded localhost URLs
      if (/https?:\/\/localhost:\d+/.test(trimmed)) {
        findings.push({
          type: "hardcoded-localhost",
          severity: "P1",
          file: relPath,
          line: lineNum,
          confidence: "High",
          problem: `Hardcoded localhost URL detected: '${trimmed.substring(0, 50)}'`,
          recommendation: `Extract local URLs to environment variables (e.g. process.env.NEXT_PUBLIC_API_URL).`,
        });
      }

      // 5. Empty Click Handlers
      if (/onClick=\{(\s*\(\)\s*=>\s*\{\s*\}|\s*\(\)\s*=>\s*undefined\s*)\}/.test(trimmed)) {
        findings.push({
          type: "empty-handler",
          severity: "P3",
          file: relPath,
          line: lineNum,
          confidence: "Medium",
          problem: `Empty onClick handler detected.`,
          recommendation: `Provide a meaningful handler or disable the button if the feature is not yet implemented.`,
        });
      }
    });
  }

  return findings;
}
