---
name: frontend-quality-auditor
description: Audit, review, and safely improve frontend projects across Responsive UI, Accessibility, UX, and Code Hygiene (dead code, unused imports, dependencies, and assets).
metadata:
  version: 1.0.0
  category: frontend-quality
  locale: en
  tags: [frontend, responsive-ui, accessibility, clean-code, audit, code-quality, unused-imports, dead-code]
---

# Frontend Quality Auditor

## Purpose

Act as a **Senior Frontend Reviewer and Project Maintenance Engineer**. Instead of generating code blindly or giving vague feedback, inspect both:
1. **The rendered application** across standard device viewports (responsive layout, overflow, visual breaks, touch targets, a11y, and UX states).
2. **The static source code and repository structure** (dead code, unused imports, zombie dependencies in `package.json`, bloated assets, and code hygiene smells).

Connect findings to concrete evidence (DOM elements, styles, source files, line numbers), assign clear severity levels (**P0** Critical to **P3** Low), calculate actionable quick wins, and **safely apply automated fixes** without risking app stability.

---

## Use this skill when

- The user asks to **audit, review, or health-check** a frontend codebase (React, Next.js, Vite, Tailwind CSS, etc.).
- The user requests a **responsive UI review** or reports layout overflow/mobile issues.
- The user requests a **project cleanup** (removing unused files, dead code, unused dependencies, or bloated assets).
- The user wants to prepare a frontend for production, refactoring, code review, or client delivery.
- The user asks to **"audit and fix safe issues"** in their project.

---

## Supported Frameworks

The auditor automatically detects and supports:
- Next.js (App Router & Pages Router)
- React (Vite, CRA)
- Remix
- Static HTML/CSS
- Tailwind CSS detection
- TypeScript detection

---

## CLI Usage

The CLI provides three primary commands:
- `audit`: Runs a full frontend quality audit and generates a report.
- `suggest`: Suggests improvements without making any changes to the code.
- `fix --safe`: Automatically applies safe fixes like removing unused imports or dead code.

---

## Core Architecture

```text
                FRONTEND QUALITY AUDITOR
                         │
          ┌──────────────┴──────────────┐
          │                             │
   Responsive UI Reviewer        Clean My Project
          │                             │
   Visual + UX + A11y             Code + Files + Deps
   Responsive + Browser           Dead code + imports
   Screenshots + Routes           Packages + assets
          │                             │
          └──────────────┬──────────────┘
                         ↓
             Unified Evidence Report
                         │
             ┌───────────┴───────────┐
             ↓                       ↓
     Suggest Improvements     Apply Safe Fixes
```

---

## Workflow

### 1. Project Discovery & Route Mapping
- Detect framework and bundler: Next.js (App Router or Pages Router), React (Vite, CRA), Remix, or static HTML.
- Discover all routes:
  - Next.js: inspect `app/**/page.{jsx,tsx,js,ts}` or `pages/**/*.{jsx,tsx,js,ts}`.
  - React Router / Vite: inspect routing definitions, `<Route path=...>`, or file-based route configs.
- Check build, lint, and dependency configurations (`package.json`, `tsconfig.json`, `tailwind.config.*`).

### 2. Static Code & Cleanliness Analysis
Run the static analysis rules to flag dead code and hygiene violations:
- **Imports:** Scan for unused imports, duplicate imports, and dead exports.
- **Dependencies:** Compare `package.json` dependencies against actual codebase import statements. Classify as *Confirmed Unused*, *Probably Unused*, or *Directly Used*.
- **Assets:** Inspect `public/` and asset folders for files >500KB, non-modern formats (uncompressed PNG/JPEG vs WebP/AVIF), and unreferenced images/fonts.
- **Code Hygiene:** Scan for `console.log`, `debugger`, empty event handlers, hardcoded secrets/URLs, and monster components (>300 lines).

### 3. Responsive & Runtime Browser Review
When a browser runtime or preview server is available (or via browser automation like Playwright):
- Test the application across default responsive viewports:
  ```text
  320px  (Narrow mobile / SE)
  375px  (Standard mobile)
  390px  (Modern iOS / Android)
  430px  (Max mobile)
  768px  (Tablet portrait)
  1024px (Tablet landscape / small laptop)
  1280px (Standard desktop)
  1440px (Large desktop)
  ```
- **Horizontal Scroll Check:** Verify `document.documentElement.scrollWidth <= window.innerWidth`.
- **Overflow & Clipping:** Detect elements bleeding outside the viewport bounds (`getBoundingClientRect()`).
- **Touch Targets:** Verify buttons and interactive targets maintain minimum 44×44px hit areas on mobile.
- **Header & Modals:** Check that sticky navigation does not clip underlying content and modals remain within viewport height.

### 4. Accessibility (A11y) & UX Inspection
- **A11y:** Missing `alt` tags on images, form inputs lacking associated `<label>` or `aria-label`, heading hierarchy skips (e.g. `h1` straight to `h4`), and missing `:focus-visible` outlines.
- **UX States:** Verify that dynamic data containers define proper **Loading**, **Empty**, **Error**, and **Disabled** states.

### 5. Correlate Findings & Assign Severity
Connect runtime problems to their static source causes:
```text
Runtime Problem: Horizontal scroll at 375px viewport.
Static Cause:    .product-card has fixed `width: 450px` or `min-w-[450px]`.
Recommendation:  Replace fixed width with `w-full max-w-sm` or responsive grid.
```

Assign priority ratings:
- **P0 (Critical):** Broken layout making page unusable, fatal JS console error, mobile horizontal overflow blocking checkout.
- **P1 (High):** Major accessibility violation (unlabeled primary CTA), missing mobile navigation menu, dead dependencies adding >100KB to bundle.
- **P2 (Medium):** Spacing inconsistencies, uncompressed 2MB hero image, monster component with 12 `useState` hooks.
- **P3 (Low):** Leftover `console.log`, minor typography deviation, unreferenced backup file.

### 6. Safe Fixing Execution
When instructed to fix, adhere strictly to the **Safe Fixing Model**:
- **Safe (Automate):** Remove `console.log`, `debugger`, and unused imports.
- **Review Required (Prompt User):** Removing unused dependencies, deleting suspected unused files, or refactoring CSS layouts.
- **Never Touch:** Never alter authentication, database queries, environment variables, or encryption keys.

## Output Format

The auditor supports three report formats:
- **Terminal:** Standard output with colored tables and prioritized lists for immediate CLI feedback.
- **Markdown File:** A detailed `.md` report containing executive summaries, quick wins, evidence links, and severity breakdowns. Suitable for sharing with the team or attaching to issues.
- **JSON:** A machine-readable `.json` file containing structured findings, line numbers, and severity data for integration with CI/CD pipelines or custom dashboards.

---

## Detailed Rules References

Before evaluating specific categories, read the corresponding rules reference:
- [Responsive UI Rules](rules/responsive.md)
- [Accessibility Rules](rules/accessibility.md)
- [UX State Rules](rules/ux.md)
- [Performance Rules](rules/performance.md)
- [Code Quality Rules](rules/code-quality.md)
- [Dependency Rules](rules/dependencies.md)
- [Asset Optimization Rules](rules/assets.md)

---

## Quality Checklist

- [ ] Project framework and routing architecture correctly identified.
- [ ] Viewport responsiveness verified across 320px–1440px without horizontal scroll.
- [ ] Accessibility evaluated for landmarks, headings, labels, and touch targets.
- [ ] Dependencies categorized as confirmed unused vs potentially indirect.
- [ ] All code modifications limited to safe, non-breaking operations.
- [ ] Unified quality report contains executive summary, quick wins, evidence, and prioritized fixes.
- [ ] Unused imports identified and safe-to-remove ones stripped.
- [ ] Config file loaded and custom thresholds applied when present.
- [ ] Report generated in requested format(s) with evidence links.
