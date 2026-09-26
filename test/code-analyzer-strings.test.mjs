import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { analyzeCodeQuality } from "../src/analyzers/code-analyzer.mjs";
import { blankStringsAndComments } from "../src/utils/safe-string-search.mjs";

async function findingsFor(t, source) {
  const root = mkdtempSync(join(tmpdir(), "fqa-strings-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "src"));
  writeFileSync(join(root, "src/App.jsx"), source);
  const findings = await analyzeCodeQuality(root);
  return findings.map((f) => `${f.type}:${f.line}`).sort();
}

test("console calls inside string literals are not reported", async (t) => {
  const source = [
    "const docs = \"call console.log('x') to debug\";",
    "const tpl = `console.debug(${1})`;",
    "console.log(docs);",
  ].join("\n");
  assert.deepEqual(await findingsFor(t, source), ["console-log:3"]);
});

test("code inside the body of a block comment is not reported", async (t) => {
  const source = ["/*", "  Example:", "  debugger;", "    console.log(value)", "*/", "export const x = 1;"].join("\n");
  assert.deepEqual(await findingsFor(t, source), []);
});

test("a debugger statement with a trailing comment is still reported", async (t) => {
  assert.deepEqual(await findingsFor(t, "debugger; // TODO remove\n"), ["debugger:1"]);
});

test("an apostrophe in JSX text does not hide code on the following lines", async (t) => {
  const source = ["export const A = () => <p>Don't panic</p>;", "console.log(A);"].join("\n");
  assert.deepEqual(await findingsFor(t, source), ["console-log:2"]);
});

test("hardcoded localhost URLs in strings are still reported", async (t) => {
  // Split so the auditor's self-audit does not flag this fixture line.
  assert.deepEqual(await findingsFor(t, 'fetch("http://' + 'localhost:4000/api");\n'), ["hardcoded-localhost:1"]);
});

test("blankStringsAndComments stops single and double quoted strings at a line break", () => {
  const code = "const a = 'unterminated\nrun();";
  const blanked = blankStringsAndComments(code);
  assert.equal(blanked.length, code.length);
  assert.equal(blanked.split("\n")[1], "run();");
});
