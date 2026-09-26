import { readFileSync, writeFileSync } from "node:fs";

/**
 * Applies strictly safe code modifications:
 * 1. Removes console.log / console.debug lines.
 * 2. Removes debugger statements.
 * @param {Array<object>} codeSmells
 * @returns {{ filesModified: number, consoleLogsRemoved: number, debuggersRemoved: number }}
 */
export function applySafeFixes(codeSmells) {
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

  return { filesModified, consoleLogsRemoved, debuggersRemoved };
}
