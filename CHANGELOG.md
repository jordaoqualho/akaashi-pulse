# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **Insights page redesign**: ranked findings (spend change vs the previous window, project concentration, model price premium, cache savings, outlier sessions, long-session cost, idle time, busiest window), KPIs with period-over-period deltas, daily spend by request day, session-length profile with spend share, and a weekday × hour heatmap.
- **Active time**: sums gaps between model responses of up to 15 minutes, so cost per hour reflects focused work instead of wall-clock time with terminals left open.
- `pnpm demo` and `pnpm demo:data`: run the dashboard on deterministic synthetic Claude Code and Codex sessions.
- Community files: contributing guide, code of conduct, security policy, issue and pull request templates, CI workflow, Dependabot.

### Changed

- Session titles skip agent-injected context (`<browser_instruction>`, `<ide_selection>`, Codex IDE headers) and show what you actually typed. Claude parser `claude-v9-prompt-previews`, Codex parser `codex-v16-prompt-previews`.
- `pnpm dev` builds into `.next-dev`, so it no longer wipes the standalone bundle used by the background service.

### Fixed

- Collapsed sidebar: the expand button no longer gets squeezed or pushed out of the 68 px rail; the brand mark turns into the expand control on hover and keyboard focus.
- `pnpm test` failed in `test-project-scope` because `lib/utils.ts` re-exported currency helpers through a path alias that Node can't resolve.

## [1.0.0] - 2026-10-10

### Added

- Local dashboard for Claude Code, Codex CLI, Cursor, and Antigravity usage: overview, usage, limits, sessions, projects, models, tools, benchmark, and settings.
- CLI with an always-on login service (launchd and systemd), terminal report, and diagnostics.
- Read-only MCP server over stdio and HTTP.
- Committed pricing snapshot with an optional LiteLLM overlay.

[Unreleased]: https://github.com/jordaoqualho/akaashi-pulse/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/jordaoqualho/akaashi-pulse/releases/tag/v1.0.0
