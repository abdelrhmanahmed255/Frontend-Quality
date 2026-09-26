import { existsSync } from "node:fs";
import { readdir, stat, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

/**
 * Traverses directories recursively to find page files.
 */
async function findFiles(dir, matchRe, fileList = []) {
  if (!existsSync(dir)) return fileList;
  try {
    const entries = await readdir(dir);
    await Promise.all(entries.map(async (entry) => {
      if (["node_modules", ".git", ".next", "dist", "build"].includes(entry)) return;
      const fullPath = join(dir, entry);
      try {
        const s = await stat(fullPath);
        if (s.isDirectory()) {
          await findFiles(fullPath, matchRe, fileList);
        } else if (matchRe.test(entry)) {
          fileList.push(fullPath);
        }
      } catch {
        // skip unreadable
      }
    }));
  } catch {
    // skip unreadable
  }
  return fileList;
}

/**
 * Discovers frontend application routes from file structure or router configs.
 * @param {string} rootDir
 * @param {object} projectInfo
 * @returns {Array<string>}
 */
export async function discoverRoutes(rootDir = process.cwd(), projectInfo = {}) {
  const routes = new Set(["/"]);

  // 1. Next.js App Router (app/ or src/app/)
  const appDir = existsSync(join(rootDir, "src", "app"))
    ? join(rootDir, "src", "app")
    : existsSync(join(rootDir, "app"))
    ? join(rootDir, "app")
    : null;

  if (appDir) {
    const pageFiles = await findFiles(appDir, /^page\.(jsx?|tsx?)$/);
    for (const file of pageFiles) {
      const rel = relative(appDir, file).replace(/\\/g, "/");
      let routePath = "/" + rel.replace(/\/page\.(jsx?|tsx?)$/, "").replace(/^page\.(jsx?|tsx?)$/, "");
      // Remove route groups like (marketing)
      routePath = routePath.replace(/\/\([^)]+\)/g, "");
      // Normalize dynamic params [id] -> :id
      routePath = routePath.replace(/\[([^\]]+)\]/g, ":$1");
      routes.add(routePath || "/");
    }
  }

  // 2. Next.js Pages Router (pages/ or src/pages/)
  const pagesDir = existsSync(join(rootDir, "src", "pages"))
    ? join(rootDir, "src", "pages")
    : existsSync(join(rootDir, "pages"))
    ? join(rootDir, "pages")
    : null;

  if (pagesDir) {
    const pageFiles = await findFiles(pagesDir, /\.(jsx?|tsx?)$/);
    for (const file of pageFiles) {
      const rel = relative(pagesDir, file).replace(/\\/g, "/");
      if (rel.startsWith("_app") || rel.startsWith("_document") || rel.startsWith("api/")) continue;
      let routePath = "/" + rel.replace(/\.(jsx?|tsx?)$/, "").replace(/\/index$/, "");
      routePath = routePath.replace(/\[([^\]]+)\]/g, ":$1");
      routes.add(routePath || "/");
    }
  }

  // 3. React Router scan in src/
  const srcDir = existsSync(join(rootDir, "src")) ? join(rootDir, "src") : rootDir;
  const routerFiles = await findFiles(srcDir, /(App|routes?|router)\.(jsx?|tsx?)$/);
  for (const file of routerFiles) {
    try {
      const content = await readFile(file, "utf-8");
      const pathMatches = content.matchAll(/path=["']([^"']+)["']/g);
      for (const m of pathMatches) {
        if (m[1] && !m[1].includes("*")) routes.add(m[1].startsWith("/") ? m[1] : "/" + m[1]);
      }
    } catch {
      // ignore
    }
  }

  return Array.from(routes).sort();
}
