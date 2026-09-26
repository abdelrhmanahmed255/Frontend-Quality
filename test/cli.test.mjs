import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(new URL("../bin/auditor.mjs", import.meta.url));

test("audit command prints a report and writes the markdown file", (t) => {
  const root = mkdtempSync(join(tmpdir(), "fqa-cli-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "src"));
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "cli-demo" }));
  writeFileSync(join(root, "src/App.js"), "debugger;\n");

  const stdout = execFileSync(process.execPath, [cli, "audit", root], { encoding: "utf-8" });

  assert.match(stdout, /FRONTEND QUALITY AUDIT REPORT/);
  assert.match(stdout, /Active debugger statement detected/);
  assert.ok(existsSync(join(root, "audit-reports", "FRONTEND_AUDIT_REPORT.md")));
});

test("--help prints usage and exits cleanly", () => {
  const stdout = execFileSync(process.execPath, [cli, "--help"], { encoding: "utf-8" });
  assert.match(stdout, /Usage:/);
});
