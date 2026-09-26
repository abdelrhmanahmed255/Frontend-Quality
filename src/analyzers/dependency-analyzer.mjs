import { existsSync } from "node:fs";
import { readdir, stat, readFile } from "node:fs/promises";
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
  "@babel/core",
  "@babel/preset-env",
  "@babel/preset-react",
  "@babel/preset-typescript",
  "webpack",
  "esbuild",
  "rollup",
  "@vitejs/plugin-react",
  "@sveltejs/kit",
  "nuxt",
  "astro"
]);

async function collectSourceImports(dir, imports = new Set()) {
  if (!existsSync(dir)) return imports;
  try {
    const entries = await readdir(dir);
    await Promise.all(entries.map(async (entry) => {
      if (["node_modules", ".git", ".next", "dist", "build", "coverage"].includes(entry)) return;
      const full = join(dir, entry);
      try {
        const s = await stat(full);
        if (s.isDirectory()) {
          await collectSourceImports(full, imports);
        } else if (/\.(jsx?|tsx?|mjs|cjs|vue|svelte)$/.test(entry)) {
          const text = await readFile(full, "utf-8");
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
    }));
  } catch {
    // skip
  }
  return imports;
}

/**
 * Analyzes package.json against project source code to find unused dependencies.
 * @param {string} rootDir
 * @returns {Array<{ name: string, status: string, confidence: string }>}
 */
export async function analyzeDependencies(rootDir = process.cwd()) {
  const pkgPath = join(rootDir, "package.json");
  if (!existsSync(pkgPath)) return [];

  let pkg = {};
  try {
    pkg = JSON.parse(await readFile(pkgPath, "utf-8"));
  } catch {
    return [];
  }

  const deps = Object.keys(pkg.dependencies || {});
  const devDeps = Object.keys(pkg.devDependencies || {});
  const usedImports = await collectSourceImports(rootDir);

  const findings = [];

  for (const dep of deps) {
    if (ALWAYS_RETAINED_DEPS.has(dep)) continue;
    if (!usedImports.has(dep)) {
      findings.push({
        name: dep,
        type: "production",
        status: "Confirmed Unused",
        confidence: "High",
        problem: `Package '${dep}' is listed in dependencies but has no imports in the codebase.`,
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
        problem: `Dev package '${devDep}' appears to have no direct imports.`,
        recommendation: `Dev dependency '${devDep}' has no direct imports. Verify if it is used in CLI or config before removing.`,
      });
    }
  }

  return findings;
}
