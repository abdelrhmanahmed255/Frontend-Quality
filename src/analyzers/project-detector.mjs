import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Detects frontend framework, styling engine, and project architecture.
 * @param {string} rootDir
 * @returns {object}
 */
export async function detectProject(rootDir = process.cwd()) {
  const pkgPath = join(rootDir, "package.json");
  let pkg = {};
  if (existsSync(pkgPath)) {
    try {
      pkg = JSON.parse(await readFile(pkgPath, "utf-8"));
    } catch {
      // ignore parse error
    }
  }

  const allDeps = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
  };

  const isNext = Boolean(allDeps.next);
  const isVite = Boolean(allDeps.vite);
  const isRemix = Boolean(allDeps["@remix-run/react"]);
  const isVue = Boolean(allDeps.vue || allDeps.nuxt);
  const isReact = Boolean(allDeps.react) || isNext || isVite || isRemix;

  let framework = "Unknown";
  let routerType = "unknown";

  if (isNext) {
    framework = "Next.js";
    const hasAppRouter = existsSync(join(rootDir, "app")) || existsSync(join(rootDir, "src", "app"));
    const hasPagesRouter = existsSync(join(rootDir, "pages")) || existsSync(join(rootDir, "src", "pages"));
    if (hasAppRouter && hasPagesRouter) routerType = "hybrid";
    else if (hasAppRouter) routerType = "app-router";
    else if (hasPagesRouter) routerType = "pages-router";
  } else if (isRemix) {
    framework = "Remix";
  } else if (isVite) {
    framework = "Vite + React";
  } else if (isVue) {
    framework = "Vue";
  } else if (isReact) {
    framework = "React";
  }

  const isTypeScript = existsSync(join(rootDir, "tsconfig.json")) || Boolean(allDeps.typescript);
  const isTailwind = Boolean(
    allDeps.tailwindcss ||
    existsSync(join(rootDir, "tailwind.config.js")) ||
    existsSync(join(rootDir, "tailwind.config.ts")) ||
    existsSync(join(rootDir, "tailwind.config.mjs"))
  );

  return {
    name: pkg.name || "Frontend Project",
    version: pkg.version || "1.0.0",
    framework,
    routerType,
    isReact,
    isTypeScript,
    isTailwind,
    dependencies: Object.keys(pkg.dependencies || {}),
    devDependencies: Object.keys(pkg.devDependencies || {}),
  };
}
