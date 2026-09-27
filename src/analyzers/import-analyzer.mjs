import { readFile } from "node:fs/promises";

// Matches static import declarations that bind names, e.g.
//   import React, { useState, type FC } from "react";
//   import type { Props } from "./types";
//   import * as utils from "./utils";
// Side-effect imports (`import "./styles.css"`) bind nothing and are ignored.
const IMPORT_RE = /^[ \t]*import\s+(type\s+)?([\w$*{][\s\S]*?)\s*from\s*['"]([^'"]+)['"]/gm;

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Returns the local binding names declared by an import clause.
 * "React, { useState as useS, type FC }" -> ["React", "useS", "FC"]
 */
function parseImportBindings(clause) {
  const bindings = [];
  const braceStart = clause.indexOf("{");
  const head = braceStart === -1 ? clause : clause.slice(0, braceStart);

  for (const part of head.split(",")) {
    const binding = part.trim();
    if (!binding) continue;
    const namespace = binding.match(/^\*\s*as\s+([\w$]+)$/);
    if (namespace) bindings.push(namespace[1]);
    else if (/^[\w$]+$/.test(binding)) bindings.push(binding);
  }

  if (braceStart !== -1) {
    const inner = clause.slice(braceStart + 1, clause.lastIndexOf("}"));
    const withoutComments = inner.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    for (const part of withoutComments.split(",")) {
      const specifier = part.trim().replace(/^type\s+/, "");
      if (!specifier) continue;
      const pieces = specifier.split(/\s+as\s+/);
      const localName = pieces[pieces.length - 1].trim();
      if (/^[\w$]+$/.test(localName)) bindings.push(localName);
    }
  }

  return bindings;
}

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

  const imports = [...content.matchAll(IMPORT_RE)];
  if (imports.length === 0) return [];

  // Blank out every import declaration (keeping line breaks) so that a name only counts as
  // used when it appears in the rest of the file, not in another import statement.
  let body = content;
  for (const match of imports) {
    const blank = match[0].replace(/[^\n]/g, " ");
    body = body.slice(0, match.index) + blank + body.slice(match.index + match[0].length);
  }

  const unusedImports = [];
  for (const match of imports) {
    const clause = match[2];
    const sourceModule = match[3];
    const lineIndex = content.slice(0, match.index + match[0].search(/\S/)).split("\n").length;

    for (const name of parseImportBindings(clause)) {
      // The classic JSX transform needs React in scope even when it is never referenced.
      if (name === "React") continue;
      const identRegex = new RegExp(`(?<![\\w$])${escapeRegExp(name)}(?![\\w$])`);
      if (!identRegex.test(body)) {
        unusedImports.push({
          file: filePath,
          identifier: name,
          line: lineIndex,
          source: sourceModule,
        });
      }
    }
  }

  return unusedImports;
}
