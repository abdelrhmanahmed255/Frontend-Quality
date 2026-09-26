import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadConfig } from "../src/config-loader.mjs";
import { runFrontendAudit } from "../src/index.mjs";
import { resolveViewports } from "../src/analyzers/run-browser-audit.mjs";
import { DEFAULT_VIEWPORTS } from "../src/analyzers/browser-analyzer.mjs";

const cli = fileURLToPath(new URL("../bin/auditor.mjs", import.meta.url));

function makeProject(t, config) {
  const root = mkdtempSync(join(tmpdir(), "fqa-config-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const files = {
    "package.json": JSON.stringify({ name: "config-demo", dependencies: { "left-pad": "1" } }),
    "src/App.js": 'import { unused } from "./util";\nconsole.log("hi");\ndebugger;\n',
    "public/hero.png": Buffer.alloc(600 * 1024),
  };
  if (config) files["config/auditor.config.json"] = JSON.stringify(config);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

async function findingTypes(root) {
  const result = await runFrontendAudit(root);
  return new Set(result.issues.map((i) => i.type));
}

test("loadConfig keeps defaults for options the user leaves out", async (t) => {
  const root = makeProject(t, { rules: { maxComponentLines: 50 }, reporting: {} });
  const config = await loadConfig(root);

  assert.equal(config.rules.maxComponentLines, 50);
  assert.equal(config.rules.maxAssetSizeKB, 500);
  assert.equal(config.audit.assets, true);
  assert.equal(config.reporting.outputDir, "./audit-reports");
});

test("all checks run with the default config", async (t) => {
  const types = await findingTypes(makeProject(t));
  for (const type of ["console-log", "debugger", "unused-import", "production", "oversized-asset"]) {
    assert.ok(types.has(type), `expected a ${type} finding`);
  }
});

test("rule toggles turn off console, debugger, import, and dependency checks", async (t) => {
  const root = makeProject(t, {
    rules: { disallowConsole: false, disallowDebugger: false, checkUnusedImports: false, checkUnusedDeps: false },
  });
  const types = await findingTypes(root);

  assert.ok(!types.has("console-log"));
  assert.ok(!types.has("debugger"));
  assert.ok(!types.has("unused-import"));
  assert.ok(!types.has("production"));
  assert.ok(types.has("oversized-asset"));
});

test("audit category toggles skip whole analyzers", async (t) => {
  const root = makeProject(t, { audit: { codeQuality: false, assets: false, dependencies: false } });
  const types = await findingTypes(root);

  assert.ok(!types.has("debugger"));
  assert.ok(!types.has("oversized-asset"));
  assert.ok(!types.has("production"));
  assert.ok(types.has("unused-import"), "imports are controlled by rules.checkUnusedImports");
});

test("reporting.outputDir controls where the markdown report is written", (t) => {
  const root = makeProject(t, { reporting: { outputDir: "./reports/quality" } });

  execFileSync(process.execPath, [cli, "audit", root], { encoding: "utf-8" });

  assert.ok(existsSync(join(root, "reports", "quality", "FRONTEND_AUDIT_REPORT.md")));
  assert.ok(!existsSync(join(root, "audit-reports")));
});

test("resolveViewports uses configured widths and falls back to the defaults", () => {
  assert.deepEqual(resolveViewports(null), DEFAULT_VIEWPORTS);
  assert.deepEqual(resolveViewports([]), DEFAULT_VIEWPORTS);

  const custom = resolveViewports([375, 600]);
  assert.equal(custom.length, 2);
  assert.deepEqual(custom[0], DEFAULT_VIEWPORTS.find((v) => v.width === 375));
  assert.deepEqual(custom[1], { name: "600px", width: 600, height: 812 });
});
