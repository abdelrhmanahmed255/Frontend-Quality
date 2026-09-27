---
name: frontend-quality-auditor
description: Audit, review, and safely improve frontend projects across Responsive UI, Accessibility, UX, and Code Hygiene (dead code, unused imports, dependencies, and assets). Use when the user asks to audit, health-check, clean up, or prepare a frontend (React, Next.js, Vite, Remix, static HTML) for production.
metadata:
  version: 2.0.1
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

The bundled CLI does the mechanical checks. Your job is to run it, verify what it reports, cover the checks it cannot do, and turn everything into one prioritized report.

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

## Running the CLI

The CLI lives in this skill's folder. Run it with Node.js 18+ and point it at the user's project. Before the first run, install its dependencies once in the skill folder with `npm install`. The browser audit (`--url`) also needs a browser: `npx playwright install chromium`.

```bash
# Machine-readable results for you to analyze (also saved to audit-reports/FRONTEND_AUDIT_REPORT.json)
node <skill-dir>/bin/auditor.mjs audit <project-dir> --format=json

# Human-readable terminal report plus audit-reports/FRONTEND_AUDIT_REPORT.md
node <skill-dir>/bin/auditor.mjs audit <project-dir> --verbose

# Add the Playwright browser audit when the app is running locally
node <skill-dir>/bin/auditor.mjs audit <project-dir> --url=http://localhost:3000 --format=json

# Recommendations that need the user's approval (uninstall commands, asset compression)
node <skill-dir>/bin/auditor.mjs suggest <project-dir>

# Preview safe fixes, then apply them
node <skill-dir>/bin/auditor.mjs fix <project-dir> --safe --dry-run
node <skill-dir>/bin/auditor.mjs fix <project-dir> --safe
```

| Option | Use it to |
|---|---|
| `--format=json` / `--format=markdown` | Choose the report format. Without it you get the terminal report and a markdown file. |
| `--output=<path>` | Write the report file somewhere other than `audit-reports/`. |
| `--verbose` | Show every finding in the terminal instead of the first 15. |
| `--url=<url>` | Test a running app in headless Chromium at 8 viewport widths (320–1440px). |
| `--dry-run` | With `fix`: report what would change without writing files. |
| `--strict[=<score>]` | Exit with code 1 when the health score is below the threshold (default 100). |

Reports are written inside the audited project (`<project-dir>/audit-reports/`), which is usually git-ignored. Mention this to the user if the project does not ignore it.

### Reading the JSON report

The report contains `project` (framework, router type, TypeScript/Tailwind flags), `routes`, `summary` (`total`, `p0`–`p3`), `quickWins`, and `issues`. Each issue has:

| Field | Meaning |
|---|---|
| `category` | `Code Quality`, `Imports`, `Dependencies`, or `Assets`. Browser findings use `type: "browser"` and carry the check name in `status`. |
| `severity` | `P0`–`P3`. |
| `type` | Check id, e.g. `console-log`, `debugger`, `hardcoded-localhost`, `empty-handler`, `monster-component`, `unused-import`, `oversized-asset`, `legacy-format`. Dependency findings use `production` or `dev`. |
| `file`, `line` | Location relative to the project root (not set for dependency and browser findings). |
| `name`, `status` | For dependencies: the package name and `Confirmed Unused` or `Probably Unused`. |
| `confidence` | `High` or `Medium`. Verify every `Medium` finding before you repeat it to the user. |
| `problem`, `recommendation` | Ready-to-use explanation and fix. |

The health score is `100 - (20 × P0 + 10 × P1 + 5 × P2 + 2 × P3)`, floored at 0.

---

## What the CLI checks and what you check

The CLI is fast but heuristic. Use its output as a starting point, and cover the rest yourself by reading the code (and the rendered pages, when a browser or preview is available).

| Area | Automated by the CLI | You check manually |
|---|---|---|
| Code hygiene | `console.log/debug/info`, `debugger`, hardcoded `localhost` URLs, empty `onClick` handlers, files over `maxComponentLines` | Hardcoded secrets, `dangerouslySetInnerHTML` without sanitizing, `TODO`/`FIXME` in critical paths, components with many `useState` hooks, deep JSX nesting |
| Imports | Named/default imports never referenced in the file | Duplicate imports, dead exports, circular imports |
| Dependencies | Packages in `package.json` that are never imported | Packages used only from config files, CLIs, or `package.json` scripts (these show up as unused) |
| Assets | Images over `maxAssetSizeKB`, PNG/JPEG over 200 KB | Unreferenced assets, missing `width`/`height`, missing lazy loading |
| Responsive (`--url`) | Horizontal overflow and the elements causing it | Sticky headers covering content, modals taller than the viewport, broken grids, text overflow |
| Accessibility (`--url`) | Images without `alt`, small touch targets on mobile viewports | Form labels, icon-only buttons without names, heading order, `<html lang>`, focus-visible styles, color contrast, keyboard access |
| UX | Nothing | Loading, empty, error, and disabled states for data-driven UI |

Known false-positive patterns to rule out before reporting:
- An "unused" import may be used only in a type position or through JSX pragma setups; check the file.
- A "Confirmed Unused" dependency can still be needed by a build config (`postcss.config.js`, `babel.config.js`), a CLI in `scripts`, or a peer dependency.
- A `console-log` finding in a CLI tool or logger module may be intentional output.

---

## Workflow

### 1. Project Discovery & Route Mapping
- Run `audit --format=json` and read `project` and `routes` to learn the framework, router, and pages.
- Check build, lint, and dependency configurations (`package.json`, `tsconfig.json`, `tailwind.config.*`) for context the CLI does not use.

### 2. Static Code & Cleanliness Analysis
- Group the CLI's `issues` by category and verify a sample of each type in the source.
- Cover the manual rows of the table above for the files that matter most (entry points, shared components, checkout/auth flows).

### 3. Responsive & Runtime Browser Review
When the app can run locally, start it and re-run the audit with `--url`. It tests these viewports:
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
The CLI only audits the URL you pass. For other important routes from `routes`, run it again with that route's URL, or inspect them with your own browser tooling.

### 4. Accessibility (A11y) & UX Inspection
- **A11y:** Beyond the CLI's `alt` and touch-target checks, review form labels, icon-only buttons, heading hierarchy, `:focus-visible` outlines, and contrast (see [Accessibility Rules](rules/accessibility.md)).
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

The CLI assigns its own severities. Raise or lower them when the context justifies it (for example, a `console.log` that prints user data is worse than P3) and say why.

### 6. Safe Fixing Execution
When instructed to fix, adhere strictly to the **Safe Fixing Model**:
- **Safe (Automate):** Remove `console.log`, `debugger`, and unused imports. Run `fix --safe --dry-run` first, tell the user what will change, then run `fix --safe`, and review the diff (`git diff`) afterwards.
- **Review Required (Prompt User):** Removing unused dependencies, deleting suspected unused files, or refactoring CSS layouts. `suggest` prints the exact commands; show them and wait for approval.
- **Never Touch:** Never alter authentication, database queries, environment variables, or encryption keys.

After any fix, run the project's own checks (build, lint, tests) if they exist, and re-run the audit to confirm the findings are gone.

---

## Output Format

Give the user a report with:
1. **Executive summary:** framework, routes audited, health score, and counts per severity.
2. **Quick wins:** the CLI's `quickWins`, plus any you found manually.
3. **Findings by priority:** P0 first. Each with evidence (`file:line`, selector, or viewport), why it matters, and the fix.
4. **What was not checked:** for example, no browser audit because the app was not running.

The CLI can also produce the report files directly:
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
- [ ] CLI findings verified; Medium-confidence ones checked in the source before reporting.
- [ ] Manual checks from the coverage table done for the most important files and routes.
- [ ] Viewport responsiveness verified across 320px–1440px without horizontal scroll (or noted as not checked).
- [ ] Accessibility evaluated for landmarks, headings, labels, and touch targets.
- [ ] Dependencies categorized as confirmed unused vs potentially indirect.
- [ ] All code modifications limited to safe, non-breaking operations, previewed with `--dry-run` first.
- [ ] Unified quality report contains executive summary, quick wins, evidence, and prioritized fixes.
- [ ] Config file loaded and custom thresholds applied when present.
- [ ] Report generated in requested format(s) with evidence links.
