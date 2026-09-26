# Contributing

Thanks for helping improve the Frontend Quality Auditor!

## Reporting Bugs
1. Open an issue on GitHub.
2. Provide clear reproduction steps.
3. Include the command you ran and the exact output.

## Suggesting Features
1. Open an issue to discuss your idea before writing code.
2. Once discussed and agreed upon, open a pull request (PR).

## Development Setup
The static audit uses only Node.js built-in modules. Playwright is the one runtime dependency, and it is loaded only when you run a browser audit with `--url`.
1. Clone the repository.
2. Run the tool locally:
   ```bash
   node bin/auditor.mjs audit .
   ```

## Code Style
- Use ES Modules (`import`/`export`).
- Use `.mjs` extensions for all JavaScript files.
- **Do not** add new runtime dependencies without discussing it in an issue first. Code that is only needed for an optional feature should be imported lazily (see `src/analyzers/run-browser-audit.mjs`).

## Pull Request Guidelines
- Keep PRs focused: one feature or bugfix per PR.
- Write descriptive commit messages.
- Ensure all existing features still work (run the tool against itself).

## Testing
Run the auditor against its own source code as a smoke test:
```bash
node bin/auditor.mjs audit .
```
