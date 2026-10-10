# AGENTS.md

Working agreement for coding agents editing **AKAASHI Pulse** — the official
local analytics product for Claude Code, OpenAI Codex CLI, Cursor, and
Antigravity (MIT, maintained for future public open source). Treat this file as the canonical technical contract;
`CLAUDE.md` adds Claude Code–specific session rules.

## Project

AKAASHI Pulse is **local-first**: it reads JSONL logs on disk, serves a private
dashboard on loopback, and never ships prompts or source code off the machine by
default. Three surfaces share one data layer:

| Surface | Entry |
| --- | --- |
| Dashboard | `app/` (Next.js App Router), default service `http://127.0.0.1:3737` |
| CLI / service | `bin/cli.mjs` (`akaashi-pulse` in `package.json#bin`) |
| MCP server | `lib/mcp/entry.ts` → `dist/mcp/server.mjs`; HTTP read-only at `/api/mcp` |

`package.json` is `private: true` today (not published to npm). There is no
marketing site in this repo — only the dashboard, CLI, MCP, and build scripts.

## Layout

```text
app/                    Dashboard pages and API routes (including HTTP MCP)
components/             React UI (AKAASHI design system in app/globals.css)
lib/providers/          Claude, Codex, Cursor, and Antigravity adapters
lib/data-loader/        JSONL scanning, indexing, caching, watchers
lib/aggregator/         Usage, cost, and activity aggregations
lib/pricing/            Built-in snapshot + optional LiteLLM overlay
lib/runtime-paths.mjs   State dir and offline flags (shared with CLI/tests)
lib/mcp/                Local stdio MCP server
lib/integration/        Optional aggregate-only AKAASHI OS sync
lib/cli-report/         Terminal report → dist/report
bin/cli.mjs             Service install, report TUI, mcp, doctor
scripts/                pnpm build/test/update-pricing (required — not optional)
dist/                   Generated MCP and report bundles (after build)
```

Runtime state: `~/.akaashi-pulse/` unless `AKAASHI_PULSE_STATE_DIR` is set
(see `lib/runtime-paths.mjs`). macOS persistent service uses LaunchAgent
`com.akaashi.pulse`. `node bin/cli.mjs service install` runs the prebuilt
standalone server for fast startup; `--dev` opts into Next.js HMR for source
editing and the slower first compile.

## Commands

```bash
pnpm dev              # manual dashboard on :3738 (builds into .next-dev)
pnpm demo             # dashboard on synthetic data on :3739 (HOME=.demo-home)
pnpm typecheck
pnpm lint
pnpm test             # parser, pricing, aggregation, guard scripts
pnpm build            # Next standalone + MCP + report + smoke test
pnpm build:mcp
pnpm build:report
pnpm update-pricing   # refresh committed LiteLLM snapshot

node bin/cli.mjs service install | status | restart | uninstall
node bin/cli.mjs report --json
node bin/cli.mjs mcp
node bin/cli.mjs doctor
```

Do **not** commit, tag, release, or open PRs unless the user explicitly asks in
the current turn.

`pnpm dev` and `pnpm demo` use their own `distDir` (`.next-dev`, `.next-demo`;
see `next.config.mjs`) so they never delete `.next/standalone`, which the
background service runs from. Use `pnpm demo` for screenshots and docs — never
publish images or fixtures that contain real prompts, paths, or project names.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `AKAASHI_PULSE_STATE_DIR` | Runtime data (cache, service state, logs) |
| `AKAASHI_PULSE_CONFIG_DIR` | Extra Claude config root (`CLAUDE_CONFIG_DIR` also honored) |
| `AKAASHI_PULSE_CODEX_DIR` | Codex home (`CODEX_HOME` also honored) |
| `AKAASHI_PULSE_CURSOR_DIR` | Cursor data root (`CURSOR_AGENT_HOME` also honored) |
| `AKAASHI_PULSE_ANTIGRAVITY_DIR` | Antigravity data root under `.gemini` |
| `AKAASHI_PULSE_PROJECT_ROOTS` | Comma-separated project roots used by analytics (`AKAASHI_PULSE_PROJECT_ROOT` also honored) |
| `AKAASHI_PULSE_OFFLINE` | `1` — no LiteLLM pricing fetch |
| `AKAASHI_PULSE_PRICING_OFFLINE` | Same as offline for pricing only |
| `AKAASHI_PULSE_PRICING_TTL_MS` | Overlay TTL |
| `AKAASHI_PULSE_DEBUG` | Verbose indexer logs |
| `AKAASHI_PULSE_MCP_PRETTY` | Pretty MCP JSON |
| `AKAASHI_PULSE_POLL_FALLBACK` | `1` / `0` — polling when watchers unavailable |

Use the `AKAASHI_PULSE_*` prefix for any new env knobs. Do not reintroduce
legacy third-party product names in code, docs, or user-visible strings.

## Architecture invariants

1. `lib/data-loader/indexer.ts` is a module-level singleton with watchers.
   Importing it starts indexing and may write cache. **Restart the service**
   after parser changes; HMR alone is insufficient. UI/CSS changes reload via
   the default dev service.

2. Turn grouping follows JSONL `parentUuid`. Synthetic user records are turn
   boundaries only; their text remains the direct prompt for the call.

3. Claude sidecar limits and Codex sub-agent rollouts link to the data layer;
   Cursor and Antigravity transcripts are activity-only. Parser or linking
   changes → bump provider `parserVersion` and
   `scripts/parser-versions.json`.

4. Assistant records are deduplicated after parse; the parent map for turn walks
   stays **pre-dedup**.

5. Codex `total_token_usage` is cumulative — forward deltas only; ignore
   duplicate refresh events.

6. Codex `token_count` may include `rate_limits`; Claude limits arrive through
   the supported `scripts/claude-statusline.mjs` sidecar or explicit quota
   events in its JSONL. Persist the latest local snapshot and show it on
   Limits. Do not infer quotas from tokens or cost. Cursor and Antigravity
   never claim quota telemetry.

7. Pricing: committed offline snapshot + optional LiteLLM overlay on disk. CLI
   and MCP stay offline; only the dashboard may refresh prices.
   `AKAASHI_PULSE_OFFLINE=1` disables fetch.

8. Dashboard is **English-only** and **light theme only**. Keep
   `components/no-flash-script.tsx`, CSS variables, and server defaults aligned.

9. CSV export: streamed, UTF-8 BOM, formula-injection escapes — no buffered
   string concat.

10. JSONL sources are read-only — never write Claude, Codex, Cursor, or
    Antigravity session files. The Claude status-line sidecar writes only its
    sanitized snapshot under the Pulse state directory.

11. AKAASHI OS integration is off by default; only normalized aggregate session
    metrics may leave the machine — never prompts, paths, tool bodies, env, or
    secrets.

## Conventions

- TypeScript/TSX in app and `lib/`; executable `bin/cli.mjs`.
- `@/` imports from repo root.
- User-facing English copy in `lib/i18n/dict.ts` (`DEFAULT_LOCALE` only).
- Reuse AKAASHI primitives in `app/globals.css`; red dot is the brand accent.
- Minimize diff scope; match existing style.
- `LICENSE` is MIT (Jordão Qualho) — retain notice when redistributing.

### UI quality gate

Do not add generic “card grids” or copy-pasted form panels. Every new surface
must have a product-specific composition and a clear job: identify the active
context, show the important value, and make the next action obvious. Before
shipping a UI change, check:

1. The component uses the existing AKAASHI tokens and one consistent radius
   scale; do not mix arbitrary shadows, colors, or control heights.
2. Repeated entities use a deliberate hierarchy (for example, a selected
   provider rail plus a detail inspector), not four identical cards with a
   different label.
3. A real loading, empty, disabled, and error state exists where the data can
   be unavailable. Do not use a spinner as the only feedback.
4. Inputs have labels above them, helper text when the choice affects meaning,
   and a visible source or explanation for prices, estimates, and derived data.
5. Review the full route after editing: desktop and mobile layout, focus state,
   text wrapping, contrast, and whether the new component looks like Pulse
   rather than a default Tailwind template.

## Parser / build preflight

After parsing, linking, or aggregation changes:

1. Implement and bump `parserVersion` when output can change.
2. `pnpm typecheck && pnpm lint && pnpm test`
3. `node bin/cli.mjs service restart`
4. Reconcile dashboard/CLI totals with raw JSONL sums.

After build or service changes: `pnpm build`, then
`node bin/cli.mjs service status` and `http://127.0.0.1:3737`.
