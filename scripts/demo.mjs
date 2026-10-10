#!/usr/bin/env node
/**
 * `pnpm demo` — run the dashboard against synthetic data only.
 *
 * Generates a throwaway home directory (scripts/demo-data.mjs) and starts
 * `next dev` with HOME pointing at it, so provider discovery never sees your
 * real ~/.claude, ~/.codex, Cursor, or Antigravity logs. Pricing stays offline.
 */
import { spawn, spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');
const home = join(root, '.demo-home');
const port = process.env.PORT ?? '3739';

const generated = spawnSync(process.execPath, [join(root, 'scripts', 'demo-data.mjs'), home], { stdio: 'inherit' });
if (generated.status !== 0) process.exit(generated.status ?? 1);

const env = { ...process.env };
// Never let a real data root leak into the demo through env overrides.
for (const key of Object.keys(env)) {
  if (key.startsWith('AKAASHI_PULSE_') || ['CLAUDE_CONFIG_DIR', 'CODEX_HOME', 'CURSOR_AGENT_HOME'].includes(key)) delete env[key];
}
Object.assign(env, {
  HOME: home,
  USERPROFILE: home,
  AKAASHI_PULSE_STATE_DIR: join(home, '.akaashi-pulse'),
  AKAASHI_PULSE_OFFLINE: '1',
  AKAASHI_PULSE_DEMO: '1',
  NEXT_TELEMETRY_DISABLED: '1',
});

console.log(`[demo] dashboard with synthetic data → http://127.0.0.1:${port}`);
const child = spawn(process.execPath, [join(root, 'node_modules', 'next', 'dist', 'bin', 'next'), 'dev', '-p', port, '-H', '127.0.0.1'], { cwd: root, env, stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 0));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
