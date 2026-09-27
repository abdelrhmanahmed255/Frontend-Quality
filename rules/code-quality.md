# Code Quality & Hygiene Audit Rules

This reference outlines rules for detecting frontend code smells, security oversights, and maintainability debt.

---

## 1. Debugging & Development Leftovers (P2 / P3)

- **`console.log` / `console.debug` (P3):** Leftover logging statements pollute the production console and can leak sensitive payload data.
- **`debugger` (P1):** Unremoved `debugger` statements cause production freezes when dev tools are opened.
- **Empty Handlers (P3):** Handlers like `onClick={() => {}}` indicate unfinished features or dead click targets.
- **Unresolved Stubs:** Unresolved `TODO` or `FIXME` comments in critical checkout, auth, or validation paths.

---

## 2. Security & Environment Leaks (P0 / P1)

- **Hardcoded Secrets:** API keys, private tokens, or database connection strings hardcoded in client-side code.
  - The CLI reports credentials with a known prefix (AWS, GitHub, Stripe live keys, Slack, OpenAI/Anthropic, PEM private keys) as **P0**, and `apiKey = "..."`-style assignments with key-like values as **P1** (medium confidence).
  - Reports only show a masked prefix of the value. Treat any real hit as leaked: rotate the key, then move it server-side. Deleting the line does not remove it from git history.
- **Hardcoded URLs:** Hardcoded `http://localhost:3000` or production backend URLs that should be loaded from environment variables (`process.env.NEXT_PUBLIC_*` or `import.meta.env.*`).
- **Dangerous HTML Injection:** Unsanitized usage of `dangerouslySetInnerHTML` without DOMPurify or equivalent escaping.

---

## 3. Component Architecture & Maintainability (P2)

- **Monster Components (> 300 lines):**
  - Single JSX files exceeding 300 lines are prime candidates for decomposition.
  - Components with > 8 `useState` calls usually indicate mixed concerns (split into custom hooks or smaller subcomponents).
- **Deeply Nested JSX (> 5 levels):** Excessive DOM nesting degrades readability and render tree traversal.
- **Inline Magic Numbers / Colors:** Avoid scattered arbitrary values like `margin: 37px` or `color: #4a21e8` when design tokens or theme variables exist.
