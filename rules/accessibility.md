# Accessibility (A11y) Audit Rules

Based on WCAG 2.1 Level AA criteria, this reference outlines heuristics for automated and inspection-driven accessibility reviews.

---

## 1. Landmarks & Semantic Structure (P1 / P2)

- **One `<main>` element per page:** Every route must contain exactly one `<main>` landmark.
- **Header & Navigation:** Top-level navigation must reside inside `<nav aria-label="...">`.
- **Heading Order Hierarchy:**
  - One `<h1>` per page reflecting the primary purpose.
  - No skipping heading levels (e.g., `<h1>` followed directly by `<h4>`).
  - Headings must not be used solely for visual styling (use typography utility classes instead).

---

## 2. Text Alternatives & Meaningful Names (P0 / P1)

- **Images:**
  - Informative images must provide descriptive `alt="Description of image content"`.
  - Decorative images must explicitly set `alt=""` or `aria-hidden="true"`.
- **Icon-Only Buttons & Links:**
  - Every `<button>` or `<a>` with only SVG/icon children MUST provide an `aria-label` or visually hidden screen reader text:
    ```html
    <!-- Correct -->
    <button aria-label="Close dialog">
      <svg aria-hidden="true">...</svg>
    </button>
    ```

---

## 3. Forms & Input Accessibility (P0 / P1)

- **Form Labels:** Every `<input>`, `<textarea>`, and `<select>` must be associated with a `<label>` via matching `id` and `htmlFor`, or wrapped in `<label>`.
- **Error Messages:** Associate error text with the input using `aria-describedby="input-error"` and set `aria-invalid="true"`.
- **Autocomplete:** Common identity fields (name, email, tel, street-address, postal-code) must supply standard `autocomplete` attributes.

---

## 4. Keyboard Navigation & Focus Indicators (P0 / P1)

- **Focus Visible:** Never remove focus outlines globally using `outline: none` or `outline-none` without an accessible `:focus-visible` replacement (`focus-visible:ring-2`).
- **Interactive Role Integrity:**
  - Never place `onClick` on a `<div>` or `<span>` without `role="button"`, `tabIndex={0}`, and `onKeyDown` handlers (prefer a native `<button>` element).
- **Focus Trapping:** Active modal dialogs must trap keyboard `Tab` cycles within the dialog and release focus upon closing.

---

## 5. Color Contrast (P1 / P2)

- **Normal Text (< 18pt or 24px):** Contrast ratio of at least **4.5:1** against background.
- **Large Text (>= 18pt bold or 24px regular):** Contrast ratio of at least **3.0:1**.
- **UI Components & Icons:** Contrast ratio of at least **3.0:1** against adjacent backgrounds.
