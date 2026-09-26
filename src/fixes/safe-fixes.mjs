import { readFileSync, writeFileSync } from "node:fs";
import { blankStringsAndComments } from "../utils/safe-string-search.mjs";

export function removeUnusedImports(importIssues, options = {}) {
  const isDryRun = options.dryRun === true;
  if (!importIssues || importIssues.length === 0) return 0;
  
  const filesMap = new Map();
  for (const issue of importIssues) {
    if (!issue.file || !issue.identifier || !issue.line) continue;
    if (!filesMap.has(issue.file)) filesMap.set(issue.file, []);
    filesMap.get(issue.file).push(issue);
  }

  let importsRemoved = 0;

  for (const [filePath, issues] of filesMap.entries()) {
    let content = "";
    try {
      content = readFileSync(filePath, "utf-8");
    } catch {
      continue;
    }

    const lines = content.split("\n");
    let changed = false;
    
    const issuesByLine = new Map();
    for (const issue of issues) {
      if (!issuesByLine.has(issue.line)) issuesByLine.set(issue.line, []);
      issuesByLine.get(issue.line).push(issue.identifier);
    }
    
    for (const [lineNum, identifiers] of issuesByLine.entries()) {
      const idx = lineNum - 1;
      if (idx < 0 || idx >= lines.length) continue;
      
      let lineText = lines[idx];
      
      for (const identifier of identifiers) {
        let blankedLine = blankStringsAndComments(lineText);
        const regex = new RegExp(`\\b${identifier}\\b\\s*,?`, '');
        const match = blankedLine.match(regex);
        
        if (match) {
          const start = match.index;
          const length = match[0].length;
          // Safely remove the exact matched bounds from the original text
          lineText = lineText.slice(0, start) + lineText.slice(start + length);
          
          lineText = lineText.replace(/,\s*,/g, ',');
          lineText = lineText.replace(/{\s*,/g, '{');
          lineText = lineText.replace(/,\s*}/g, '}');
          lineText = lineText.replace(/{\s*}/g, '');
          lineText = lineText.replace(/,\s*from/g, ' from');
          lineText = lineText.replace(/import\s*,\s*{/g, 'import {');
          lineText = lineText.replace(/import\s*,\s*/g, 'import ');
          
          importsRemoved++;
          changed = true;
        }
      }
      
      if (/^import\s+(from\s+)?['"]/.test(lineText.trim())) {
        lines[idx] = null;
      } else {
        lines[idx] = lineText;
      }
    }

    if (changed && !isDryRun) {
      const finalLines = lines.filter(l => l !== null);
      writeFileSync(filePath, finalLines.join("\n"), "utf-8");
    }
  }

  return importsRemoved;
}

/**
 * Applies strictly safe code modifications:
 * 1. Removes console.log / console.debug lines.
 * 2. Removes debugger statements.
 * Only lines the audit reported as `console-log` or `debugger` findings are touched, so
 * files and lines the analyzer deliberately skips (CLI entrypoints, reporters) stay intact.
 * @param {Array<object>} codeSmells
 * @param {Array<object>} importIssues
 * @param {object} options
 * @returns {{ filesModified: number, consoleLogsRemoved: number, debuggersRemoved: number, importsRemoved: number }}
 */
export function applySafeFixes(codeSmells, importIssues = [], options = {}) {
  const isDryRun = options.dryRun === true;
  
  // Group flagged line numbers by file
  const filesMap = new Map();
  for (const smell of codeSmells) {
    if (!smell.file || !smell.line) continue;
    if (smell.type !== "console-log" && smell.type !== "debugger") continue;
    if (!filesMap.has(smell.file)) filesMap.set(smell.file, new Set());
    filesMap.get(smell.file).add(smell.line);
  }

  let filesModified = 0;
  let consoleLogsRemoved = 0;
  let debuggersRemoved = 0;

  for (const [filePath, smells] of filesMap.entries()) {
    let content = "";
    try {
      content = readFileSync(filePath, "utf-8");
    } catch {
      continue;
    }

    const lines = content.split("\n");
    let changed = false;

    // Filter out the flagged debugger and console.log lines
    const newLines = lines.filter((line, idx) => {
      if (!smells.has(idx + 1)) return true; // smells holds the flagged line numbers

      const trimmed = line.trim();
      // Skip lines that start with comments
      if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) {
        return true;
      }

      // trimEnd() so a trailing comment (blanked to spaces) does not block the match
      const blankedLine = blankStringsAndComments(trimmed).trimEnd();

      if (/^debugger;?$/.test(blankedLine)) {
        debuggersRemoved++;
        changed = true;
        return false;
      }

      if (/^console\.(log|debug|info)\([^;)]*\);?$/.test(blankedLine)) {
        consoleLogsRemoved++;
        changed = true;
        return false;
      }

      return true;
    });

    if (changed) {
      if (!isDryRun) {
        writeFileSync(filePath, newLines.join("\n"), "utf-8");
      }
      filesModified++;
    }
  }

  const importsRemoved = removeUnusedImports(importIssues, options);

  return { filesModified, consoleLogsRemoved, debuggersRemoved, importsRemoved };
}
