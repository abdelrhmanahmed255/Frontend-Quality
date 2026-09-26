import { existsSync, readdirSync, statSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Traverses directories recursively to find page files.
 */
function findFiles(dir, matchRe, fileList = []) {
  if (!existsSync(dir)) return fileList;
  const entries = readdirSync(dir);
  for (const entry of entries) {
    if (["node_modules", ".git", ".next", "dist", "build"].includes(entry)) continue;
    const fullPath = join(dir, entry);
    try {
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        findFiles(fullPath, matchRe, fileList);
      } else if (matchRe.test(entry)) {
        fileList.push(fullPath);
      }
    } catch {
      // skip unreadable
    }
  }
  return fileList;
}

/**
 * Discovers frontend application routes from file structure or router configs.
 * @param {string} rootDir
 * @param {object} projectInfo
 * @returns {Array<string>}
 */
export function discoverRoutes(rootDir = process.cwd(), projectInfo = {}) {
  const routes = new Set(["/"]);

  // 1. Next.js App Router (app/ or src/app/)
  const appDir = existsSync(join(rootDir, "src", "app"))
    ? join(rootDir, "src", "app")
    : existsSync(join(rootDir, "app"))
    ? join(rootDir, "app")
    : null;

  if (appDir) {
    const pageFiles = findFiles(appDir, /^page\.(jsx?|tsx?)$/);
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
    const pageFiles = findFiles(pagesDir, /\.(jsx?|tsx?)$/);
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
  const routerFiles = findFiles(srcDir, /(App|routes?|router)\.(jsx?|tsx?)$/);
  for (const file of routerFiles) {
    try {
      const content = readFileSync(file, "utf-8");
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
