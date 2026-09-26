# Frontend Performance Audit Rules

This reference outlines evidence-based heuristics for static and runtime frontend performance.

---

## 1. Asset & Media Optimization (P1 / P2)

- **Modern Formats:** Prefer **WebP** or **AVIF** over raw PNG/JPEG for photographs and rich banners.
- **Asset Size Thresholds:**
  - Individual image assets should not exceed **500 KB** (flag images > 1 MB as P1).
  - SVGs should not contain embedded raster base64 or editor bloat (Inkscape/Illustrator metadata).
- **Explicit Dimensions:** Images and videos must include explicit `width` and `height` attributes (or aspect-ratio styles) to prevent layout shifts (CLS).
- **Lazy Loading:** Off-screen images should specify `loading="lazy"` or use Next.js `next/image` with automatic optimization.

---

## 2. JavaScript Bundle & Rendering Heuristics (P1 / P2)

- **Heavy Dependency Replacement:**
  - `moment.js` (290KB) ➔ `date-fns` or native `Intl.DateTimeFormat`.
  - `lodash` (full import) ➔ `lodash-es` or targeted native array methods.
- **Dynamic Imports / Code Splitting:**
  - Heavy client components (rich text editors, chart libraries, maps) must be dynamically imported via `next/dynamic` or `React.lazy`.
- **Client vs Server Boundaries (Next.js App Router):**
  - Do not use `"use client"` on root layout or pages unless state/effects are strictly required; push client boundaries down to leaf interactive widgets.

---

## 3. Web Fonts & CSS (P2 / P3)

- **Font Display:** Web font declarations must include `font-display: swap` to prevent Flash of Invisible Text (FOIT).
- **Subsetting:** Only include required font weights and language character sets.
- **CSS Bloat:** Avoid unused custom CSS frameworks when Tailwind or atomic CSS is already bundled.
