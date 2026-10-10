#!/usr/bin/env node
import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPulseStateDir } from '../lib/runtime-paths.mjs';

function finitePercent(value) {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : null;
}

function isoReset(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value < 1_000_000_000_000 ? value * 1000 : value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toISOString();
  }
  return null;
}

function readWindow(input, keys) {
  if (!input || typeof input !== 'object') return null;
  const source = input;
  for (const key of keys) {
    const candidate = source[key];
    if (!candidate || typeof candidate !== 'object') continue;
    const usedPercent = finitePercent(candidate.used_percentage ?? candidate.used_percent ?? candidate.usedPercent);
    if (usedPercent === null) continue;
    return { usedPercent, resetsAt: isoReset(candidate.resets_at ?? candidate.resetsAt ?? candidate.reset_at) };
  }
  return null;
}

export function parseRateLimitsDocument(document) {
  const rateLimits = document && typeof document === 'object' ? document.rate_limits : null;
  if (!rateLimits || typeof rateLimits !== 'object') return null;
  const fiveHour = readWindow(rateLimits, ['five_hour', 'fiveHour', 'primary']);
  const sevenDay = readWindow(rateLimits, ['seven_day', 'sevenDay', 'secondary']);
  if (!fiveHour && !sevenDay) return null;
  return {
    version: 1,
    observedAt: new Date().toISOString(),
    fiveHour,
    sevenDay,
  };
}

function display(value) {
  return value ? `${value.usedPercent.toFixed(0)}%` : '—';
}

export function formatStatusLine(snapshot) {
  return `5h ${display(snapshot?.fiveHour)} · 7d ${display(snapshot?.sevenDay)}`;
}

export async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

export async function runStatusline(inputText, stateDir = getPulseStateDir()) {
  let document;
  try {
    document = JSON.parse(inputText);
  } catch {
    return formatStatusLine(null);
  }
  const snapshot = parseRateLimitsDocument(document);
  if (snapshot) {
    await mkdir(stateDir, { recursive: true });
    const target = path.join(stateDir, 'claude-rate-limits.json');
    const temporary = `${target}.tmp-${process.pid}-${Date.now()}`;
    await writeFile(temporary, `${JSON.stringify(snapshot)}\n`, { mode: 0o600 });
    await rename(temporary, target);
  }
  return formatStatusLine(snapshot);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const input = await readStdin();
  process.stdout.write(`${await runStatusline(input)}\n`);
}
