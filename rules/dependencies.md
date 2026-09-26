# Dependency Audit Rules

This reference outlines rules for detecting unused, abandoned, or redundant packages in `package.json`.

---

## 1. Classification Categories

When analyzing `dependencies` and `devDependencies`, classify each package into three confidence tiers:

```text
┌─────────────────────────┐
│ Confirmed Unused (High) │ -> No import or require found in any source file.
├─────────────────────────┤
│ Probably Unused (Medium)│ -> No direct import, but could be a CLI tool, plugin, or config.
├─────────────────────────┤
│ Directly Used (Verified)│ -> Verified direct import or usage in source/build scripts.
└─────────────────────────┘
```

---

## 2. Common Indirect & False-Positive Dependencies

Never mark these as "Confirmed Unused" solely based on missing `import` statements:
- **Build & Transpilation:** `postcss`, `autoprefixer`, `tailwindcss`, `typescript`, `@types/*`, `eslint*`, `prettier*`.
- **CSS Preprocessors & Loaders:** `sass`, `less`, `babel-loader`.
- **Testing Runtimes:** `jest`, `vitest`, `@testing-library/*`, `playwright`, `cypress`.
- **Server Framework Runtimes:** `sharp` (for Next.js image optimization), `cross-env`.

---

## 3. Deprecated & Heavy Package Heuristics (P2)

Flag packages that have superior, modern, lightweight replacements:

| Heavy / Legacy Package | Modern Recommended Replacement | Benefit |
|---|---|---|
| `moment` | `date-fns` or `dayjs` | ~250 KB smaller bundle |
| `request` | `node-fetch` or native `fetch` | Deprecated library |
| `uuid` (for client) | `crypto.randomUUID()` | Native browser support |
| `lodash` | `lodash-es` or native methods | Tree-shakable |
| `axios` (simple use cases) | Native `fetch` with typed wrapper | 0 dependencies |
