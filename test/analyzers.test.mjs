import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { detectProject } from "../src/analyzers/project-detector.mjs";
import { discoverRoutes } from "../src/analyzers/route-discovery.mjs";
import { analyzeDependencies } from "../src/analyzers/dependency-analyzer.mjs";
import { analyzeCodeQuality } from "../src/analyzers/code-analyzer.mjs";
import { analyzeFileImports } from "../src/analyzers/import-analyzer.mjs";
import { analyzeAssets } from "../src/analyzers/asset-analyzer.mjs";

function makeProject(t, files) {
  const root = mkdtempSync(join(tmpdir(), "fqa-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

test("detectProject recognizes a Next.js App Router project with TypeScript and Tailwind", async (t) => {
  const root = makeProject(t, {
    "package.json": JSON.stringify({ name: "shop", dependencies: { next: "15", react: "19" }, devDependencies: { tailwindcss: "4" } }),
    "tsconfig.json": "{}",
    "app/page.tsx": "export default function Page() { return null; }",
  });

  const project = await detectProject(root);
  assert.equal(project.name, "shop");
  assert.equal(project.framework, "Next.js");
  assert.equal(project.routerType, "app-router");
  assert.equal(project.isTypeScript, true);
  assert.equal(project.isTailwind, true);
});

test("discoverRoutes maps App Router pages, route groups, and dynamic segments", async (t) => {
  const root = makeProject(t, {
    "package.json": JSON.stringify({ dependencies: { next: "15" } }),
    "app/page.tsx": "",
    "app/about/page.tsx": "",
    "app/(marketing)/pricing/page.tsx": "",
    "app/blog/[slug]/page.tsx": "",
  });

  const routes = await discoverRoutes(root, {});
  assert.deepEqual(routes, ["/", "/about", "/blog/:slug", "/pricing"]);
});

test("discoverRoutes maps Pages Router files and skips _app and api routes", async (t) => {
  const root = makeProject(t, {
    "pages/blog/index.jsx": "",
    "pages/contact.jsx": "",
    "pages/_app.jsx": "",
    "pages/api/hello.js": "",
  });

  const routes = await discoverRoutes(root, {});
  assert.deepEqual(routes, ["/", "/blog", "/contact"]);
});

test("analyzeDependencies flags packages that are never imported", async (t) => {
  const root = makeProject(t, {
    "package.json": JSON.stringify({
      dependencies: { react: "19", lodash: "4", "left-pad": "1", "@scope/ui": "1" },
      devDependencies: { vitest: "1" },
    }),
    "src/index.js": 'import { map } from "lodash";\nimport { Button } from "@scope/ui/button";\n',
  });

  const findings = await analyzeDependencies(root);
  const byName = Object.fromEntries(findings.map((f) => [f.name, f]));

  assert.equal(byName["left-pad"].status, "Confirmed Unused");
  assert.equal(byName.vitest.status, "Probably Unused");
  assert.equal(byName.lodash, undefined, "imported package should not be flagged");
  assert.equal(byName["@scope/ui"], undefined, "scoped subpath import should count as usage");
  assert.equal(byName.react, undefined, "framework packages are always retained");
});

test("analyzeCodeQuality reports console calls, debugger, localhost URLs, and empty handlers", async (t) => {
  const root = makeProject(t, {
    "src/App.jsx": [
      "export function App() {",
      '  console.log("render");',
      "  debugger;",
      // Split so the auditor's self-audit does not flag this fixture line.
      '  const api = "http://' + 'localhost:3000/api";',
      "  return <button onClick={() => {}}>Go</button>;",
      "}",
    ].join("\n"),
  });

  const findings = await analyzeCodeQuality(root);
  const types = findings.map((f) => `${f.type}:${f.line}`).sort();
  assert.deepEqual(types, ["console-log:2", "debugger:3", "empty-handler:5", "hardcoded-localhost:4"]);
});

test("analyzeCodeQuality flags files longer than maxComponentLines", async (t) => {
  const root = makeProject(t, {
    "src/Big.jsx": Array.from({ length: 12 }, (_, i) => `const v${i} = ${i};`).join("\n"),
  });

  const findings = await analyzeCodeQuality(root, { maxComponentLines: 10 });
  assert.equal(findings.filter((f) => f.type === "monster-component").length, 1);
});

test("analyzeFileImports reports named imports that are never referenced", async (t) => {
  const root = makeProject(t, {
    "src/App.jsx": 'import { useState, useMemo } from "react";\nexport const App = () => useState(0);\n',
  });

  const unused = await analyzeFileImports(join(root, "src/App.jsx"));
  assert.deepEqual(unused.map((u) => u.identifier), ["useMemo"]);
  assert.equal(unused[0].line, 1);
  assert.equal(unused[0].source, "react");
});

test("analyzeAssets flags oversized images and legacy raster formats", async (t) => {
  const root = makeProject(t, {
    "public/hero.png": Buffer.alloc(600 * 1024),
    "public/icon.svg": "<svg/>",
  });

  const findings = await analyzeAssets(root, { maxAssetSizeKB: 500 });
  const types = findings
    .filter((f) => f.type === "oversized-asset" || f.type === "legacy-format")
    .map((f) => `${f.type}:${f.file}`)
    .sort();
  assert.deepEqual(types, ["legacy-format:public/hero.png", "oversized-asset:public/hero.png"]);
});
