import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";

import { inBrowserDomAudit } from "../src/analyzers/browser-analyzer.mjs";
import { runBrowserAudit } from "../src/analyzers/run-browser-audit.mjs";

// These tests need a Playwright Chromium build (`npx playwright install chromium`).
// They are skipped when no browser is available, e.g. on a CI runner without browsers.
let browser = null;
let skipReason = false;

before(async () => {
  try {
    const { chromium } = await import("playwright");
    browser = await chromium.launch({ headless: true });
  } catch {
    skipReason = "Playwright Chromium is not installed";
  }
});

after(async () => {
  await browser?.close();
});

async function auditHtml(html, viewport = { width: 1280, height: 800 }) {
  const page = await browser.newPage({ viewport });
  await page.setContent(html);
  const issues = await page.evaluate(inBrowserDomAudit, { staticChecks: true });
  await page.close();
  return issues;
}

const types = (issues) => issues.map((i) => i.type).sort();

test("a well-structured page has no accessibility findings", async (t) => {
  if (skipReason) return t.skip(skipReason);
  const issues = await auditHtml(`<!doctype html><html lang="en"><body>
    <h1>Shop</h1><h2>Deals</h2><h3>Today</h3>
    <label for="q">Search</label><input id="q">
    <label>Email <input type="email"></label>
    <button aria-label="Close"><svg aria-hidden="true"></svg></button>
    <a href="/cart">Cart</a>
    <img src="data:," alt="">
  </body></html>`);
  assert.deepEqual(types(issues), []);
});

test("reports unlabeled fields, nameless buttons, heading skips, and missing lang", async (t) => {
  if (skipReason) return t.skip(skipReason);
  const issues = await auditHtml(`<!doctype html><html><body>
    <h2>No h1 here</h2><h4>Skipped h3</h4>
    <input id="email" placeholder="Email">
    <button class="icon-close"><svg></svg></button>
    <a href="/x"><svg width="24" height="24"></svg></a>
  </body></html>`);

  assert.deepEqual(types(issues), ["heading-level-skip", "missing-accessible-name", "missing-h1", "missing-lang", "unlabeled-form-control"]);
  const unlabeled = issues.find((i) => i.type === "unlabeled-form-control");
  assert.deepEqual(unlabeled.offendingElements, [{ selector: "input#email" }]);
  assert.match(issues.find((i) => i.type === "missing-accessible-name").problem, /^2 button/);
  assert.match(issues.find((i) => i.type === "heading-level-skip").problem, /h2 followed by h4/);
});

test("page-level checks can be turned off for repeated viewports", async (t) => {
  if (skipReason) return t.skip(skipReason);
  const page = await browser.newPage();
  await page.setContent(`<html><body><img src="data:,"><input></body></html>`);
  const issues = await page.evaluate(inBrowserDomAudit, { staticChecks: false });
  await page.close();
  assert.deepEqual(types(issues), []);
});

test("touch targets under 44px are reported on mobile, inline text links are exempt", async (t) => {
  if (skipReason) return t.skip(skipReason);
  const issues = await auditHtml(
    `<html lang="en"><body><h1>Hi</h1>
      <p>Read the <a href="/terms">terms</a> first.</p>
      <button style="width:42px;height:42px">OK</button>
    </body></html>`,
    { width: 375, height: 812 }
  );
  const small = issues.find((i) => i.type === "small-touch-targets");
  assert.ok(small, "expected a small-touch-targets finding");
  assert.match(small.problem, /^1 interactive element/);
});

test("runBrowserAudit keeps categories and reports page-level issues once", async (t) => {
  if (skipReason) return t.skip(skipReason);
  const server = createServer((req, res) => {
    res.setHeader("content-type", "text/html");
    res.end(`<html lang="en"><body><h1>Home</h1><img src="data:,"></body></html>`);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());

  const findings = await runBrowserAudit(`http://127.0.0.1:${server.address().port}/`);
  const altFindings = findings.filter((f) => f.status === "missing-image-alt");

  assert.equal(altFindings.length, 1, "missing alt should not repeat for every viewport");
  assert.equal(altFindings[0].category, "Accessibility");
});
