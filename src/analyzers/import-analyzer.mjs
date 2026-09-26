import { readFile } from "node:fs/promises";

/**
 * Parses ES imports and checks for unreferenced identifiers in file content.
 * @param {string} filePath
 * @returns {Array<{ identifier: string, line: number, source: string }>}
 */
export async function analyzeFileImports(filePath) {
  let content = "";
  try {
    content = await readFile(filePath, "utf-8");
  } catch {
    return [];
  }

  const lines = content.split("\n");
  const unusedImports = [];
  const importRe = /import\s+(?:(?:\*\s+as\s+([a-zA-Z0-9_$]+))|(?:([a-zA-Z0-9_$]+))|(?:\s*\{([^}]+)\}))\s+from\s+['"]([^'"]+)['"]/g;

  let match;
  while ((match = importRe.exec(content)) !== null) {
    const defaultImport = match[1] || match[2];
    const namedImports = match[3];
    const sourceModule = match[4];
    const fullMatch = match[0];

    // Find line number
    const lineIndex = content.substring(0, match.index).split("\n").length;

    // 1. Check default import
    if (defaultImport) {
      const name = defaultImport.trim();
      if (name && name !== "React") {
        // Strip the import declaration itself and test rest of the file
        const bodyContent = content.replace(fullMatch, "");
        const identRegex = new RegExp(`\\b${name}\\b`);
        if (!identRegex.test(bodyContent)) {
          unusedImports.push({
            file: filePath,
            identifier: name,
            line: lineIndex,
            source: sourceModule,
          });
        }
      }
    }

    // 2. Check named imports { a, b as c }
    if (namedImports) {
      const parts = namedImports.split(",");
      for (const part of parts) {
        const clean = part.trim();
        if (!clean) continue;
        const localName = clean.includes(" as ") ? clean.split(" as ")[1].trim() : clean;
        const bodyContent = content.replace(fullMatch, "");
        const identRegex = new RegExp(`\\b${localName}\\b`);
        if (!identRegex.test(bodyContent)) {
          unusedImports.push({
            file: filePath,
            identifier: localName,
            line: lineIndex,
            source: sourceModule,
          });
        }
      }
    }
  }

  return unusedImports;
}
