import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getPulseStateDir } from '@/lib/runtime-paths.mjs';
import type { AgentLimitSnapshot } from '@/lib/types';

function percent(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : null;
}

function reset(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  return value;
}

export async function readClaudeRateLimitsSnapshot(): Promise<AgentLimitSnapshot | undefined> {
  try {
    const file = path.join(getPulseStateDir(), 'claude-rate-limits.json');
    const raw = JSON.parse(await fs.readFile(file, 'utf8')) as Record<string, unknown>;
    const windows: AgentLimitSnapshot['windows'] = [];
    for (const [key, id, minutes] of [
      ['fiveHour', 'five_hour', 300],
      ['sevenDay', 'seven_day', 10080],
    ] as const) {
      const value = raw[key];
      if (!value || typeof value !== 'object') continue;
      const item = value as Record<string, unknown>;
      const usedPercent = percent(item.usedPercent);
      if (usedPercent === null) continue;
      windows.push({ id, usedPercent, windowMinutes: minutes, resetsAt: reset(item.resetsAt) });
    }
    if (windows.length === 0) return undefined;
    const observedAt = typeof raw.observedAt === 'string' && !Number.isNaN(Date.parse(raw.observedAt))
      ? raw.observedAt
      : new Date().toISOString();
    return { source: 'claude', observedAt, windows, planType: null };
  } catch {
    return undefined;
  }
}
