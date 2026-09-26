import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(new URL("../bin/auditor.mjs", import.meta.url));

function makeProject(t) {
  const root = mkdtempSync(join(tmpdir(), "fqa-json-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "src"));
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "json-demo" }));
  writeFileSync(join(root, "src/App.js"), "debugger;\nexport const a = 1;\n");
  return root;
}

function run(args, cwd) {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd, encoding: "utf-8" });
  return { ...result, json: () => JSON.parse(result.stdout) };
}

test("audit --format=json prints only JSON on stdout", (t) => {
  const root = makeProject(t);
  const result = run(["audit", ".", "--format=json"], root);

  assert.equal(result.status, 0);
  const report = result.json();
  assert.equal(report.project.name, "json-demo");
  assert.match(result.stderr, /Audit completed/);
});

test("fix --format=json --dry-run keeps the fix summary off stdout", (t) => {
  const root = makeProject(t);
  const result = run(["fix", ".", "--safe", "--dry-run", "--format=json"], root);

  assert.equal(result.status, 0);
  assert.ok(result.json().issues.length > 0);
  assert.match(result.stderr, /Debugger breakpoints removed: 1/);
});

test("--strict with --format=json still produces parseable stdout", (t) => {
  const root = makeProject(t);
  const result = run(["audit", ".", "--format=json", "--strict=10"], root);

  assert.equal(result.status, 0);
  assert.doesNotThrow(() => result.json());
  assert.match(result.stderr, /CI\/CD Check Passed/);
});
