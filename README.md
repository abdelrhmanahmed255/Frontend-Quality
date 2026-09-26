<div align="center">

# 🩺 Frontend Quality Auditor

### Senior Frontend Reviewer & Project Maintenance Assistant for AI Coding Agents and Developers

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-0B7A53?style=for-the-badge" alt="License" />
  <img src="https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node" />
  <img src="https://img.shields.io/badge/Supports-React%20%7C%20Next.js%20%7C%20Vite-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="Frameworks" />
  <img src="https://img.shields.io/badge/Agent_Skill-Ready-8A2BE2?style=for-the-badge" alt="Agent Skill" />
</p>

</div>

---

## 💡 Overview

**Frontend Quality Auditor** turns AI coding agents (and CLI users) from passive code generators into **Senior Frontend Reviewers + Maintenance Engineers**.

Instead of guessing from static text, it inspects both:
1. **The Rendered Application** (across 8 viewport breakpoints, checking for horizontal scroll, overflow, a11y, and layout regressions).
2. **The Source Code & Project Structure** (detecting dead code, unused imports, zombie packages in `package.json`, bloated assets, and code hygiene violations).

It connects the evidence, rates findings by severity (**P0 – P3**), produces an actionable unified audit report, and **safely fixes what can be automated without breaking your app**.

---

## 🏗️ Architecture

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

## ✨ Key Capabilities

### 1. 📱 Responsive UI & Layout Review
- Inspects standard responsive viewports: `320px`, `375px`, `390px`, `430px`, `768px`, `1024px`, `1280px`, `1440px`.
- Identifies horizontal scroll bugs (`document.scrollWidth > window.innerWidth`).
- Detects broken responsive grids, overflowing modals/tables, stretched media, and sticky/fixed header collisions.

### 2. ♿ Accessibility (A11y) & UX Inspection
- Validates semantic landmarks, heading hierarchy (`h1`-`h6`), missing `alt` attributes, and form label associations.
- Checks touch target ergonomics (minimum 44×44px for mobile interactions).
- Flags missing UX feedback states: loading, empty, error, disabled, and validation warnings.

### 3. 🧹 Clean My Project (Code & Dependency Hygiene)
- **Dead Code & Imports:** Flags unused imports, duplicate imports, and dead exports.
- **Dependency Audit:** Compares `package.json` with actual project imports to detect unused or abandoned packages.
- **Asset Optimizer:** Flags unreferenced assets, oversized images (>500KB), and non-modern image formats (PNG/JPEG vs WebP/AVIF).
- **Code Quality:** Detects leftover `console.log`, `debugger`, empty handlers, hardcoded secrets/URLs, and monster components (>300 lines).

### 4. 🛡️ Safe Fixing Model
- **Safe (Automatic):** Strips `console.log`, `debugger`, removes verified unused imports, and formats code cleanly.
- **Approval Required (Interactive):** Deleting unused files, removing packages from `package.json`, or refactoring CSS/layout.
- **Never Automatic:** Never modifies authentication, database logic, environment variables, or security boundaries.

---

## 🚀 Quick Start

### As an AI Agent Skill (Antigravity, Claude, Cursor, Codex)

Clone or copy this repository into your agent's skills directory:

```bash
# Antigravity / Gemini
git clone https://github.com/abdelrhmanahmed255/Frontend-Quality.git ~/.gemini/antigravity/skills/frontend-quality-auditor

# Claude Code
git clone https://github.com/abdelrhmanahmed255/Frontend-Quality.git ~/.claude/skills/frontend-quality-auditor

# Cursor
git clone https://github.com/abdelrhmanahmed255/Frontend-Quality.git ~/.cursor/skills/frontend-quality-auditor
```

Whenever you chat with your AI agent, you can say:
> *"Audit my project with Frontend Quality Auditor and give me the quick wins."*  
> *"Review mobile responsiveness at 375px and fix safe code issues."*  
> *"Find unused dependencies, assets, and dead imports in my frontend."*

---

### As a Standalone CLI

You can also run it directly using Node.js or `npx`:

```bash
# Audit project and generate markdown report
npx frontend-quality-auditor audit

# Audit and suggest improvements with explanations
npx frontend-quality-auditor suggest

# Audit and automatically apply safe fixes (e.g. remove console.log, unused imports)
npx frontend-quality-auditor fix --safe
```

---

## ⚙️ Configuration (`config/auditor.config.json`)

Customize viewports, rule thresholds, and reporting output:

```json
{
  "framework": "auto",
  "viewports": [320, 375, 390, 768, 1024, 1440],
  "audit": {
    "responsive": true,
    "accessibility": true,
    "ux": true,
    "performance": true,
    "codeQuality": true,
    "dependencies": true,
    "assets": true
  },
  "rules": {
    "maxAssetSizeKB": 500,
    "maxComponentLines": 300,
    "disallowConsole": true,
    "checkUnusedImports": true,
    "checkUnusedDeps": true
  },
  "fixes": {
    "mode": "approval",
    "safeOnly": true
  }
}
```

---

## 📜 License

MIT License © 2026 [Abdelrhman Ahmed](https://github.com/abdelrhmanahmed255)