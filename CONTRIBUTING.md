# Contributing to AKAASHI Pulse

Thanks for helping. Pulse is a small, local-first codebase. These notes keep changes easy to review and keep users' data safe.

## Ground rules

1. **Privacy first.** Never add a feature that sends prompts, responses, file paths, environment variables, or source code off the machine. Any network call needs an off switch, and the AKAASHI OS integration must stay aggregate-only and opt-in.
2. **Agent logs are read-only.** Never write to `~/.claude`, `~/.codex`, Cursor, or Antigravity files.
3. **No invented numbers.** Prices come from the pricing table, limits from agent telemetry. Do not estimate quotas from token totals.
4. **Small, focused pull requests** that match the style of the files you touch.

[AGENTS.md](AGENTS.md) lists the architecture invariants. Read it before changing parsers, the indexer, or pricing.

## Setup

```bash
pnpm install
pnpm demo        # dashboard on synthetic data → http://127.0.0.1:3739
pnpm dev         # dashboard on your own logs  → http://127.0.0.1:3738
```

Use `pnpm demo` for screenshots and bug reports so no real prompts or project names leak into public issues. `pnpm demo:data` regenerates the dataset without starting the server.

## Before you open a pull request

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build       # required if you touched the CLI, MCP, build scripts, or Next config
```

### Parser and indexer changes

- Bump the provider's `parserVersion` and update `scripts/parser-versions.json` whenever parsed output can change, so cached indexes rebuild.
- Add or extend a test in `scripts/test-*.mjs` with a minimal fixture.
- Restart the local service to pick up the change: `node bin/cli.mjs service restart`.

### UI changes

- User-facing copy goes in `lib/i18n/dict.ts` (English).
- Reuse the tokens and primitives in `app/globals.css` and the existing components. Don't ship unstyled native controls (`<select>`, checkboxes, date inputs); use the shared custom components, which keep keyboard support and ARIA roles.
- Check desktop and phone widths, keyboard focus, and the loading, empty, and error states.
- Attach before/after screenshots taken with `pnpm demo`.

## Commit messages

Use short, imperative subjects (`Fix collapsed sidebar toggle`, `Add weekly rhythm heatmap`). Explain *why* in the body when it isn't obvious.

## Reporting bugs and ideas

Open an [issue](https://github.com/jordaoqualho/akaashi-pulse/issues/new/choose). Include `node bin/cli.mjs doctor` output, and **redact paths and project names** before posting. Report security problems privately (see [SECURITY.md](SECURITY.md)).

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE) and that you follow the [Code of Conduct](CODE_OF_CONDUCT.md).
