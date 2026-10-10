#!/usr/bin/env node
/**
 * Generate a synthetic, deterministic home directory with Claude Code and
 * Codex CLI session logs. Used by `pnpm demo` and for README screenshots so
 * nobody has to expose real prompts, paths, or client names.
 *
 *   node scripts/demo-data.mjs [targetDir] [--days 45] [--seed 7]
 *
 * The target directory is wiped and recreated. It mirrors a real home:
 *   <target>/.claude/projects/<slug>/<session>.jsonl
 *   <target>/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl
 *   <target>/Workspaces/<project>/            (so project scoping applies)
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? Number(args[index + 1]) : fallback;
};
const target = resolve(args.find((arg, i) => !arg.startsWith('--') && !args[i - 1]?.startsWith('--')) ?? join(root, '.demo-home'));
const DAYS = flag('days', 45);
let seed = flag('seed', 7);

// Mulberry32 — tiny deterministic PRNG so screenshots are reproducible.
function random() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (min, max) => min + random() * (max - min);
const int = (min, max) => Math.floor(between(min, max + 1));
const pick = (list) => list[Math.floor(random() * list.length)];
const weighted = (entries) => {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return entries[entries.length - 1][0];
};
const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
  const r = Math.floor(random() * 16);
  return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
});

const PROJECTS = [
  { name: 'acme-storefront', weight: 5 },
  { name: 'billing-api', weight: 4 },
  { name: 'design-system', weight: 3 },
  { name: 'mobile-app', weight: 2 },
  { name: 'infra-terraform', weight: 1.2 },
  { name: 'docs-site', weight: 1 },
];

const PROMPTS = {
  'acme-storefront': ['Add cursor pagination to the product grid', 'Fix the flaky checkout e2e test on Safari', 'Migrate the cart drawer to server actions', 'Improve LCP on the product detail page', 'Add a wishlist button with optimistic updates'],
  'billing-api': ['Add idempotency keys to the invoice endpoint', 'Write tests for proration when a plan changes mid-cycle', 'Investigate duplicate webhook deliveries from the payment provider', 'Refactor the tax calculation module', 'Add a retry queue for failed charge events'],
  'design-system': ['Build an accessible Combobox with keyboard navigation', 'Add dark-mode tokens to the color scale', 'Write Storybook docs for the DatePicker', 'Fix focus ring contrast on the Button component'],
  'mobile-app': ['Add offline support to the orders screen', 'Fix the push notification permission flow on Android', 'Reduce bundle size of the onboarding flow'],
  'infra-terraform': ['Add a staging environment for the billing API', 'Rotate the database credentials with zero downtime', 'Set up alerts for p95 latency regressions'],
  'docs-site': ['Write a quick start guide for the public API', 'Fix broken links in the changelog', 'Add search to the docs navigation'],
};

const CLAUDE_MODELS = [['claude-sonnet-4-6', 6], ['claude-opus-4-8', 2.2], ['claude-haiku-4-5', 1.5]];
const CODEX_MODELS = [['gpt-5.6-terra', 2], ['gpt-5.6-luna', 3]];
const TOOLS = [['Read', 6], ['Edit', 5], ['Bash', 4], ['Grep', 3], ['Write', 1.5], ['Glob', 1.5], ['WebFetch', 0.4], ['TodoWrite', 0.8]];

const now = new Date();
now.setMinutes(0, 0, 0);

function sessionStart(dayOffset) {
  const day = new Date(now);
  day.setDate(day.getDate() - dayOffset);
  if (dayOffset === 0) {
    // Today: keep every session safely in the past so "today" KPIs have data.
    day.setHours(Math.max(0, now.getHours() - int(2, 6)), int(0, 59), 0, 0);
    return day;
  }
  // Busy afternoons, lighter mornings, occasional late evenings.
  const hour = weighted([[9, 2], [10, 4], [11, 4], [13, 3], [14, 6], [15, 7], [16, 6], [17, 4], [19, 1.2], [21, 1], [22, 0.6]]);
  day.setHours(hour, int(0, 59), int(0, 59), 0);
  return day;
}

function writeClaudeSession(start, project) {
  const sessionId = uuid();
  const cwd = join(target, 'Workspaces', project.name);
  const model = weighted(CLAUDE_MODELS);
  const heavy = model === 'claude-opus-4-8';
  const turns = heavy ? int(2, 7) : int(1, 5);
  const lines = [];
  let clock = start.getTime();
  let parent = null;
  let context = int(14_000, 26_000);

  for (let turn = 0; turn < turns; turn += 1) {
    const prompt = turn === 0 ? pick(PROMPTS[project.name]) : pick(['Looks good, now add tests', 'Can you handle the empty state too?', 'Run the linter and fix what it finds', 'Explain why that failed', 'Ship it — update the changelog']);
    const userUuid = uuid();
    lines.push({ type: 'user', uuid: userUuid, parentUuid: parent, timestamp: new Date(clock).toISOString(), sessionId, cwd, version: '2.1.0', message: { role: 'user', content: prompt } });
    parent = userUuid;
    const calls = heavy ? int(8, 32) : int(3, 18);
    for (let call = 0; call < calls; call += 1) {
      clock += int(4, 55) * 1000;
      const output = int(120, heavy ? 2400 : 1400);
      const created = call === 0 ? int(2_000, 9_000) : int(150, 1_800);
      context += created + int(200, 1200);
      const toolName = call < calls - 1 ? weighted(TOOLS) : null;
      const toolId = `toolu_${uuid().slice(0, 12)}`;
      const assistantUuid = uuid();
      lines.push({
        type: 'assistant',
        uuid: assistantUuid,
        parentUuid: parent,
        timestamp: new Date(clock).toISOString(),
        sessionId,
        requestId: `req_${uuid().slice(0, 16)}`,
        cwd,
        version: '2.1.0',
        message: {
          id: `msg_${uuid().replace(/-/g, '').slice(0, 20)}`,
          role: 'assistant',
          model,
          content: toolName
            ? [{ type: 'text', text: 'Working on it.' }, { type: 'tool_use', id: toolId, name: toolName, input: {} }]
            : [{ type: 'text', text: 'Done — summary of the changes above.' }],
          usage: {
            input_tokens: int(3, 40),
            output_tokens: output,
            cache_creation_input_tokens: created,
            cache_read_input_tokens: context,
            cache_creation: { ephemeral_5m_input_tokens: created, ephemeral_1h_input_tokens: 0 },
          },
        },
      });
      parent = assistantUuid;
      if (toolName) {
        const resultUuid = uuid();
        clock += int(1, 8) * 1000;
        lines.push({ type: 'user', uuid: resultUuid, parentUuid: parent, timestamp: new Date(clock).toISOString(), sessionId, cwd, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolId, content: 'ok' }] } });
        parent = resultUuid;
      }
    }
    // Think time between turns; now and then a long break (meeting, lunch).
    clock += (random() < 0.12 ? int(35, 120) : int(1, 9)) * 60_000;
  }

  const slug = cwd.replace(/[^a-zA-Z0-9]/g, '-');
  const dir = join(target, '.claude', 'projects', slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${sessionId}.jsonl`), lines.map((line) => JSON.stringify(line)).join('\n') + '\n');
}

function writeCodexSession(start, project) {
  const id = uuid();
  const cwd = join(target, 'Workspaces', project.name);
  const model = weighted(CODEX_MODELS);
  const lines = [];
  let clock = start.getTime();
  const at = () => new Date(clock).toISOString();
  const total = { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0, total_tokens: 0 };

  lines.push({ timestamp: at(), type: 'session_meta', payload: { id, timestamp: at(), cwd, originator: 'codex_cli_rs', cli_version: '0.147.0', source: 'cli', model_provider: 'openai' } });
  const turns = int(1, 4);
  for (let turn = 0; turn < turns; turn += 1) {
    clock += 1000;
    lines.push({ timestamp: at(), type: 'event_msg', payload: { type: 'user_message', message: turn === 0 ? pick(PROMPTS[project.name]) : 'Now cover the edge cases', images: [] } });
    lines.push({ timestamp: at(), type: 'turn_context', payload: { turn_id: `turn-${turn + 1}`, cwd, model, effort: 'medium' } });
    const calls = int(3, 14);
    for (let call = 0; call < calls; call += 1) {
      clock += int(5, 50) * 1000;
      const last = { input_tokens: int(6_000, 40_000), cached_input_tokens: 0, output_tokens: int(80, 1600), reasoning_output_tokens: int(0, 600), total_tokens: 0 };
      last.cached_input_tokens = Math.floor(last.input_tokens * between(0.55, 0.9));
      last.total_tokens = last.input_tokens + last.output_tokens;
      for (const key of Object.keys(total)) total[key] += last[key];
      lines.push({ timestamp: at(), type: 'response_item', payload: { type: 'function_call', name: pick(['shell_command', 'apply_patch', 'read_file']), arguments: '{}', call_id: `call-${turn}-${call}` } });
      lines.push({ timestamp: at(), type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: { ...total }, last_token_usage: last, model_context_window: 258_400 }, rate_limits: { primary: { used_percent: int(8, 46), window_minutes: 300, resets_at: Math.floor(clock / 1000) + 3 * 3600 }, secondary: { used_percent: int(20, 61), window_minutes: 10080, resets_at: Math.floor(clock / 1000) + 4 * 86400 }, plan_type: 'plus' } } });
    }
    lines.push({ timestamp: at(), type: 'event_msg', payload: { type: 'agent_message', message: 'Finished — tests pass.', phase: 'final' } });
    clock += int(2, 12) * 60_000;
  }

  const date = new Date(start);
  const dir = join(target, '.codex', 'sessions', String(date.getFullYear()), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0'));
  mkdirSync(dir, { recursive: true });
  const stamp = date.toISOString().slice(0, 19).replace(/:/g, '-');
  writeFileSync(join(dir, `rollout-${stamp}-${id}.jsonl`), lines.map((line) => JSON.stringify(line)).join('\n') + '\n');
}

if (!target.includes('demo')) {
  console.error(`Refusing to wipe "${target}": the target path must contain "demo".`);
  process.exit(1);
}
rmSync(target, { recursive: true, force: true });
for (const project of PROJECTS) mkdirSync(join(target, 'Workspaces', project.name), { recursive: true });

let claude = 0;
let codex = 0;
for (let offset = DAYS; offset >= 0; offset -= 1) {
  const day = new Date(now);
  day.setDate(day.getDate() - offset);
  const weekend = day.getDay() === 0 || day.getDay() === 6;
  // Usage ramps up over the period so trend comparisons have a story.
  const ramp = 0.6 + (1 - offset / DAYS) * 0.9;
  const sessions = offset === 0
    ? 3
    : weekend ? (random() < 0.35 ? int(1, 2) : 0) : Math.round(between(2, 6) * ramp);
  for (let i = 0; i < sessions; i += 1) {
    const project = weighted(PROJECTS.map((p) => [p, p.weight]));
    const start = sessionStart(offset);
    if (start > new Date()) continue;
    if (random() < 0.22) {
      writeCodexSession(start, project);
      codex += 1;
    } else {
      writeClaudeSession(start, project);
      claude += 1;
    }
  }
}

console.log(`[demo-data] wrote ${claude} Claude Code and ${codex} Codex sessions across ${DAYS} days → ${target}`);
