import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

// Copies the CLI into a temp folder without node_modules, like a freshly cloned skill folder.
function copyCliWithoutDependencies(t) {
  const dir = mkdtempSync(join(tmpdir(), "fqa-no-deps-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const entry of ["bin", "src", "package.json"]) {
    cpSync(join(repoRoot, entry), join(dir, entry), { recursive: true });
  }
  const project = join(dir, "project");
  mkdirSync(join(project, "src"), { recursive: true });
  writeFileSync(join(project, "package.json"), JSON.stringify({ name: "no-deps-demo" }));
  writeFileSync(join(project, "src/App.js"), "debugger;\n");
  return { cli: join(dir, "bin", "auditor.mjs"), project };
}

test("static audit runs when Playwright is not installed", (t) => {
  const { cli, project } = copyCliWithoutDependencies(t);

  const result = spawnSync(process.execPath, [cli, "audit", project], { encoding: "utf-8" });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Active debugger statement detected/);
});

test("--url reports a setup finding instead of crashing when Playwright is missing", (t) => {
  const { cli, project } = copyCliWithoutDependencies(t);

  const result = spawnSync(process.execPath, [cli, "audit", project, "--url=http://127.0.0.1:3000", "--verbose"], { encoding: "utf-8" });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Playwright is not installed/);
});
