# User Experience (UX) State Audit Rules

This reference outlines expected user interaction states, feedback affordances, and defensive UX patterns.

---

## 1. The 4 Essential UI States

Every data-driven container (lists, tables, feeds, profiles, dashboards) must explicitly handle four visual states:

```text
┌──────────────┐     ┌──────────────┐
│ Loading      │ ──> │ Success/Data │
└──────────────┘     └──────────────┘
       │                    │
       ↓                    ↓
┌──────────────┐     ┌──────────────┐
│ Error/Retry  │     │ Empty State  │
└──────────────┘     └──────────────┘
```

### A. Loading States (P2)
- Use content skeletons or contextual spinners instead of blank empty screens.
- Avoid full-page blocking loaders for small component updates.
- Keep layout heights stable during loading to prevent Cumulative Layout Shift (CLS).

### B. Empty States (P2)
- Clearly inform the user that no items exist yet, explain why, and provide a clear setup action (e.g. *"No products added yet. Click 'Add Product' to get started."*).
- Never render a blank white container or table with empty borders.

### C. Error States & Recovery (P1)
- Never show cryptic JSON responses or raw stack traces to users.
- Provide a clear explanation of what went wrong and an immediate retry action button (*"Try Again"*).
- Preserve user form entries so network or server errors do not wipe out typed text.

### D. Disabled States (P2)
- Form submit buttons should show disabled styling (`opacity-50 cursor-not-allowed`) when validation fails or during active submission.
- When disabled, provide a visual tooltip or message explaining what is missing.

---

## 2. Interactive Feedback Affordances (P2 / P3)

- **Hover & Active States:** All clickable elements must supply hover and active feedback (`hover:bg-primary-hover active:scale-[0.98]`).
- **Submit Feedback:** Buttons triggering async actions should display an inline loading spinner and prevent duplicate clicks.
- **Toasts & Notifications:**
  - Auto-dismiss non-critical alerts after 4–6 seconds.
  - Never auto-dismiss critical error toasts before the user has read or acknowledged them.
  - Toast notifications must be announced via `aria-live="polite"`.

---

## 3. Navigation & Modal UX (P1 / P2)

- **Back Button Preservation:** Modals and full-screen drawers should ideally sync with URL hash or state to avoid breaking the browser back button.
- **Escape Key:** Pressing `Esc` must close open dropdowns, tooltips, and modals.
- **Click Outside:** Clicking outside a modal backdrop or dropdown menu must close it.
