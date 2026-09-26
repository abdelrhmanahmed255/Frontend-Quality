# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
