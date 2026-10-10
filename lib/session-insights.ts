import { costOfRecord } from '@/lib/pricing/calculate';
import type { AssistantRecord, ProviderId, SessionSummary } from '@/lib/types';

/**
 * Pauses longer than this between two model responses count as idle time.
 * Wall-clock session spans include nights and lunch breaks when a terminal is
 * left open, so "active time" only sums the gaps shorter than this threshold.
 */
export const IDLE_GAP_MS = 15 * 60_000;

const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;

export interface SessionInsightPoint {
  key: string;
  label: string;
  sessions: number;
  requests: number;
  cost: number;
  activeMs: number;
}

export interface SessionInsightRank {
  name: string;
  href?: string;
  sessions: number;
  requests: number;
  tokens: number;
  cost: number;
  share: number;
  costPerRequest: number;
  activeMs: number;
}

export interface SessionInsightSession {
  id: string;
  source: ProviderId;
  title: string;
  project: string;
  startedAt: string;
  activeMs: number;
  requests: number;
  tokens: number;
  cost: number;
  href: string;
}

export interface InsightTotals {
  sessions: number;
  activeDays: number;
  requests: number;
  tokens: number;
  cost: number;
  saved: number;
  activeMs: number;
  averageActiveMs: number;
  averageCost: number;
  costPerActiveHour: number;
  /** Share of prompt-side tokens served from cache (0–1). */
  cacheShare: number;
}

export type InsightFinding =
  | { kind: 'spendChange'; change: number; current: number; previous: number; days: number }
  | { kind: 'projectConcentration'; project: string; share: number; cost: number; href?: string }
  | { kind: 'modelPremium'; expensive: string; cheap: string; ratio: number; costShare: number; requestShare: number }
  | { kind: 'cacheSavings'; saved: number; cacheShare: number }
  | { kind: 'outlierSession'; session: SessionInsightSession; share: number }
  | { kind: 'focusWindow'; weekday: string; from: number; to: number; share: number }
  | { kind: 'longSessions'; costShare: number; sessionShare: number }
  | { kind: 'idleTime'; idleShare: number };

export interface SessionInsights {
  totals: InsightTotals;
  /** Same metrics for the equal-length window right before this one. */
  previous?: InsightTotals;
  findings: InsightFinding[];
  daily: SessionInsightPoint[];
  /** 7 rows (Mon → Sun) × 24 hourly request counts. */
  heatmap: { weekdays: string[]; cells: number[][]; max: number };
  durationBuckets: Array<{ key: string; label: string; sessions: number; share: number; cost: number }>;
  projects: SessionInsightRank[];
  models: SessionInsightRank[];
  longest: SessionInsightSession[];
  costliest: SessionInsightSession[];
  peakDay?: SessionInsightPoint;
}

export interface BuildInsightsInput {
  sessions: SessionSummary[];
  /** Previous equal-length window, when the range has a fixed start. */
  previousSessions?: SessionSummary[];
  /** Source-filtered assistant records; only those inside a session window are used. */
  records: AssistantRecord[];
  from?: Date;
  to?: Date;
  locale?: string;
}

function sessionKey(source: ProviderId, sessionId: string): string {
  return `${source}:${sessionId}`;
}

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function sessionHref(session: SessionSummary): string {
  return `/sessions/${encodeURIComponent(session.sessionId)}?source=${session.source}`;
}

function projectHref(session: SessionSummary): string | undefined {
  return session.cwd ? `/projects/${encodeURIComponent(session.cwd)}?source=${session.source}` : undefined;
}

function projectName(session: SessionSummary): string {
  return session.projectLabel || session.projectName || '(unknown)';
}

/** Sum of response gaps that are short enough to be considered focused work. */
function activeTime(timestamps: number[]): number {
  let total = 0;
  for (let i = 1; i < timestamps.length; i += 1) {
    const gap = timestamps[i] - timestamps[i - 1];
    if (gap > 0 && gap <= IDLE_GAP_MS) total += gap;
  }
  return total;
}

function share(part: number, whole: number): number {
  return whole > 0 ? part / whole : 0;
}

/**
 * Index the records that belong to the requested sessions in a single pass.
 * Records outside the session window (start → end) are ignored so a range
 * filter applied by `aggregateBySession` stays authoritative.
 */
function indexRecords(records: AssistantRecord[], sessions: SessionSummary[]) {
  const windows = new Map<string, { start: string; end: string }>();
  for (const session of sessions) {
    windows.set(sessionKey(session.source, session.sessionId), { start: session.startTime, end: session.endTime });
  }
  const bySession = new Map<string, AssistantRecord[]>();
  for (const rec of records) {
    const key = sessionKey(rec.source, rec.sessionId || rec.uuid);
    const window = windows.get(key);
    if (!window || rec.timestamp < window.start || rec.timestamp > window.end) continue;
    const list = bySession.get(key);
    if (list) list.push(rec);
    else bySession.set(key, [rec]);
  }
  return bySession;
}

function activeBySession(bySession: Map<string, AssistantRecord[]>): Map<string, number> {
  const out = new Map<string, number>();
  for (const [key, recs] of bySession) {
    const stamps = recs.map((rec) => new Date(rec.timestamp).getTime()).filter(Number.isFinite).sort((a, b) => a - b);
    out.set(key, activeTime(stamps));
  }
  return out;
}

/** Total active time across sessions (see IDLE_GAP_MS). */
export function totalActiveTime(sessions: SessionSummary[], records: AssistantRecord[]): number {
  let total = 0;
  for (const ms of activeBySession(indexRecords(records, sessions)).values()) total += ms;
  return total;
}

function computeTotals(sessions: SessionSummary[], active: Map<string, number>): InsightTotals {
  let requests = 0;
  let tokens = 0;
  let cost = 0;
  let saved = 0;
  let activeMs = 0;
  let cacheRead = 0;
  let promptSide = 0;
  const days = new Set<string>();
  for (const session of sessions) {
    requests += session.requests;
    tokens += session.totalTokens;
    cost += session.cost;
    saved += session.saved;
    activeMs += active.get(sessionKey(session.source, session.sessionId)) ?? 0;
    cacheRead += session.cacheReadTokens;
    promptSide += session.inputTokens + session.cacheReadTokens + session.cacheCreationTokens;
    const start = new Date(session.startTime);
    if (!Number.isNaN(start.getTime())) days.add(dateKey(start));
  }
  return {
    sessions: sessions.length,
    activeDays: days.size,
    requests,
    tokens,
    cost,
    saved,
    activeMs,
    averageActiveMs: sessions.length ? activeMs / sessions.length : 0,
    averageCost: sessions.length ? cost / sessions.length : 0,
    costPerActiveHour: activeMs >= 60_000 ? cost / (activeMs / HOUR_MS) : 0,
    cacheShare: share(cacheRead, promptSide),
  };
}

function toInsightSession(session: SessionSummary, activeMs: number): SessionInsightSession {
  return {
    id: session.sessionId,
    source: session.source,
    title: session.title || `Untitled session · ${session.sessionId.slice(0, 8)}`,
    project: projectName(session),
    startedAt: session.startTime,
    activeMs,
    requests: session.requests,
    tokens: session.totalTokens,
    cost: session.cost,
    href: sessionHref(session),
  };
}

/** Densest 3-hour window across the week, used for the "focus window" finding. */
function focusWindow(cells: number[][], total: number, weekdays: string[]) {
  let best = { day: 0, hour: 0, value: 0 };
  for (let day = 0; day < 7; day += 1) {
    for (let hour = 0; hour <= 21; hour += 1) {
      const value = cells[day][hour] + cells[day][hour + 1] + cells[day][hour + 2];
      if (value > best.value) best = { day, hour, value };
    }
  }
  if (!best.value) return undefined;
  return { weekday: weekdays[best.day], from: best.hour, to: best.hour + 3, share: share(best.value, total) };
}

function buildFindings(input: {
  totals: InsightTotals;
  previous?: InsightTotals;
  rangeDays?: number;
  projects: SessionInsightRank[];
  models: SessionInsightRank[];
  costliest: SessionInsightSession[];
  durationBuckets: SessionInsights['durationBuckets'];
  heatmap: SessionInsights['heatmap'];
  wallClockMs: number;
}): InsightFinding[] {
  const { totals, previous } = input;
  const findings: Array<{ score: number; finding: InsightFinding }> = [];

  if (previous && previous.cost > 0 && input.rangeDays) {
    const change = (totals.cost - previous.cost) / previous.cost;
    if (Math.abs(change) >= 0.1) {
      findings.push({
        score: 60 + Math.min(40, Math.abs(change) * 40),
        finding: { kind: 'spendChange', change, current: totals.cost, previous: previous.cost, days: input.rangeDays },
      });
    }
  }

  const topProject = input.projects[0];
  if (topProject && input.projects.length > 1 && topProject.share >= 0.35) {
    findings.push({
      score: 50 + topProject.share * 40,
      finding: { kind: 'projectConcentration', project: topProject.name, share: topProject.share, cost: topProject.cost, href: topProject.href },
    });
  }

  const meaningfulModels = input.models.filter((model) => model.cost > 0 && model.requests >= Math.max(10, totals.requests * 0.05));
  if (meaningfulModels.length >= 2) {
    const byUnitCost = [...meaningfulModels].sort((a, b) => b.costPerRequest - a.costPerRequest);
    const expensive = byUnitCost[0];
    const cheap = byUnitCost[byUnitCost.length - 1];
    const ratio = expensive.costPerRequest / cheap.costPerRequest;
    if (ratio >= 2) {
      findings.push({
        score: 45 + Math.min(30, ratio * 3),
        finding: {
          kind: 'modelPremium',
          expensive: expensive.name,
          cheap: cheap.name,
          ratio,
          costShare: expensive.share,
          requestShare: share(expensive.requests, totals.requests),
        },
      });
    }
  }

  if (totals.saved > 0 && totals.cacheShare >= 0.2) {
    findings.push({ score: 40 + totals.cacheShare * 20, finding: { kind: 'cacheSavings', saved: totals.saved, cacheShare: totals.cacheShare } });
  }

  const outlier = input.costliest[0];
  const outlierShare = outlier ? share(outlier.cost, totals.cost) : 0;
  if (outlier && totals.sessions >= 5 && outlierShare >= 0.15) {
    findings.push({ score: 45 + outlierShare * 40, finding: { kind: 'outlierSession', session: outlier, share: outlierShare } });
  }

  const longBucket = input.durationBuckets.find((bucket) => bucket.key === 'over-1h');
  if (longBucket && longBucket.sessions > 0 && totals.cost > 0) {
    const costShare = share(longBucket.cost, totals.cost);
    if (costShare >= 0.4 && longBucket.share <= 0.5) {
      findings.push({ score: 40 + (costShare - longBucket.share) * 40, finding: { kind: 'longSessions', costShare, sessionShare: longBucket.share } });
    }
  }

  const idleShare = input.wallClockMs > 0 ? 1 - share(totals.activeMs, input.wallClockMs) : 0;
  if (idleShare >= 0.5 && totals.sessions >= 3) {
    findings.push({ score: 30 + idleShare * 10, finding: { kind: 'idleTime', idleShare } });
  }

  const totalRequests = input.heatmap.cells.flat().reduce((sum, value) => sum + value, 0);
  const focus = focusWindow(input.heatmap.cells, totalRequests, input.heatmap.weekdays);
  if (focus && focus.share >= 0.08) {
    findings.push({ score: 25 + focus.share * 50, finding: { kind: 'focusWindow', ...focus } });
  }

  return findings.sort((a, b) => b.score - a.score).slice(0, 6).map((entry) => entry.finding);
}

export function buildSessionInsights({
  sessions,
  previousSessions,
  records,
  from,
  to,
  locale = 'en',
}: BuildInsightsInput): SessionInsights {
  const bySession = indexRecords(records, previousSessions ? [...sessions, ...previousSessions] : sessions);
  const active = activeBySession(bySession);
  const totals = computeTotals(sessions, active);
  const previous = previousSessions ? computeTotals(previousSessions, active) : undefined;
  const activeOf = (session: SessionSummary) => active.get(sessionKey(session.source, session.sessionId)) ?? 0;

  // Weekday labels Monday → Sunday (2024-01-01 was a Monday).
  const weekdayFormat = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  const weekdays = Array.from({ length: 7 }, (_, index) => weekdayFormat.format(new Date(2024, 0, 1 + index)));
  const cells = Array.from({ length: 7 }, () => Array<number>(24).fill(0));

  // Daily series is built from request timestamps so multi-day sessions are
  // spread across the days they actually ran, and empty days stay visible.
  const dailyMap = new Map<string, SessionInsightPoint>();
  const dayFormat = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' });
  const ensureDay = (date: Date) => {
    const key = dateKey(date);
    let point = dailyMap.get(key);
    if (!point) {
      point = { key, label: dayFormat.format(date), sessions: 0, requests: 0, cost: 0, activeMs: 0 };
      dailyMap.set(key, point);
    }
    return point;
  };

  let earliest = Infinity;
  for (const session of sessions) {
    const key = sessionKey(session.source, session.sessionId);
    const recs = bySession.get(key) ?? [];
    const start = new Date(session.startTime);
    if (!Number.isNaN(start.getTime())) {
      ensureDay(start).sessions += 1;
      earliest = Math.min(earliest, start.getTime());
    }
    const stamps: number[] = [];
    for (const rec of recs) {
      const date = new Date(rec.timestamp);
      const time = date.getTime();
      if (Number.isNaN(time)) continue;
      stamps.push(time);
      const point = ensureDay(date);
      point.requests += 1;
      point.cost += costOfRecord(rec).total;
      cells[(date.getDay() + 6) % 7][date.getHours()] += 1;
    }
    stamps.sort((a, b) => a - b);
    for (let i = 1; i < stamps.length; i += 1) {
      const gap = stamps[i] - stamps[i - 1];
      if (gap > 0 && gap <= IDLE_GAP_MS) ensureDay(new Date(stamps[i])).activeMs += gap;
    }
  }

  if (Number.isFinite(earliest) || from) {
    const first = startOfDay(from ?? new Date(earliest));
    const last = startOfDay(to ?? new Date());
    // Guard against absurd spans (e.g. a corrupt timestamp far in the past).
    const span = Math.min(730, Math.round((last.getTime() - first.getTime()) / DAY_MS));
    for (let offset = 0; offset <= span; offset += 1) {
      ensureDay(new Date(first.getFullYear(), first.getMonth(), first.getDate() + offset));
    }
  }
  const daily = Array.from(dailyMap.values()).sort((a, b) => a.key.localeCompare(b.key));

  const projectMap = new Map<string, SessionInsightRank>();
  const modelMap = new Map<string, SessionInsightRank>();
  const emptyRank = (name: string, href?: string): SessionInsightRank => ({
    name, href, sessions: 0, requests: 0, tokens: 0, cost: 0, share: 0, costPerRequest: 0, activeMs: 0,
  });
  for (const session of sessions) {
    const name = projectName(session);
    const project = projectMap.get(name) ?? emptyRank(name, projectHref(session));
    project.sessions += 1;
    project.requests += session.requests;
    project.tokens += session.totalTokens;
    project.cost += session.cost;
    project.activeMs += activeOf(session);
    projectMap.set(name, project);

    for (const [model, breakdown] of Object.entries(session.modelBreakdown)) {
      const rank = modelMap.get(model) ?? emptyRank(model);
      rank.sessions += 1;
      rank.requests += breakdown.requests;
      rank.tokens += breakdown.tokens;
      rank.cost += breakdown.cost;
      rank.activeMs += activeOf(session) * share(breakdown.requests, session.requests);
      modelMap.set(model, rank);
    }
  }
  const finishRanks = (map: Map<string, SessionInsightRank>) => Array.from(map.values())
    .map((rank) => ({ ...rank, share: share(rank.cost, totals.cost), costPerRequest: rank.requests ? rank.cost / rank.requests : 0 }))
    .sort((a, b) => b.cost - a.cost || b.requests - a.requests);
  const projects = finishRanks(projectMap);
  const models = finishRanks(modelMap);

  const buckets = [
    { key: 'under-5m', label: '< 5m', max: 5 * 60_000 },
    { key: '5-15m', label: '5–15m', max: 15 * 60_000 },
    { key: '15-30m', label: '15–30m', max: 30 * 60_000 },
    { key: '30-60m', label: '30–60m', max: HOUR_MS },
    { key: 'over-1h', label: '1h+', max: Infinity },
  ];
  const durationBuckets = buckets.map((bucket, index) => {
    const min = index === 0 ? 0 : buckets[index - 1].max;
    const matching = sessions.filter((session) => {
      const ms = activeOf(session);
      return ms >= min && ms < bucket.max;
    });
    return {
      key: bucket.key,
      label: bucket.label,
      sessions: matching.length,
      share: share(matching.length, sessions.length),
      cost: matching.reduce((sum, session) => sum + session.cost, 0),
    };
  });

  const longest = [...sessions].sort((a, b) => activeOf(b) - activeOf(a)).slice(0, 5).map((s) => toInsightSession(s, activeOf(s)));
  const costliest = [...sessions].sort((a, b) => b.cost - a.cost).slice(0, 5).map((s) => toInsightSession(s, activeOf(s)));
  const peakDay = daily.reduce<SessionInsightPoint | undefined>((best, point) => !best || point.cost > best.cost ? point : best, undefined);
  const heatmap = { weekdays, cells, max: Math.max(0, ...cells.flat()) };
  const wallClockMs = sessions.reduce((sum, session) => sum + session.durationMs, 0);
  const rangeDays = from ? Math.max(1, Math.round(((to ?? new Date()).getTime() - from.getTime()) / DAY_MS)) : undefined;

  return {
    totals,
    previous,
    findings: buildFindings({ totals, previous, rangeDays, projects, models, costliest, durationBuckets, heatmap, wallClockMs }),
    daily,
    heatmap,
    durationBuckets,
    projects: projects.slice(0, 6),
    models: models.slice(0, 6),
    longest,
    costliest,
    peakDay: peakDay && peakDay.cost > 0 ? peakDay : undefined,
  };
}
