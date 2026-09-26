import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { formatSarifReport } from "../src/reporters/sarif.mjs";

const cli = fileURLToPath(new URL("../bin/auditor.mjs", import.meta.url));
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8"));

const auditResult = {
  issues: [
    { category: "Code Quality", severity: "P1", type: "debugger", file: "src/App.jsx", line: 3, problem: "Active debugger statement detected.", recommendation: "Remove it." },
    { category: "Code Quality", severity: "P3", type: "console-log", file: "src/App.jsx", line: 2, problem: "Active console logging.", recommendation: "Remove it." },
    { category: "Assets", severity: "P2", type: "oversized-asset", file: "public/hero.png", problem: "Asset is very large.", recommendation: "Compress it." },
    { category: "Dependencies", severity: "P2", type: "production", name: "left-pad", status: "Confirmed Unused", problem: "Package 'left-pad' is unused.", recommendation: "Uninstall it." },
    { category: "Accessibility", severity: "P1", type: "browser", status: "missing-image-alt", problem: "[375px] Missing alt.", recommendation: "Add alt." },
  ],
};

test("formatSarifReport produces a SARIF 2.1.0 log with one rule per finding type", () => {
  const sarif = JSON.parse(formatSarifReport(auditResult));

  assert.equal(sarif.version, "2.1.0");
  const run = sarif.runs[0];
  assert.equal(run.tool.driver.name, "Frontend Quality Auditor");
  assert.equal(run.tool.driver.version, pkg.version);
  assert.deepEqual(run.tool.driver.rules.map((r) => r.id), ["debugger", "console-log", "oversized-asset", "unused-dependency"]);
});

test("formatSarifReport maps severities to SARIF levels and keeps file locations", () => {
  const { results } = JSON.parse(formatSarifReport(auditResult)).runs[0];

  assert.deepEqual(results.map((r) => r.level), ["error", "note", "warning", "warning"]);
  assert.deepEqual(results[0].locations[0].physicalLocation, {
    artifactLocation: { uri: "src/App.jsx" },
    region: { startLine: 3 },
  });
  assert.deepEqual(results[2].locations[0].physicalLocation, { artifactLocation: { uri: "public/hero.png" } });
  assert.equal(results[3].locations[0].physicalLocation.artifactLocation.uri, "package.json");
});

test("formatSarifReport leaves out findings that have no file to point at", () => {
  const { results } = JSON.parse(formatSarifReport(auditResult)).runs[0];
  assert.ok(!results.some((r) => r.ruleId === "missing-image-alt"));
});

test("audit --format=sarif writes the SARIF file to the reports folder", (t) => {
  const root = mkdtempSync(join(tmpdir(), "fqa-sarif-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "src"));
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "sarif-demo" }));
  writeFileSync(join(root, "src/App.js"), "debugger;\n");

  const stdout = execFileSync(process.execPath, [cli, "audit", root, "--format=sarif"], { encoding: "utf-8" });

  assert.match(stdout, /SARIF report saved to/);
  const sarif = JSON.parse(readFileSync(join(root, "audit-reports", "FRONTEND_AUDIT_REPORT.sarif"), "utf-8"));
  assert.equal(sarif.runs[0].results[0].ruleId, "debugger");
  assert.equal(sarif.runs[0].results[0].locations[0].physicalLocation.artifactLocation.uri, "src/App.js");
});
