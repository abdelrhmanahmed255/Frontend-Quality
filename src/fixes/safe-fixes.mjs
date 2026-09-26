import { readFileSync, writeFileSync } from "node:fs";
import { blankStringsAndComments } from "../utils/safe-string-search.mjs";

/**
 * Returns the local binding name of an import specifier ("a as b" -> "b", "type T" -> "T").
 */
function localImportName(specifier) {
  const clean = specifier.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "").trim();
  const withoutType = clean.replace(/^type\s+/, "");
  const parts = withoutType.split(/\s+as\s+/);
  return parts[parts.length - 1].trim();
}

/**
 * Drops the unused bindings from a single import statement.
 * Aliased specifiers ("a as b") and inline type specifiers are removed as a whole so the
 * remaining statement stays valid. When no binding is left, the statement is removed.
 *
 * @param {string} statement Full import statement text (may span several lines)
 * @param {Set<string>} unusedNames Local binding names that should be removed
 * @returns {{ text: string | null, removed: number } | null} null when the statement is not a supported import
 */
function rewriteImportStatement(statement, unusedNames) {
  const match = statement.match(/^(\s*)import\s+(type\s+)?([\s\S]*?)\s*from\s*(['"][^'"]+['"])([\s\S]*)$/);
  if (!match) return null;
  const [, indent, typeKeyword = "", clause, source, rest] = match;

  let removed = 0;
  const kept = [];

  const braceStart = clause.indexOf("{");
  const head = braceStart === -1 ? clause : clause.slice(0, braceStart);
  for (const part of head.split(",")) {
    const binding = part.trim();
    if (!binding) continue;
    if (unusedNames.has(localImportName(binding))) removed++;
    else kept.push(binding);
  }

  if (braceStart !== -1) {
    const braceEnd = clause.lastIndexOf("}");
    const inner = clause.slice(braceStart + 1, braceEnd);
    const keptSegments = inner.split(",").filter((segment) => {
      if (!segment.trim()) return true; // whitespace after a trailing comma
      if (unusedNames.has(localImportName(segment))) {
        removed++;
        return false;
      }
      return true;
    });
    if (keptSegments.some((segment) => segment.trim())) {
      let newInner = keptSegments.join(",");
      const trailingSpace = inner.match(/\s*$/)[0];
      if (!/\s$/.test(newInner) && trailingSpace) newInner += trailingSpace;
      kept.push(`{${newInner}}`);
    }
  }

  if (removed === 0) return { text: statement, removed };
  if (kept.length === 0) {
    const trailingCode = rest.replace(/^\s*;/, "").trim();
    return { text: trailingCode ? indent + trailingCode : null, removed };
  }
  return { text: `${indent}import ${typeKeyword}${kept.join(", ")} from ${source}${rest}`, removed };
}

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
      if (!issuesByLine.has(issue.line)) issuesByLine.set(issue.line, new Set());
      issuesByLine.get(issue.line).add(localImportName(issue.identifier));
    }

    for (const [lineNum, unusedNames] of issuesByLine.entries()) {
      const idx = lineNum - 1;
      if (idx < 0 || idx >= lines.length || lines[idx] === null) continue;

      // An import statement can span several lines; collect it up to its `from '...'` clause.
      let endIdx = idx;
      let statement = lines[idx];
      while (!/\bfrom\s*['"][^'"]*['"]/.test(statement) && endIdx + 1 < lines.length && endIdx - idx < 50) {
        endIdx++;
        statement += "\n" + lines[endIdx];
      }

      const result = rewriteImportStatement(statement, unusedNames);
      if (!result || result.removed === 0) continue;

      importsRemoved += result.removed;
      changed = true;
      lines[idx] = result.text;
      for (let i = idx + 1; i <= endIdx; i++) lines[i] = null;
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
 * @param {Array<object>} codeSmells
 * @param {Array<object>} importIssues
 * @param {object} options
 * @returns {{ filesModified: number, consoleLogsRemoved: number, debuggersRemoved: number, importsRemoved: number }}
 */
export function applySafeFixes(codeSmells, importIssues = [], options = {}) {
  const isDryRun = options.dryRun === true;
  
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
      // Skip lines that start with comments
      if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) {
        return true;
      }

      const blankedLine = blankStringsAndComments(trimmed);

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
