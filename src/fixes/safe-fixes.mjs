import { readFileSync, writeFileSync } from "node:fs";

export function removeUnusedImports(importIssues) {
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
        const before = lineText;
        const regex = new RegExp(`\\b${identifier}\\b\\s*,?`, '');
        lineText = lineText.replace(regex, '');
        
        lineText = lineText.replace(/,\s*,/g, ',');
        lineText = lineText.replace(/{\s*,/g, '{');
        lineText = lineText.replace(/,\s*}/g, '}');
        lineText = lineText.replace(/{\s*}/g, '');
        lineText = lineText.replace(/,\s*from/g, ' from');
        lineText = lineText.replace(/import\s*,\s*{/g, 'import {');
        lineText = lineText.replace(/import\s*,\s*/g, 'import ');
        
        if (before !== lineText) {
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

    if (changed) {
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
 * @param {Array<object>} codeSmells
 * @param {Array<object>} importIssues
 * @returns {{ filesModified: number, consoleLogsRemoved: number, debuggersRemoved: number, importsRemoved: number }}
 */
export function applySafeFixes(codeSmells, importIssues = []) {
  // Group by file
  const filesMap = new Map();
  for (const smell of codeSmells) {
    if (!smell.file) continue;
    if (!filesMap.has(smell.file)) filesMap.set(smell.file, []);
    filesMap.get(smell.file).push(smell);
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

    // Filter out debugger lines and console.log lines
    const newLines = lines.filter((line) => {
      const trimmed = line.trim();
      // Skip commented lines
      if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) {
        return true;
      }

      if (/^debugger;?$/.test(trimmed)) {
        debuggersRemoved++;
        changed = true;
        return false;
      }

      if (/^console\.(log|debug|info)\([^;)]*\);?$/.test(trimmed)) {
        consoleLogsRemoved++;
        changed = true;
        return false;
      }

      return true;
    });

    if (changed) {
      writeFileSync(filePath, newLines.join("\n"), "utf-8");
      filesModified++;
    }
  }

  const importsRemoved = removeUnusedImports(importIssues);

  return { filesModified, consoleLogsRemoved, debuggersRemoved, importsRemoved };
}
