<p align="center">
  <img src="assets/banner.jpg" alt="Frontend Quality Auditor" width="100%" />
</p>

<p align="center">
  <img src="assets/logo.jpg" alt="Frontend Quality Auditor Logo" width="150" />
</p>

# Frontend Quality Auditor

A CLI tool and AI agent skill that audits your frontend projects — finds dead code, unused deps, accessibility issues, and responsive layout bugs. Then it generates a clear report and can auto-fix the safe stuff.

Built this because I got tired of shipping code with leftover `console.log` statements, 3MB hero images, and packages sitting in `package.json` that nobody actually imports. This tool catches all of that.

---

## Install

### As an AI Agent Skill

**Option 1: Using the MCP Server (Recommended for Claude Desktop, Cursor, etc.)**
You can plug this tool directly into any AI that supports the Model Context Protocol (MCP) without cloning anything! Just add this to your AI's MCP settings file:

```json
{
  "mcpServers": {
    "frontend-auditor": {
      "command": "npx",
      "args": ["-y", "frontend-quality-auditor", "mcp"]
    }
  }
}
```

**Option 2: Manual Clone**
If your agent doesn't support MCP yet, clone it into your agent's skills folder:

```bash
# Gemini / Antigravity
git clone https://github.com/abdelrhmanahmed255/Frontend-Quality.git ~/.gemini/skills/frontend-quality-auditor

# Claude Code
git clone https://github.com/abdelrhmanahmed255/Frontend-Quality.git ~/.claude/skills/frontend-quality-auditor

# Cursor
git clone https://github.com/abdelrhmanahmed255/Frontend-Quality.git ~/.cursor/skills/frontend-quality-auditor
```

Install the CLI's dependencies once inside the cloned folder:

```bash
cd ~/.claude/skills/frontend-quality-auditor   # or the folder you cloned into
npm install
```

Then just tell your agent something like:
> "Audit my project for code quality and responsive issues"

### As a CLI

```bash
# run directly without installing
npx frontend-quality-auditor audit .

# or install globally
npm install -g frontend-quality-auditor
```

### As a Project Dependency (Recommended)

To run audits in CI or as a regular check before committing:

```bash
npm install --save-dev frontend-quality-auditor
```

Then add scripts to your `package.json`:

```json
{
  "scripts": {
    "audit": "frontend-quality-auditor audit .",
    "audit:fix": "frontend-quality-auditor fix --safe",
    "audit:ci": "frontend-quality-auditor audit . --strict --format=sarif"
  }
}
```

Run them using:
```bash
npm run audit
npm run audit:fix
```

---

## Usage

```bash
# Full audit — prints to terminal + saves a markdown report
frontend-auditor audit

# Same audit but on a specific directory
frontend-auditor audit ./my-app

# Get suggestions without touching any files
frontend-auditor suggest

# Auto-fix safe issues (removes console.log, debugger, etc.)
frontend-auditor fix --safe

# Exit with code 1 when there is any P0 or P1 finding (useful as a CI gate)
frontend-auditor audit --fail-on=P1
```

The audit generates a markdown report at `audit-reports/FRONTEND_AUDIT_REPORT.md` with severity ratings, quick wins, and file-level evidence.

### Options

| Option | What it does |
|---|---|
| `--format=json` | Print the report as JSON and save it to `audit-reports/FRONTEND_AUDIT_REPORT.json` |
| `--format=markdown` | Only write the markdown report (no terminal report) |
| `--output=<path>` | Write the report file to a custom path |
| `--verbose` | Show every finding in the terminal instead of the top 15 |
| `--url=<url>` | Also run the browser audit against a running app (see below) |
| `--dry-run` | With `fix --safe`: show what would change without touching files |
| `--strict[=<score>]` | Exit with code 1 when the health score is below `<score>` (100 if omitted) |

### Browser audit

Start your dev server, then pass its URL:

```bash
npx playwright install chromium   # one-time browser download
frontend-auditor audit . --url=http://localhost:3000
```

The page is loaded in headless Chromium at 8 widths (320px to 1440px) and checked for horizontal overflow (with the elements causing it), images without `alt`, and small touch targets on mobile.

### CI

`--strict` turns the health score into a pass/fail check:

```bash
# fail the job if the health score drops below 80
npx frontend-quality-auditor audit . --strict=80
```

The health score starts at 100 and loses 20 points per P0, 10 per P1, 5 per P2, and 2 per P3 finding.

---

## What It Checks

| Category | What it looks for |
|---|---|
| **Code Quality** | `console.log`, `debugger`, hardcoded `localhost` URLs, hardcoded API keys and tokens, empty click handlers, monster components (300+ lines) |
| **Imports** | Unused imports that are imported but never referenced in the file |
| **Dependencies** | Packages in `package.json` that are never imported anywhere in your code |
| **Assets** | Images over 500KB, old formats (PNG/JPG) that should be WebP/AVIF, unreferenced files |
| **Responsive** | Horizontal scroll overflow, broken grids, elements bleeding outside viewport |
| **Accessibility** | Missing `alt` tags, unlabeled form fields, icon-only buttons and links without an accessible name, missing `<h1>` or skipped heading levels, missing `<html lang>`, small touch targets (<44px) |

Every finding gets a severity level:
- **P0** — breaks the page, fix now
- **P1** — major problem, fix before shipping
- **P2** — noticeable issue, fix when you can
- **P3** — minor cleanup, nice to have

---

## GitHub code scanning

`--format=sarif` writes `audit-reports/FRONTEND_AUDIT_REPORT.sarif`, which GitHub can show as code scanning alerts and inline annotations on pull requests:

```yaml
- run: npx frontend-quality-auditor audit . --format=sarif
- uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: audit-reports/FRONTEND_AUDIT_REPORT.sarif
    category: frontend-quality
```

The job needs `permissions: security-events: write` for the upload. P0/P1 findings become errors, P2 warnings, and P3 notes. Browser findings from `--url` have no source file, so they are only in the other report formats.

---

## Config

Drop a `config/auditor.config.json` in your project root to customize thresholds:

```json
{
  "viewports": [375, 768, 1280],
  "audit": {
    "codeQuality": true,
    "dependencies": true,
    "assets": true
  },
  "rules": {
    "maxAssetSizeKB": 500,
    "maxComponentLines": 300,
    "disallowConsole": true,
    "disallowDebugger": true,
    "checkUnusedImports": true,
    "checkUnusedDeps": true
  },
  "reporting": {
    "outputDir": "./audit-reports"
  }
}
```

| Option | Effect |
|---|---|
| `viewports` | Widths (px) tested by the browser audit (`--url`). Defaults to 320–1440. |
| `audit.codeQuality` / `audit.dependencies` / `audit.assets` | Set to `false` to skip that whole category. |
| `rules.maxAssetSizeKB` | Images above this size are reported as oversized. |
| `rules.maxComponentLines` | Files longer than this are reported as monster components. |
| `rules.disallowConsole` / `rules.disallowDebugger` | Set to `false` to stop reporting (and auto-fixing) `console.*` or `debugger`. |
| `rules.checkUnusedImports` / `rules.checkUnusedDeps` | Set to `false` to skip unused import or unused dependency detection. |
| `reporting.outputDir` | Where report files are written, relative to the audited project. |

Any option you leave out keeps its default, and if no config file exists the defaults are used.

---

## Supported Frameworks

Auto-detects your setup:
- Next.js (App Router & Pages Router)
- React + Vite / CRA
- Remix
- Static HTML/CSS
- Tailwind CSS
- TypeScript

---

## Project Structure

```
Frontend-Quality/
├── .github/workflows/
│   └── npm-publish.yml          # Publishes to npm on v* tags
├── bin/
│   └── auditor.mjs              # CLI entrypoint
├── config/
│   └── auditor.config.json      # Default configuration
├── rules/                       # Reference docs for each audit category
│   ├── accessibility.md
│   ├── assets.md
│   ├── code-quality.md
│   ├── dependencies.md
│   ├── performance.md
│   ├── responsive.md
│   └── ux.md
├── src/
│   ├── index.mjs                # Main orchestrator
│   ├── config-loader.mjs        # Reads and merges config
│   ├── analyzers/
│   │   ├── project-detector.mjs # Detects framework, TS, Tailwind
│   │   ├── route-discovery.mjs  # Finds all routes
│   │   ├── import-analyzer.mjs  # Unused import detection
│   │   ├── dependency-analyzer.mjs
│   │   ├── asset-analyzer.mjs
│   │   ├── code-analyzer.mjs    # console.log, debugger, etc.
│   │   ├── browser-analyzer.mjs # DOM checks that run inside the page
│   │   └── run-browser-audit.mjs # Drives Playwright across viewports (--url)
│   ├── reporters/
│   │   ├── terminal.mjs
│   │   ├── markdown.mjs
│   │   └── json.mjs
│   ├── fixes/
│   │   ├── safe-fixes.mjs       # Removes console.log, debugger, unused imports
│   │   └── approval-required.mjs
│   └── utils/
│       └── safe-string-search.mjs # Blanks strings/comments before matching code
├── assets/
│   └── banner.jpg
├── CHANGELOG.md
├── CONTRIBUTING.md
├── SKILL.md                     # Agent skill specification
├── package.json
├── LICENSE
└── README.md
```

---

## Contributing

Got a bug or feature idea? Open an issue first so we can talk about it, then submit a PR. Keep it simple.

---

## License

MIT © [Abdelrhman Ahmed](https://github.com/abdelrhmanahmed255)