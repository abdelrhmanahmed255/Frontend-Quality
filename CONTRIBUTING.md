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
The project uses zero external dependencies. Everything is built with Node.js built-in modules.
1. Clone the repository.
2. Run the tool locally:
   ```bash
   node bin/auditor.mjs audit .
   ```

## Code Style
- Use ES Modules (`import`/`export`).
- Use `.mjs` extensions for all JavaScript files.
- **Do not** add external dependencies.

## Pull Request Guidelines
- Keep PRs focused: one feature or bugfix per PR.
- Write descriptive commit messages.
- Ensure all existing features still work (run the tool against itself).

## Testing
Run the auditor against its own source code as a smoke test:
```bash
node bin/auditor.mjs audit .
```
