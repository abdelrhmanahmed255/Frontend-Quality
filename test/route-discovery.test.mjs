import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { discoverRoutes } from "../src/analyzers/route-discovery.mjs";

function makeProject(t, files) {
  const root = mkdtempSync(join(tmpdir(), "fqa-routes-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

test("Pages Router index files map to their parent route", async (t) => {
  const root = makeProject(t, {
    "pages/index.tsx": "",
    "pages/blog/index.tsx": "",
    "pages/blog/[slug].tsx": "",
  });

  const routes = await discoverRoutes(root, {});
  assert.deepEqual(routes, ["/", "/blog", "/blog/:slug"]);
});

test("Pages Router special files and API routes are not treated as pages", async (t) => {
  const root = makeProject(t, {
    "pages/_app.tsx": "",
    "pages/_document.tsx": "",
    "pages/_error.tsx": "",
    "pages/api/users.ts": "",
    "pages/about.tsx": "",
  });

  const routes = await discoverRoutes(root, {});
  assert.deepEqual(routes, ["/", "/about"]);
});
