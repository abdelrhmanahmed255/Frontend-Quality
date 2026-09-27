# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.1] - 2026-09-26

### Added
- Playwright-powered browser audit with `--url=<url>`: horizontal overflow (with offending elements), missing image `alt`, and small touch targets across 8 viewports from 320px to 1440px
- GitHub Action that publishes to npm when a `v*` tag is pushed

## [2.0.0] - 2026-09-26

### Added
- `--strict[=<score>]` CI mode that exits with code 1 when the health score is below the threshold
- `--dry-run` for `fix`, to preview safe fixes without writing files
- `--format=markdown|json|terminal`, `--output=<path>`, and `--verbose` CLI options, plus an execution timer and progress spinner
- Health score in terminal and markdown reports, and an Imports category
- Unused import removal in the safe fix engine
- `frontend-quality-auditor` bin name, so `npx frontend-quality-auditor` works
- String and comment aware matching for safe fixes (`src/utils/safe-string-search.mjs`)

### Changed
- Analyzers read files with async I/O and run in parallel
- Expanded list of framework and tooling packages that are never reported as unused dependencies
- Dependency findings include a `problem` description

## [1.0.0] - 2026-09-26

### Added
- Core audit engine with 7 analysis categories
- Static analyzers: code quality, imports, dependencies, assets
- Project detection for Next.js, React, Vite, Remix, and static HTML
- Route discovery for App Router, Pages Router, and React Router
- Browser runtime DOM inspection heuristics (Playwright-ready)
- Three report formats: terminal, markdown, JSON
- Safe auto-fix engine for console.log and debugger removal
- Approval guidance system for risky changes
- Config file support (auditor.config.json) with configurable thresholds
- CLI with audit, suggest, and fix commands
- AI agent skill specification (SKILL.md) for Gemini, Claude, Cursor
- 7 detailed rule reference documents
