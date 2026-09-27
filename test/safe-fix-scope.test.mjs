import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { applySafeFixes } from "../src/fixes/safe-fixes.mjs";

const cli = fileURLToPath(new URL("../bin/auditor.mjs", import.meta.url));

function makeTempDir(t) {
  const root = mkdtempSync(join(tmpdir(), "fqa-scope-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

test("applySafeFixes only removes the lines that were reported", (t) => {
  const file = join(makeTempDir(t), "App.js");
  writeFileSync(file, 'console.log("flagged");\nconsole.log("not flagged");\ndebugger;\n');

  const stats = applySafeFixes([{ file, type: "console-log", line: 1 }]);

  assert.equal(readFileSync(file, "utf-8"), 'console.log("not flagged");\ndebugger;\n');
  assert.equal(stats.consoleLogsRemoved, 1);
  assert.equal(stats.debuggersRemoved, 0);
});

test("applySafeFixes ignores unrelated findings in the same file", (t) => {
  const file = join(makeTempDir(t), "Big.js");
  const source = 'console.log("kept");\n';
  writeFileSync(file, source);

  const stats = applySafeFixes([{ file, type: "monster-component", line: 1 }]);

  assert.equal(readFileSync(file, "utf-8"), source);
  assert.equal(stats.filesModified, 0);
});

test("applySafeFixes removes a flagged debugger that has a trailing comment", (t) => {
  const file = join(makeTempDir(t), "App.js");
  writeFileSync(file, "debugger; // remove me\nrun();\n");

  const stats = applySafeFixes([{ file, type: "debugger", line: 1 }]);

  assert.equal(stats.debuggersRemoved, 1);
  assert.equal(readFileSync(file, "utf-8"), "run();\n");
});

test("fix --safe keeps console output in reporter files that the audit skips", (t) => {
  const root = makeTempDir(t);
  mkdirSync(join(root, "src", "reporters"), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "scope-demo" }));
  const reporter = 'export function report() {\n  console.log("summary");\n}\n';
  writeFileSync(join(root, "src/reporters/terminal.mjs"), reporter);
  // A long file gets a monster-component finding, which used to pull it into the fixer.
  writeFileSync(join(root, "src/reporters/big.mjs"), 'console.log("banner");\n' + "const x = 1;\n".repeat(400));

  execFileSync(process.execPath, [cli, "fix", ".", "--safe"], { cwd: root, encoding: "utf-8" });

  assert.equal(readFileSync(join(root, "src/reporters/terminal.mjs"), "utf-8"), reporter);
  assert.match(readFileSync(join(root, "src/reporters/big.mjs"), "utf-8"), /^console\.log\("banner"\);/);
});
