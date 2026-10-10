# AKAASHI Pulse

Local dashboard and tooling for Claude Code, OpenAI Codex CLI, Cursor, and
Antigravity usage: tokens, models, projects, sessions, activity, supported
account limits, and API-equivalent cost estimates. Cursor and Antigravity are
activity-only integrations until their logs contain explicit usage and Pulse
has a matching price table.

**Private-first, local-only.** Data stays on your machine. Optional aggregate sync
to AKAASHI OS is off by default. The project is MIT-licensed and intended for
public open source release.

## Requirements

Node.js 20+ and [pnpm](https://pnpm.io/).

## Quick start

```bash
pnpm install
pnpm build
node bin/cli.mjs service install   # macOS LaunchAgent → http://127.0.0.1:3737
```

The persistent service uses the prebuilt standalone server by default. This
avoids waiting for Next.js to compile the whole dashboard after login. During
UI development, use the source mode explicitly:

```bash
node bin/cli.mjs service install --dev
```

Source mode enables hot reload for `app/`, `components/` and styles, but its
first page can take longer while Next.js compiles the route. The service mode
keeps the local index cache in `~/.akaashi-pulse/cache/` and reuses unchanged
JSONL files across restarts.

## Commands

```bash
node bin/cli.mjs service status | restart | uninstall
pnpm dev                              # manual dev server on :3738
node bin/cli.mjs report --json
node bin/cli.mjs mcp                  # MCP over stdio
node bin/cli.mjs doctor
```

## Runtime layout

| Path | Role |
| --- | --- |
| `app/` | Next.js dashboard and HTTP API (including read-only MCP) |
| `components/` | UI |
| `lib/` | Parsers, indexer, pricing, MCP, integrations |
| `bin/cli.mjs` | CLI, background service, terminal report |
| `scripts/` | Build helpers and test suites (`pnpm build`, `pnpm test`) |
| `dist/` | Built MCP and CLI report bundles |

State, index cache, and logs: `~/.akaashi-pulse/` (override with
`AKAASHI_PULSE_STATE_DIR`).

The Settings page discovers the standard folders for the current OS. Additional
provider folders can be added there; they are persisted in
`~/.akaashi-pulse/config.json` and watched read-only. Cursor transcripts are
read from `~/.cursor/projects/**/agent-transcripts/**` (or
`CURSOR_AGENT_HOME` / `AKAASHI_PULSE_CURSOR_DIR`). Antigravity transcripts are
read from `~/.gemini/antigravity/brain/**/.system_generated/logs/transcript.jsonl`
and the CLI equivalent (or `AKAASHI_PULSE_ANTIGRAVITY_DIR`). SQLite stores are
never modified; they are used only for the metadata discovery card when a
JSONL transcript is unavailable.

Project analytics are scoped automatically to `~/Workspaces` (or
`~/workspaces`) when that folder exists. This keeps unrelated folders from
appearing as projects. Change the roots from Settings → Providers, choose to
include every local project path, or set `AKAASHI_PULSE_PROJECT_ROOTS` to a
comma-separated list of absolute paths.

### Claude Code limits

Claude Code exposes plan-limit telemetry through its supported status-line
input. Add this to Claude Code's settings (use an absolute path):

```json
"statusLine": {
  "type": "command",
  "command": "node /ABSOLUTE/PATH/akaashi-pulse/scripts/claude-statusline.mjs"
}
```

Pulse does not edit `~/.claude/settings.json` for you. After installing it,
send one model response on a supported Pro/Max plan; Claude then creates the
local snapshot at `~/.akaashi-pulse/claude-rate-limits.json`, which the Limits
page reads on each scan request. The status line itself prints only compact
`5h / 7d` percentages and never persists prompts, cwd, or session text.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `AKAASHI_PULSE_STATE_DIR` | Runtime data directory |
| `AKAASHI_PULSE_CONFIG_DIR` | Extra Claude Code config root (also `CLAUDE_CONFIG_DIR`) |
| `AKAASHI_PULSE_CODEX_DIR` | Codex home (also `CODEX_HOME`) |
| `AKAASHI_PULSE_CURSOR_DIR` | Cursor data root (also `CURSOR_AGENT_HOME`) |
| `AKAASHI_PULSE_ANTIGRAVITY_DIR` | Antigravity data root under `.gemini` |
| `AKAASHI_PULSE_PROJECT_ROOTS` | Comma-separated project roots used by analytics (also accepts singular `AKAASHI_PULSE_PROJECT_ROOT`) |
| `AKAASHI_PULSE_OFFLINE` | `1` disables LiteLLM pricing refresh |
| `AKAASHI_PULSE_DEBUG` | Verbose indexer logging |
| `AKAASHI_PULSE_MCP_PRETTY` | Pretty-print MCP tool JSON |
| `AKAASHI_PULSE_POLL_FALLBACK` | `1` / `0` force file polling when watchers are unavailable |

## Privacy

- Reads only existing local JSONL session files for token and cost analytics.
- When present, reads Cursor and Antigravity transcript JSONL plus local SQLite
  metadata read-only for conversation/activity counts; it does not estimate
  their cost without explicit usage and pricing.
- Does not upload prompts, responses, or source code through the dashboard.
- LiteLLM price refresh is optional (`AKAASHI_PULSE_OFFLINE=1`).
- Binds to loopback by default (`127.0.0.1:3737`).

## Development

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

After parser or aggregation changes, restart the service:

```bash
node bin/cli.mjs service restart
```

## License

MIT — see [LICENSE](LICENSE). Copyright © Jordão Qualho.
