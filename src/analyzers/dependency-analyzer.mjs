import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ALWAYS_RETAINED_DEPS = new Set([
  "react",
  "react-dom",
  "next",
  "vite",
  "tailwindcss",
  "postcss",
  "autoprefixer",
  "typescript",
  "@types/react",
  "@types/react-dom",
  "@types/node",
  "eslint",
  "prettier",
  "sharp",
  "cross-env",
]);

function collectSourceImports(dir, imports = new Set()) {
  if (!existsSync(dir)) return imports;
  const entries = readdirSync(dir);
  for (const entry of entries) {
    if (["node_modules", ".git", ".next", "dist", "build", "coverage"].includes(entry)) continue;
    const full = join(dir, entry);
    try {
      const s = statSync(full);
      if (s.isDirectory()) {
        collectSourceImports(full, imports);
      } else if (/\.(jsx?|tsx?|mjs|cjs|vue|svelte)$/.test(entry)) {
        const text = readFileSync(full, "utf-8");
        // match import ... from 'pkg' or require('pkg')
        const importMatches = text.matchAll(/(?:from|require\(|import\()\s*['"]([^'"./][^'"]*)['"]/g);
        for (const m of importMatches) {
          const raw = m[1];
          // Get root package name (e.g. @radix-ui/react-slot or lodash)
          const pkgName = raw.startsWith("@") ? raw.split("/").slice(0, 2).join("/") : raw.split("/")[0];
          imports.add(pkgName);
        }
      }
    } catch {
      // skip
    }
  }
  return imports;
}

/**
 * Analyzes package.json against project source code to find unused dependencies.
 * @param {string} rootDir
 * @returns {Array<{ name: string, status: string, confidence: string }>}
 */
export function analyzeDependencies(rootDir = process.cwd()) {
  const pkgPath = join(rootDir, "package.json");
  if (!existsSync(pkgPath)) return [];

  let pkg = {};
  try {
    pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
  } catch {
    return [];
  }

  const deps = Object.keys(pkg.dependencies || {});
  const devDeps = Object.keys(pkg.devDependencies || {});
  const usedImports = collectSourceImports(rootDir);

  const findings = [];

  for (const dep of deps) {
    if (ALWAYS_RETAINED_DEPS.has(dep)) continue;
    if (!usedImports.has(dep)) {
      findings.push({
        name: dep,
        type: "production",
        status: "Confirmed Unused",
        confidence: "High",
        recommendation: `Package '${dep}' is declared in dependencies but never imported in source files.`,
      });
    }
  }

  for (const devDep of devDeps) {
    if (ALWAYS_RETAINED_DEPS.has(devDep)) continue;
    if (!usedImports.has(devDep) && !devDep.startsWith("@types/") && !devDep.includes("plugin")) {
      findings.push({
        name: devDep,
        type: "dev",
        status: "Probably Unused",
        confidence: "Medium",
        recommendation: `Dev dependency '${devDep}' has no direct imports. Verify if it is used in CLI or config before removing.`,
      });
    }
  }

  return findings;
}
