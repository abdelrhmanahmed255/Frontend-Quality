import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { removeUnusedImports } from "../src/fixes/safe-fixes.mjs";

const cli = fileURLToPath(new URL("../bin/auditor.mjs", import.meta.url));

function writeTempFile(t, content) {
  const root = mkdtempSync(join(tmpdir(), "fqa-imports-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const file = join(root, "App.jsx");
  writeFileSync(file, content);
  return file;
}

function removeAndRead(t, content, issues) {
  const file = writeTempFile(t, content);
  const removed = removeUnusedImports(issues.map((issue) => ({ file, ...issue })));
  return { removed, text: readFileSync(file, "utf-8") };
}

test("fix --safe removes the unused imports that the audit reports", (t) => {
  const root = mkdtempSync(join(tmpdir(), "fqa-imports-cli-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "src"));
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "imports-demo" }));
  writeFileSync(join(root, "src/App.jsx"), 'import { useState, useMemo } from "react";\nexport const App = () => useState(0);\n');

  const stdout = execFileSync(process.execPath, [cli, "fix", ".", "--safe"], { cwd: root, encoding: "utf-8" });

  assert.match(stdout, /Unused imports removed:\s+1/);
  assert.equal(readFileSync(join(root, "src/App.jsx"), "utf-8"), 'import { useState } from "react";\nexport const App = () => useState(0);\n');
});

test("removes one named specifier and keeps the rest", (t) => {
  const { removed, text } = removeAndRead(t, 'import { a, b, c } from "x";\n', [{ identifier: "b", line: 1 }]);
  assert.equal(removed, 1);
  assert.equal(text, 'import { a, c } from "x";\n');
});

test("removes an aliased specifier as a whole", (t) => {
  const { text } = removeAndRead(t, 'import { format as fmt, parse } from "date-fns";\n', [{ identifier: "fmt", line: 1 }]);
  assert.equal(text, 'import { parse } from "date-fns";\n');
});

test("removes an unused default import but keeps used named imports", (t) => {
  const { text } = removeAndRead(t, 'import React, { useState } from "react";\n', [{ identifier: "React", line: 1 }]);
  assert.equal(text, 'import { useState } from "react";\n');
});

test("removes the whole statement when no binding is left", (t) => {
  const { removed, text } = removeAndRead(t, 'import * as utils from "./utils";\nexport const x = 1;\n', [{ identifier: "utils", line: 1 }]);
  assert.equal(removed, 1);
  assert.equal(text, "export const x = 1;\n");
});

test("handles imports that span several lines", (t) => {
  const source = 'import {\n  map,\n  filter,\n} from "lodash";\nmap([], String);\n';
  const { removed, text } = removeAndRead(t, source, [{ identifier: "filter", line: 1 }]);
  assert.equal(removed, 1);
  assert.equal(text, 'import {\n  map,\n} from "lodash";\nmap([], String);\n');
});

test("removes a fully unused multi-line import without leaving stray lines", (t) => {
  const source = 'import {\n  map,\n  filter,\n} from "lodash";\nexport const x = 1;\n';
  const { text } = removeAndRead(t, source, [
    { identifier: "map", line: 1 },
    { identifier: "filter", line: 1 },
  ]);
  assert.equal(text, "export const x = 1;\n");
});

test("accepts identifiers reported with an inline type keyword", (t) => {
  const { text } = removeAndRead(t, 'import { type Theme, format } from "./util";\nformat();\n', [{ identifier: "type Theme", line: 1 }]);
  assert.equal(text, 'import { format } from "./util";\nformat();\n');
});
