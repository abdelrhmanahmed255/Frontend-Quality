import { test } from "node:test";
import assert from "node:assert/strict";

import { generateMarkdownReport } from "../src/reporters/markdown.mjs";
import { formatJsonReport } from "../src/reporters/json.mjs";

const auditResult = {
  project: { name: "demo", framework: "React", routesCount: 1 },
  routes: ["/"],
  summary: { total: 2, p0: 0, p1: 1, p2: 0, p3: 1 },
  quickWins: ["Remove 1 active console.log statement(s)."],
  issues: [
    { category: "Code Quality", severity: "P1", type: "debugger", file: "src/App.jsx", line: 3, problem: "Active debugger statement detected.", recommendation: "Remove it." },
    { category: "Code Quality", severity: "P3", type: "console-log", file: "src/App.jsx", line: 2, problem: "Active console logging.", recommendation: "Remove it." },
  ],
};

test("generateMarkdownReport includes the health score, quick wins, and file locations", () => {
  const md = generateMarkdownReport(auditResult);

  assert.match(md, /\*\*Health Score: 88\/100\*\*/);
  assert.match(md, /Remove 1 active console\.log statement\(s\)\./);
  assert.match(md, /`src\/App\.jsx:3`/);
  assert.match(md, /### Code Quality \(2\)/);
});

test("formatJsonReport produces parseable JSON that keeps every finding", () => {
  const parsed = JSON.parse(formatJsonReport(auditResult));

  assert.equal(parsed.issues.length, 2);
  assert.equal(parsed.summary.p1, 1);
  assert.ok(!Number.isNaN(Date.parse(parsed.timestamp)));
});
