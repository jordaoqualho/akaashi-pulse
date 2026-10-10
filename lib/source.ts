import { cookies } from 'next/headers';
import {
  ALL_PROVIDER_IDS,
  coerceProviderId,
  DEFAULT_PROVIDER,
  detectAvailableProviders,
  isProviderId,
} from './providers';
import type { ProviderId } from './providers';
import { isTrackedProjectPath } from './project-scope';

export const SOURCE_COOKIE = 'akaashi_pulse_source';

export type EffectiveSource = ProviderId | 'all';

export function isEffectiveSource(v: unknown): v is EffectiveSource {
  return v === 'all' || isProviderId(v);
}

export function parseSourceParam(v: string | null | undefined): EffectiveSource {
  if (v === 'all') return 'all';
  return coerceProviderId(v);
}

export async function resolveSource(
  searchParam?: string | null,
  availableOverride?: ProviderId[],
): Promise<EffectiveSource> {
  const available = availableOverride ?? await detectAvailableProviders();
  const canBeAll = available.length >= 2;

  const fromUrl = searchParam ?? undefined;
  if (fromUrl === 'all' && canBeAll) return 'all';
  if (fromUrl && isProviderId(fromUrl)) return fromUrl;

  const c = await cookies();
  const cookieVal = c.get(SOURCE_COOKIE)?.value;
  if (cookieVal === 'all' && canBeAll) return 'all';
  const preferred = cookieVal && isProviderId(cookieVal) ? cookieVal : DEFAULT_PROVIDER;

  if (available.length > 0 && !available.includes(preferred)) return available[0];
  return preferred;
}

export function filterBySource<T extends { source: ProviderId; cwd: string }>(
  records: T[],
  source: EffectiveSource,
): T[] {
  return records.filter((r) => (source === 'all' || r.source === source) && isTrackedProjectPath(r.cwd, r.source));
}

export function expandSources(source: EffectiveSource): ProviderId[] {
  if (source === 'all') return ALL_PROVIDER_IDS.slice();
  return [source];
}
