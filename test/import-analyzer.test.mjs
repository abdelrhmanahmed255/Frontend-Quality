import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { analyzeFileImports } from "../src/analyzers/import-analyzer.mjs";

async function unusedIn(t, source) {
  const root = mkdtempSync(join(tmpdir(), "fqa-import-parse-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const file = join(root, "App.tsx");
  writeFileSync(file, source);
  const results = await analyzeFileImports(file);
  return results.map((r) => `${r.identifier}@${r.line}`);
}

test("checks both halves of a default + named import", async (t) => {
  const unused = await unusedIn(t, 'import Header, { Nav } from "./Header";\nexport const A = () => <Header />;\n');
  assert.deepEqual(unused, ["Nav@1"]);
});

test("reports the local name of inline type specifiers", async (t) => {
  const unused = await unusedIn(t, 'import { type Theme, format } from "./util";\nformat();\n');
  assert.deepEqual(unused, ["Theme@1"]);
});

test("handles `import type` declarations", async (t) => {
  const unused = await unusedIn(t, 'import type { Props, State } from "./types";\nexport function A(p: Props) {}\n');
  assert.deepEqual(unused, ["State@1"]);
});

test("uses the alias for renamed specifiers and namespace imports", async (t) => {
  const source = 'import { format as fmt } from "date-fns";\nimport * as utils from "./utils";\nfmt(new Date());\n';
  const unused = await unusedIn(t, source);
  assert.deepEqual(unused, ["utils@2"]);
});

test("reports the starting line of multi-line imports", async (t) => {
  const source = '// header\nimport {\n  map,\n  filter,\n} from "lodash";\nmap([], String);\n';
  const unused = await unusedIn(t, source);
  assert.deepEqual(unused, ["filter@2"]);
});

test("does not treat a mention in another import statement as usage", async (t) => {
  const source = 'import { a } from "./a";\nimport { a as b } from "./b";\nb();\n';
  const unused = await unusedIn(t, source);
  assert.deepEqual(unused, ["a@1"]);
});

test("matches identifiers that contain `$`", async (t) => {
  const source = 'import { $store, store } from "./store";\nconsole.log($store);\n';
  const unused = await unusedIn(t, source);
  assert.deepEqual(unused, ["store@1"]);
});

test("ignores side-effect imports and keeps React for the classic JSX runtime", async (t) => {
  const unused = await unusedIn(t, 'import "./styles.css";\nimport React from "react";\nexport const x = 1;\n');
  assert.deepEqual(unused, []);
});
