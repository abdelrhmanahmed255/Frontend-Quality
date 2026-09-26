/**
 * Browser Runtime Evaluation Script Generator & DOM Inspection Heuristics.
 * Designed to execute in headless browser runtimes (Playwright, Puppeteer) or injected into preview servers.
 */

export const DEFAULT_VIEWPORTS = [
  { name: "320px (Mobile Narrow)", width: 320, height: 640 },
  { name: "375px (Mobile Standard)", width: 375, height: 812 },
  { name: "390px (Mobile Modern)", width: 390, height: 844 },
  { name: "430px (Mobile Large)", width: 430, height: 932 },
  { name: "768px (Tablet Portrait)", width: 768, height: 1024 },
  { name: "1024px (Tablet Landscape)", width: 1024, height: 768 },
  { name: "1280px (Desktop)", width: 1280, height: 800 },
  { name: "1440px (Desktop Wide)", width: 1440, height: 900 },
];

/**
 * In-browser client-side evaluation function that inspects the current DOM.
 * Can be serialized and run inside page.evaluate() in Playwright.
 */
export function inBrowserDomAudit() {
  const issues = [];
  const winWidth = window.innerWidth;
  const docScrollWidth = document.documentElement.scrollWidth;

  // 1. Horizontal Scroll Check
  if (docScrollWidth > winWidth) {
    const diff = docScrollWidth - winWidth;
    issues.push({
      category: "Responsive",
      severity: "P0",
      type: "horizontal-overflow",
      problem: `Horizontal overflow detected: page is ${diff}px wider than viewport (${docScrollWidth}px vs ${winWidth}px).`,
      recommendation: "Inspect containers with fixed widths or negative margins without overflow containment.",
    });

    // Find specific offending elements exceeding viewport
    const allElements = document.querySelectorAll("body *");
    const culprits = [];
    for (const el of allElements) {
      const rect = el.getBoundingClientRect();
      if (rect.right > winWidth + 2) {
        const selector = el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : "");
        culprits.push({ selector, overflowBy: Math.round(rect.right - winWidth) });
        if (culprits.length >= 5) break;
      }
    }

    if (culprits.length > 0) {
      issues[issues.length - 1].offendingElements = culprits;
    }
  }

  // 2. Missing Alt on Images
  const images = document.querySelectorAll("img");
  let missingAltCount = 0;
  for (const img of images) {
    if (!img.hasAttribute("alt")) {
      missingAltCount++;
    }
  }
  if (missingAltCount > 0) {
    issues.push({
      category: "Accessibility",
      severity: "P1",
      type: "missing-image-alt",
      problem: `Found ${missingAltCount} image(s) missing an 'alt' attribute.`,
      recommendation: "Provide descriptive alt text for informative images or alt='' for decorative assets.",
    });
  }

  // 3. Touch Target Sizing (Mobile viewports <= 430px)
  if (winWidth <= 430) {
    const clickables = document.querySelectorAll("button, a, input[type='button'], input[type='submit']");
    let smallTargets = 0;
    for (const el of clickables) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && (rect.width < 40 || rect.height < 40)) {
        smallTargets++;
      }
    }
    if (smallTargets > 0) {
      issues.push({
        category: "Accessibility",
        severity: "P2",
        type: "small-touch-targets",
        problem: `${smallTargets} interactive element(s) have touch areas smaller than recommended 44x44px.`,
        recommendation: "Increase padding or min-height/min-width for mobile interactive elements.",
      });
    }
  }

  return issues;
}
