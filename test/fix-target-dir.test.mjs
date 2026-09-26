import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { applySafeFixes } from "../src/fixes/safe-fixes.mjs";

const cli = fileURLToPath(new URL("../bin/auditor.mjs", import.meta.url));

function makeProject(t) {
  const root = mkdtempSync(join(tmpdir(), "fqa-fixdir-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "src"));
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "fix-dir-demo" }));
  writeFileSync(join(root, "src/App.js"), 'const a = 1;\ndebugger;\nexport default a;\n');
  return root;
}

test("applySafeFixes resolves relative finding paths against options.rootDir", (t) => {
  const root = makeProject(t);

  const stats = applySafeFixes([{ file: "src/App.js", type: "debugger", line: 2 }], [], { rootDir: root });

  assert.equal(stats.debuggersRemoved, 1);
  assert.equal(readFileSync(join(root, "src/App.js"), "utf-8"), "const a = 1;\nexport default a;\n");
});

test("fix <dir> --safe edits the target project when run from another directory", (t) => {
  const root = makeProject(t);
  const elsewhere = mkdtempSync(join(tmpdir(), "fqa-cwd-"));
  t.after(() => rmSync(elsewhere, { recursive: true, force: true }));

  const stdout = execFileSync(process.execPath, [cli, "fix", root, "--safe"], { cwd: elsewhere, encoding: "utf-8" });

  assert.match(stdout, /Debugger breakpoints removed: 1/);
  assert.equal(readFileSync(join(root, "src/App.js"), "utf-8"), "const a = 1;\nexport default a;\n");
});
