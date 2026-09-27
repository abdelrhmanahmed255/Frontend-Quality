import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(new URL("../bin/auditor.mjs", import.meta.url));

function makeProject(t, name = "args-demo") {
  const root = mkdtempSync(join(tmpdir(), "fqa-args-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "src"));
  writeFileSync(join(root, "package.json"), JSON.stringify({ name }));
  writeFileSync(join(root, "src/App.js"), "export const a = 1;\n");
  return root;
}

function run(args, cwd) {
  return spawnSync(process.execPath, [cli, ...args], { cwd, encoding: "utf-8" });
}

test("a directory given without a command is audited", (t) => {
  const root = makeProject(t, "no-command-demo");
  const elsewhere = makeProject(t, "cwd-project");

  const result = run([root], elsewhere);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /no-command-demo/);
});

test("--output keeps paths that contain '='", (t) => {
  const root = makeProject(t);

  const result = run(["audit", ".", "--format=markdown", "--output=report=final.md"], root);

  assert.equal(result.status, 0, result.stderr);
  assert.ok(existsSync(join(root, "report=final.md")));
});

test("--url keeps query strings that contain '='", (t) => {
  const root = makeProject(t);

  // Nothing listens on port 9; the browser audit prints the URL it is about to open.
  const result = run(["audit", ".", "--url=http://127.0.0.1:9/?tab=a&x=1"], root);

  assert.match(result.stdout + result.stderr, /http:\/\/127\.0\.0\.1:9\/\?tab=a&x=1/);
});

test("an unknown command or missing directory is an error", (t) => {
  const root = makeProject(t);

  const result = run(["audti"], root);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown command or directory 'audti'/);
  assert.ok(!existsSync(join(root, "audti")), "must not create the misspelled directory");
});

test("--help works after a command and lists every option", () => {
  const result = run(["audit", "--help"]);

  assert.equal(result.status, 0);
  for (const flag of ["--format", "--output", "--verbose", "--url", "--strict", "--dry-run"]) {
    assert.ok(result.stdout.includes(flag), `help should mention ${flag}`);
  }
});

test("--strict rejects values that are not a score", (t) => {
  const result = run(["audit", ".", "--strict=high"], makeProject(t));

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Invalid --strict value 'high'/);
});
