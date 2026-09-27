# Asset Audit Rules

This reference outlines rules for detecting unreferenced, duplicate, and oversized media assets in frontend repositories.

---

## 1. Asset Detection Heuristics

Scan typical asset directories:
- `public/`
- `src/assets/`
- `app/assets/` or `assets/`

File types evaluated: `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp`, `.avif`, `.mp4`, `.woff`, `.woff2`, `.ttf`.

---

## 2. Classification & Scoring

### A. Oversized Files (> 500 KB) (P1 / P2)
- Flag any individual image or media file exceeding **500 KB**.
- Flag files exceeding **1.5 MB** as **P1 High Priority**.
- Provide exact byte size, file location, and suggested conversion to WebP or AVIF.

### B. Potentially Unreferenced Assets (P2 / P3)
- Check whether the filename (without extension and with extension) appears in:
  - Source code (`src/`, `app/`, `components/`)
  - Stylesheets (`*.css`, `*.scss`, `*.module.css`)
  - Config files (`tailwind.config.*`, `next.config.*`)
- Mark as **"Potentially Unused" (Medium Confidence)** rather than confirmed deleted, because dynamic imports (e.g. ``/images/avatar-${id}.png``) or external CDN references may exist.
- The CLI reports these as `unreferenced-asset` (P3) when the file name appears in no code, style, markup, Markdown, JSON, or web manifest file. Conventional files that browsers request on their own (`favicon.*`, `apple-touch-icon*`, `android-chrome*`, `mstile*`) are skipped.

### C. Non-Modern Image Formats (P3)
- Flag raster images in legacy formats (`.png`, `.jpg`) that could achieve 40–80% compression when converted to `.webp` or `.avif`.
