## What and why

<!-- One or two sentences. Link the issue if there is one: Closes #123 -->

## How I tested it

- [ ] `pnpm typecheck && pnpm lint && pnpm test`
- [ ] `pnpm build` (CLI, MCP, build, or Next config changes)
- [ ] Checked desktop and phone widths, keyboard focus, and empty/loading states (UI changes)

## Checklist

- [ ] No prompts, code, paths, or secrets leave the machine
- [ ] Parser output changed → bumped `parserVersion` and `scripts/parser-versions.json`
- [ ] User-facing copy lives in `lib/i18n/dict.ts`
- [ ] Screenshots use `pnpm demo` data
- [ ] `CHANGELOG.md` updated under **Unreleased**
