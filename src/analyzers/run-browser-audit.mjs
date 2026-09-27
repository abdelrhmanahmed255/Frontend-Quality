import { DEFAULT_VIEWPORTS, inBrowserDomAudit } from "./browser-analyzer.mjs";

/**
 * Turns the `viewports` config (a list of widths) into viewport definitions.
 * Known widths reuse the built-in names and heights; anything else gets a generic height.
 * @param {Array<number> | null | undefined} widths
 */
export function resolveViewports(widths) {
  const valid = Array.isArray(widths) ? widths.filter(w => Number.isInteger(w) && w > 0) : [];
  if (valid.length === 0) return DEFAULT_VIEWPORTS;
  return valid.map(width =>
    DEFAULT_VIEWPORTS.find(v => v.width === width) || { name: `${width}px`, width, height: width < 768 ? 812 : 900 }
  );
}

export async function runBrowserAudit(url, options = {}) {
  if (!url) return [];
  const viewports = resolveViewports(options.viewports);

  // Playwright is only needed for --url audits. Loading it lazily keeps the static audit
  // working (and fast) when the package is not installed, e.g. in a freshly cloned skill folder.
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    return [{
      name: "Playwright Setup",
      type: "browser",
      status: "Error",
      confidence: "High",
      problem: "Playwright is not installed, so the browser audit (--url) was skipped.",
      recommendation: "Run 'npm install playwright' and then 'npx playwright install chromium' to enable browser testing.",
      severity: "P0"
    }];
  }

  const findings = [];
  // Progress goes to stderr so it never mixes with a report printed on stdout (--format=json).
  console.error(`\n🔍 Launching Headless Browser to test ${url}...`);

  let browser;
  // Page-level checks (labels, headings, alt text) do not depend on the viewport width,
  // so they run for the first viewport only instead of repeating for all of them.
  let pageLevelChecksDone = false;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (err) {
    return [{
      name: "Playwright Setup",
      type: "browser",
      status: "Error",
      confidence: "High",
      problem: "Playwright failed to launch. Ensure browsers are installed via 'npx playwright install'.",
      recommendation: "Run 'npx playwright install chromium' to enable browser testing.",
      severity: "P0"
    }];
  }

  try {
    for (const viewport of viewports) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        userAgent: viewport.width <= 768 ? "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1" : undefined
      });
      
      const page = await context.newPage();
      
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
      } catch (e) {
        findings.push({
          name: "Connection",
          type: "browser",
          status: "Error",
          confidence: "High",
          problem: `Could not connect to ${url} on viewport ${viewport.name}.`,
          recommendation: "Ensure your local development server is running and accessible.",
          severity: "P0"
        });
        await context.close();
        break; // Stop testing other viewports if server is down
      }

      // Allow animations to settle
      await page.waitForTimeout(1000);

      // Execute in-browser DOM audit script
      const pageIssues = await page.evaluate(inBrowserDomAudit, { staticChecks: !pageLevelChecksDone });
      pageLevelChecksDone = true;

      for (const issue of pageIssues) {
        let problemDesc = `[${viewport.name}] ${issue.problem}`;
        if (issue.offendingElements && issue.offendingElements.length > 0) {
          problemDesc += ` Offending elements: ${issue.offendingElements.map(e => e.selector).join(', ')}`;
        }
        
        findings.push({
          // Keep the category so the markdown report can group browser findings.
          category: issue.category,
          name: `Viewport: ${viewport.name}`,
          type: "browser",
          status: issue.type,
          confidence: "High",
          problem: problemDesc,
          recommendation: issue.recommendation,
          severity: issue.severity
        });
      }
      
      await context.close();
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }
  
  return findings;
}
