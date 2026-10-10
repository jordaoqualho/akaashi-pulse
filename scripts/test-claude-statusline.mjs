#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const { runStatusline, formatStatusLine } = await import(path.join(root, 'scripts/claude-statusline.mjs'));
const fixture = async (name) => JSON.parse(await readFile(path.join(root, 'scripts/fixtures', name), 'utf8'));
const state = await mkdtemp(path.join(tmpdir(), 'akaashi-pulse-statusline-'));
try {
  const present = await runStatusline(JSON.stringify(await fixture('claude-rate-limits-present.json')), state);
  assert.equal(present, '5h 31% · 7d 48%');
  const saved = JSON.parse(await readFile(path.join(state, 'claude-rate-limits.json'), 'utf8'));
  assert.equal(saved.version, 1);
  assert.equal(saved.fiveHour.usedPercent, 31);
  assert.match(saved.fiveHour.resetsAt, /^20/);

  const partial = await runStatusline(JSON.stringify(await fixture('claude-rate-limits-partial.json')), state);
  assert.equal(partial, '5h 31% · 7d —');
  const absent = await runStatusline(JSON.stringify(await fixture('claude-rate-limits-absent.json')), state);
  assert.equal(absent, '5h — · 7d —');
  assert.equal(formatStatusLine(null), '5h — · 7d —');
  console.log('claude statusline fixtures OK');
} finally {
  await rm(state, { recursive: true, force: true });
}
