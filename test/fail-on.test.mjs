import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(new URL("../bin/auditor.mjs", import.meta.url));

// Project with one P1 finding (debugger) and one P3 finding (console.log).
function makeProject(t) {
  const root = mkdtempSync(join(tmpdir(), "fqa-fail-on-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "src"));
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "fail-on-demo" }));
  writeFileSync(join(root, "src/App.js"), 'console.log("x");\ndebugger;\n');
  return root;
}

function audit(root, ...flags) {
  return spawnSync(process.execPath, [cli, "audit", root, ...flags], { encoding: "utf-8" });
}

test("--fail-on exits 1 when a finding meets the threshold", (t) => {
  const result = audit(makeProject(t), "--fail-on=P1");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Severity gate failed: 1 finding\(s\) at P1 or worse \(0 P0, 1 P1\)/);
});

test("--fail-on exits 0 when every finding is below the threshold", (t) => {
  const result = audit(makeProject(t), "--fail-on=P0");
  assert.equal(result.status, 0, result.stderr);
});

test("--fail-on counts every severity up to the threshold and is case-insensitive", (t) => {
  const result = audit(makeProject(t), "--fail-on=p3");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /2 finding\(s\) at P3 or worse/);
});

test("--fail-on rejects unknown severities", (t) => {
  const result = audit(makeProject(t), "--fail-on=high");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Invalid --fail-on value 'HIGH'/);
});
