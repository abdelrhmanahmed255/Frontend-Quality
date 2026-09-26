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
 * Can be serialized and run inside page.evaluate() in Playwright, so it must not
 * reference anything outside its own body.
 *
 * @param {object} [options]
 * @param {boolean} [options.staticChecks=true] Run page-level checks that do not depend on the
 *   viewport width (alt text, labels, accessible names, headings, lang). The runner enables
 *   them for one viewport only so the same finding is not repeated for every width.
 */
export function inBrowserDomAudit(options = {}) {
  const staticChecks = options.staticChecks !== false;
  const issues = [];
  const winWidth = window.innerWidth;
  const docScrollWidth = document.documentElement.scrollWidth;

  const describe = (el) =>
    el.tagName.toLowerCase() +
    (el.id ? "#" + el.id : "") +
    (el.className && typeof el.className === "string" && el.className.trim()
      ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
      : "");

  const isVisible = (el) => {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  };

  const hasAriaName = (el) => {
    if ((el.getAttribute("aria-label") || "").trim()) return true;
    if ((el.getAttribute("title") || "").trim()) return true;
    const labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) {
      return labelledBy.split(/\s+/).some((id) => (document.getElementById(id)?.textContent || "").trim());
    }
    return false;
  };

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
        culprits.push({ selector: describe(el), overflowBy: Math.round(rect.right - winWidth) });
        if (culprits.length >= 5) break;
      }
    }

    if (culprits.length > 0) {
      issues[issues.length - 1].offendingElements = culprits;
    }
  }

  if (staticChecks) {
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

    // 3. Form controls without a label
    const controls = document.querySelectorAll(
      "input:not([type='hidden']):not([type='submit']):not([type='button']):not([type='reset']):not([type='image']), select, textarea"
    );
    const unlabeled = [];
    for (const el of controls) {
      if (!isVisible(el)) continue;
      if ((el.labels && el.labels.length > 0) || hasAriaName(el)) continue;
      unlabeled.push({ selector: describe(el) });
    }
    if (unlabeled.length > 0) {
      issues.push({
        category: "Accessibility",
        severity: "P1",
        type: "unlabeled-form-control",
        problem: `${unlabeled.length} form control(s) have no associated label (placeholder text is not a label).`,
        recommendation: "Associate each field with a <label for=\"id\">, wrap it in a <label>, or add aria-label / aria-labelledby.",
        offendingElements: unlabeled.slice(0, 5),
      });
    }

    // 4. Buttons and links without an accessible name (e.g. icon-only buttons)
    const actionable = document.querySelectorAll("button, a[href], [role='button'], input[type='button'], input[type='submit']");
    const nameless = [];
    for (const el of actionable) {
      if (!isVisible(el)) continue;
      if (hasAriaName(el) || (el.textContent || "").trim()) continue;
      if (el.tagName === "INPUT" && (el.value || el.type === "submit")) continue;
      const namedImage = [...el.querySelectorAll("img[alt], svg title")].some((child) =>
        (child.getAttribute("alt") ?? child.textContent ?? "").trim()
      );
      if (namedImage) continue;
      nameless.push({ selector: describe(el) });
    }
    if (nameless.length > 0) {
      issues.push({
        category: "Accessibility",
        severity: "P1",
        type: "missing-accessible-name",
        problem: `${nameless.length} button(s) or link(s) have no accessible name, so screen readers announce them without a purpose.`,
        recommendation: "Add visible text, an aria-label, or visually hidden text to icon-only buttons and links.",
        offendingElements: nameless.slice(0, 5),
      });
    }

    // 5. Heading structure: one h1 and no skipped levels
    const headings = [...document.querySelectorAll("h1, h2, h3, h4, h5, h6")].filter(isVisible);
    if (!headings.some((h) => h.tagName === "H1")) {
      issues.push({
        category: "Accessibility",
        severity: "P2",
        type: "missing-h1",
        problem: "The page has no visible <h1> describing its main purpose.",
        recommendation: "Add exactly one <h1> per page that reflects its primary content.",
      });
    }
    const skips = [];
    for (let i = 1; i < headings.length; i++) {
      const prev = Number(headings[i - 1].tagName[1]);
      const curr = Number(headings[i].tagName[1]);
      if (curr > prev + 1) skips.push({ selector: describe(headings[i]), from: `h${prev}`, to: `h${curr}` });
    }
    if (skips.length > 0) {
      issues.push({
        category: "Accessibility",
        severity: "P2",
        type: "heading-level-skip",
        problem: `Heading levels are skipped ${skips.length} time(s) (for example ${skips[0].from} followed by ${skips[0].to}).`,
        recommendation: "Keep heading levels sequential and use CSS for visual sizing instead of picking a smaller heading tag.",
        offendingElements: skips.slice(0, 5),
      });
    }

    // 6. Document language
    if (!(document.documentElement.getAttribute("lang") || "").trim()) {
      issues.push({
        category: "Accessibility",
        severity: "P2",
        type: "missing-lang",
        problem: "The <html> element has no lang attribute, so screen readers may use the wrong pronunciation.",
        recommendation: "Set the page language, for example <html lang=\"en\">.",
      });
    }
  }

  // 7. Touch Target Sizing (Mobile viewports <= 430px)
  if (winWidth <= 430) {
    const clickables = document.querySelectorAll("button, a, input[type='button'], input[type='submit']");
    let smallTargets = 0;
    for (const el of clickables) {
      // Links inside a sentence are exempt from target-size rules (WCAG 2.5.8 inline exception).
      if (el.tagName === "A" && getComputedStyle(el).display === "inline") continue;
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44)) {
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
