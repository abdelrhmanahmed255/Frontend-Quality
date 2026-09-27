import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { applySafeFixes } from "../src/fixes/safe-fixes.mjs";
import { blankStringsAndComments } from "../src/utils/safe-string-search.mjs";

function writeTempFile(t, name, content) {
  const root = mkdtempSync(join(tmpdir(), "fqa-fix-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const file = join(root, name);
  writeFileSync(file, content);
  return file;
}

test("applySafeFixes removes console.log and debugger lines", (t) => {
  const file = writeTempFile(t, "App.js", 'const a = 1;\nconsole.log("a", a);\ndebugger;\nexport default a;\n');

  const stats = applySafeFixes([
    { file, type: "console-log", line: 2 },
    { file, type: "debugger", line: 3 },
  ]);

  assert.equal(readFileSync(file, "utf-8"), "const a = 1;\nexport default a;\n");
  assert.deepEqual(stats, { filesModified: 1, consoleLogsRemoved: 1, debuggersRemoved: 1, importsRemoved: 0 });
});

test("applySafeFixes leaves files untouched in dry-run mode", (t) => {
  const source = 'console.log("keep");\n';
  const file = writeTempFile(t, "App.js", source);

  const stats = applySafeFixes([{ file, type: "console-log", line: 1 }], [], { dryRun: true });

  assert.equal(readFileSync(file, "utf-8"), source);
  assert.equal(stats.consoleLogsRemoved, 1);
});

test("blankStringsAndComments keeps length and line breaks while hiding strings and comments", () => {
  const code = 'const a = "debugger"; // console.log(a)\n/* multi\nline */ run();';
  const blanked = blankStringsAndComments(code);

  assert.equal(blanked.length, code.length);
  assert.equal(blanked.split("\n").length, code.split("\n").length);
  assert.ok(!blanked.includes("debugger"));
  assert.ok(!blanked.includes("console"));
  assert.ok(blanked.includes("run();"));
});
