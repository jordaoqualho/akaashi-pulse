import os from 'node:os';
import path from 'node:path';

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

/** Local-only runtime state: service metadata, index cache, pricing overlay, logs. */
export function getPulseStateDir() {
  return process.env.AKAASHI_PULSE_STATE_DIR ?? path.join(os.homedir(), '.akaashi-pulse');
}

export function isPulseOffline() {
  return (
    process.env.AKAASHI_PULSE_OFFLINE === '1' || process.env.AKAASHI_PULSE_PRICING_OFFLINE === '1'
  );
}

export function pulsePricingTtlMs() {
  const raw = process.env.AKAASHI_PULSE_PRICING_TTL_MS;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_TTL_MS;
}
