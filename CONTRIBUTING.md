# Contributing to usage-pulse

Thanks for helping. Bug reports, ideas and pull requests are all welcome.

## Reporting a bug

Open an issue with:

- your Claude Code version (`claude --version`) and surface (terminal, VS Code, desktop);
- what the bar showed and what you expected;
- a screenshot if it is a display problem.

## Suggesting a feature

Open an issue first, so we can agree on the idea before you spend time on it. The bar is meant to stay one calm line, so new items usually belong in the `/usage-pulse` pane instead.

## Making a change

1. Fork the repository and create a branch.
2. Run Claude Code with your working copy loaded:
   ```
   claude --plugin-dir .
   ```
   It reloads the plugin when you save.
3. Check your change:
   ```
   claude plugin validate .
   npx tsc -p .
   ```
4. If you change the fields of a value kept in state (`types/index.d.ts`), bump that atom's `shape` tag in `hooks/register.tsx`, so values stored by an older version are discarded instead of misread.
5. Open a pull request that says what changed and why, with a screenshot for any visual change.

## Guidelines

- Keep the bar short. Every item has to earn its place.
- Use the soft colours in `SOFT` so the bar stays easy on the eyes in dark and light themes.
- The plugin must not make network requests or model calls. It has to stay free to run.
- Keep the user-facing text in plain English.

## License

By contributing you agree that your contributions are licensed under the [MIT License](LICENSE).
