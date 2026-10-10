# CLAUDE.md — AKAASHI Pulse

Repo-local rules for Claude Code sessions. If this file conflicts with
`~/.claude/CLAUDE.md`, the global file wins (Claude Code precedence). For
architecture, commands, and invariants, follow **AGENTS.md** first.

## Product

**AKAASHI Pulse** is the official local analytics stack for Claude Code, Codex
CLI, Cursor, and Antigravity — dashboard, CLI/service, and read-only MCP. It is MIT-licensed and
intended for public open source. Branding in UI and docs: **AKAASHI Pulse** /
`akaashi-pulse` (package and CLI name). Do not add references to unrelated
upstream project names or old env prefixes.

## Commits and git

**Never auto-commit.** Leave work unstaged/unpushed unless the user explicitly
asks to commit in the **current** turn (e.g. “commit and push”, “faça o commit”).
That includes `git add -A` + commit, amend, rebase, tags, releases, and
`gh pr create` — all only on explicit request.

Use the git identity already configured on the machine. **Do not run
`git config`** from an agent session. No AI-attribution trailers in commit
messages.

## What to run

| Task | Command |
| --- | --- |
| Dev dashboard (manual) | `pnpm dev` → :3738 |
| Checks | `pnpm typecheck`, `pnpm lint`, `pnpm test` |
| Production artifacts | `pnpm build` |
| Local service | `node bin/cli.mjs service …` |

After **parser / indexer** changes, remind to restart the service
(`node bin/cli.mjs service restart`). UI-only changes usually hot-reload on the
default dev install.

## Editing guidelines

- English-only user-facing strings via `lib/i18n/dict.ts`.
- Light theme only; keep no-flash script and theme defaults consistent.
- Privacy: no exfiltration of prompts, code, or paths via new features; AKAASHI
  OS stays aggregate-only and opt-in.
- Prefer small, focused diffs and existing patterns in the file you touch.

When unsure about data flow, parsers, or pricing, read **AGENTS.md** before
refactoring.
