# Responsive UI & Layout Audit Rules

This reference defines inspection heuristics, common failure patterns, and remediation strategies for responsive design.

---

## 1. Standard Viewport Matrix

Evaluate layouts across 8 standard device breakpoints:

| Breakpoint | Typical Device Target | Primary Risks |
|---|---|---|
| **320px** | iPhone SE (1st gen), small Androids | Severe horizontal overflow, multi-column collapse, text wrapping |
| **375px** | iPhone SE / 13 mini / standard mobile | Fixed-width cards, oversized modals, button clipping |
| **390px** | iPhone 12/13/14/15/16 Pro | Modern mobile baseline, bottom-sheet collisions |
| **430px** | iPhone Pro Max, large Androids | Layout stretching, awkward column counts |
| **768px** | iPad Portrait, Android tablets | Half-desktop / half-mobile hamburger menu transitions |
| **1024px** | iPad Landscape, small laptops | Sidebar collision, grid crowding, table overflow |
| **1280px** | Standard laptop/desktop display | Content max-width containment, hero section alignment |
| **1440px** | Large widescreen desktop | Overextended line lengths (>80ch), floating headers |

---

## 2. Core Failure Modes & Detection Heuristics

### A. Horizontal Overflow (P0 / P1)
- **Heuristic:** `document.documentElement.scrollWidth > window.innerWidth`
- **Likely Causes:**
  - Hardcoded pixel widths: `width: 500px` on containers or cards.
  - Negative margins without clipping: `-mx-4` breaking outside container without `overflow-hidden`.
  - Fixed-width tables or data grids without horizontal scroll containers.
  - Wide unbreakable strings, URLs, or code blocks lacking `overflow-wrap: break-word` or `break-all`.
- **Recommended Fix:** Replace fixed widths with `max-w-full`, `w-full`, or logical grid units (`minmax(0, 1fr)`).

### B. Mobile Touch Targets (P1 / P2)
- **Heuristic:** Interactive elements (`<button>`, `<a>`, `<input>`, `<select>`) must measure at least **44 × 44 CSS pixels** on mobile viewports.
- **Likely Causes:** Icon-only buttons with `p-1` (e.g. 24×24px hit area), close buttons on modals crammed into corners.
- **Recommended Fix:** Increase padding or pseudo-element hit area (`after:absolute after:-inset-2`).

### C. Sticky & Fixed Header Collisions (P1 / P2)
- **Heuristic:** Fixed headers or bottom floating bars obscuring underlying interactive content or anchor links.
- **Likely Causes:** Missing `scroll-padding-top` on `html`, or missing bottom padding (`pb-20`) to clear a sticky footer/CTA.
- **Recommended Fix:** Set `scroll-padding-top: var(--header-height)` and add bottom safe-area padding.

### D. Modal & Drawer Viewport Escaping (P0 / P1)
- **Heuristic:** Modals exceeding viewport height without internal scrolling, hiding action buttons below the fold.
- **Recommended Fix:** Set `max-h-[90vh]` and `overflow-y-auto` on the modal body.

### E. Grid & Flex Wrap Failures (P2)
- **Heuristic:** Multi-column grids collapsing into unreadable slivers (e.g., 4 columns forced on 375px mobile).
- **Recommended Fix:** Mobile-first Tailwind grid classes: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`.
