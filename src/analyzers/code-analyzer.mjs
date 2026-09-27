import { existsSync } from "node:fs";
import { readdir, stat, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { blankStringsAndComments } from "../utils/safe-string-search.mjs";

export async function findSourceFiles(dir, files = []) {
  if (!existsSync(dir)) return files;
  try {
    const entries = await readdir(dir);
    await Promise.all(entries.map(async (entry) => {
      if (["node_modules", ".git", ".next", "dist", "build", "coverage"].includes(entry)) return;
      const full = join(dir, entry);
      try {
        const s = await stat(full);
        if (s.isDirectory()) {
          await findSourceFiles(full, files);
        } else if (/\.(jsx?|tsx?|mjs|cjs)$/.test(entry)) {
          files.push(full);
        }
      } catch {
        // skip
      }
    }));
  } catch {
    // skip
  }
  return files;
}

/**
 * Scans JavaScript and TypeScript source files for code hygiene smells.
 * @param {string} rootDir
 * @returns {Array<object>}
 */
export async function analyzeCodeQuality(rootDir = process.cwd(), options = {}) {
  const maxLines = options.maxComponentLines || 300;
  const sourceFiles = await findSourceFiles(rootDir);
  const findings = [];

  await Promise.all(sourceFiles.map(async (file) => {
    const relPath = relative(rootDir, file).replace(/\\/g, "/");
    let content = "";
    try {
      content = await readFile(file, "utf-8");
    } catch {
      return;
    }

    const lines = content.split("\n");

    // 1. Monster Component Check
    if (lines.length > maxLines) {
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

    // Same text with string literals and comments replaced by spaces, so code patterns
    // are only matched in actual code (line numbers and columns stay aligned).
    const codeLines = blankStringsAndComments(content).split("\n");

    // Line-by-line inspection
    lines.forEach((lineText, idx) => {
      const lineNum = idx + 1;
      const trimmed = lineText.trim();
      const code = (codeLines[idx] || "").trim();

      // Skip commented lines
      if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) return;

      // 2. console.log / console.debug detection (skip CLI entrypoints and reporters)
      const isCliOrReporter = relPath.startsWith("bin/") || relPath.includes("reporters/");
      if (!isCliOrReporter && /\bconsole\.(log|debug|info)\(/.test(code)) {
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
      if (/^\s*debugger\s*;?\s*$/.test(code)) {
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
      if (/onClick=\{(\s*\(\)\s*=>\s*\{\s*\}|\s*\(\)\s*=>\s*undefined\s*)\}/.test(code)) {
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
  }));

  return findings;
}
