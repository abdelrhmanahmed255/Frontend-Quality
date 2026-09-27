import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { analyzeAssets } from "../src/analyzers/asset-analyzer.mjs";

function makeProject(t, files) {
  const root = mkdtempSync(join(tmpdir(), "fqa-assets-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

async function unreferenced(root) {
  const findings = await analyzeAssets(root);
  return findings.filter((f) => f.type === "unreferenced-asset").map((f) => f.file).sort();
}

test("reports assets whose file name is not referenced anywhere", async (t) => {
  const root = makeProject(t, {
    "public/used-in-jsx.png": "x",
    "public/used-in-css.svg": "x",
    "src/assets/imported.webp": "x",
    "public/orphan.jpg": "x",
    "src/assets/old-logo.svg": "x",
    "src/App.jsx": 'import pic from "./assets/imported.webp";\nexport const A = () => <img src="/used-in-jsx.png" alt={pic} />;\n',
    "src/styles.css": ".hero { background: url('/used-in-css.svg'); }\n",
  });

  assert.deepEqual(await unreferenced(root), ["public/orphan.jpg", "src/assets/old-logo.svg"]);
});

test("counts references from markdown, HTML, and web manifests", async (t) => {
  const root = makeProject(t, {
    "assets/banner.jpg": "x",
    "public/icon-512.png": "x",
    "public/og.png": "x",
    "README.md": "![banner](assets/banner.jpg)\n",
    "public/site.webmanifest": JSON.stringify({ icons: [{ src: "/icon-512.png" }] }),
    "index.html": '<meta property="og:image" content="/og.png">\n',
  });

  assert.deepEqual(await unreferenced(root), []);
});

test("skips files that browsers request by convention", async (t) => {
  const root = makeProject(t, {
    "public/apple-touch-icon.png": "x",
    "public/favicon.svg": "x",
  });

  assert.deepEqual(await unreferenced(root), []);
});

test("unreferenced assets are low severity and medium confidence", async (t) => {
  const root = makeProject(t, { "public/orphan.png": "x" });

  const [finding] = (await analyzeAssets(root)).filter((f) => f.type === "unreferenced-asset");
  assert.equal(finding.severity, "P3");
  assert.equal(finding.confidence, "Medium");
});
