import { aggregateByProject, aggregateBySession } from '@/lib/aggregator';
import { filterBySource, expandSources, type EffectiveSource } from '@/lib/source';
import { resolveProjectRootCwd } from '@/lib/project-label';
import type { AssistantRecord, ProviderId, UserRecord } from '@/lib/types';
import type { OperatingCostBasis, OperatingCostConfig, OperatingCostCurrency } from '@/lib/data-sources/config';

export interface OperatingCostProviderBreakdown {
  source: ProviderId;
  metric: number;
  share: number;
  estimatedCost: number;
  actualCost: number;
}

export interface OperatingCostProjectRow {
  cwd: string;
  projectName: string;
  estimatedCost: number;
  actualCost: number;
  metric: number;
  tokens: number;
  requests: number;
  durationMs: number;
  sessions: number;
  providers: OperatingCostProviderBreakdown[];
}

export interface OperatingCostReport {
  month: string;
  basis: OperatingCostBasis;
  currency: OperatingCostCurrency;
  rows: OperatingCostProjectRow[];
  estimatedTotal: number;
  actualTotal: number;
  configuredMonthlyCost: number;
  configuredSources: ProviderId[];
  hasConfiguredPlans: boolean;
}

function monthForTimestamp(timestamp: string): string | null {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function metricForBasis(
  basis: OperatingCostBasis,
  project: { cost: number; totalTokens: number; requests: number },
  durationMs: number,
): number {
  if (basis === 'tokens') return project.totalTokens;
  if (basis === 'requests') return project.requests;
  if (basis === 'tracked-time') return durationMs;
  return project.cost;
}

/**
 * Allocates fixed monthly subscription charges to projects using only the
 * local usage snapshot. It deliberately keeps the API-equivalent estimate
 * separate from the real subscription amount entered by the user.
 */
export function calculateOperatingCostReport({
  records,
  userRecords,
  source,
  config,
}: {
  records: AssistantRecord[];
  userRecords: UserRecord[];
  source: EffectiveSource;
  config: OperatingCostConfig;
}): OperatingCostReport {
  const scopedRecords = filterBySource(records, source).filter((record) => monthForTimestamp(record.timestamp) === config.month);
  const scopedUserRecords = filterBySource(userRecords, source).filter((record) => monthForTimestamp(record.timestamp) === config.month);
  const sources = expandSources(source);
  const durations = new Map<string, number>();
  const sessions = new Map<string, number>();
  const providerProjects = new Map<ProviderId, ReturnType<typeof aggregateByProject>>();

  for (const provider of sources) {
    const providerRecords = scopedRecords.filter((record) => record.source === provider);
    const providerUsers = scopedUserRecords.filter((record) => record.source === provider);
    const projects = aggregateByProject(providerRecords, { source: provider });
    providerProjects.set(provider, projects);
    for (const session of aggregateBySession(providerRecords, providerUsers, { source: provider })) {
      const key = `${provider}::${resolveProjectRootCwd(session.cwd)}`;
      durations.set(key, (durations.get(key) ?? 0) + session.durationMs);
      sessions.set(key, (sessions.get(key) ?? 0) + 1);
    }
  }

  const providerMetrics = new Map<ProviderId, number>();
  const providerRows = new Map<string, OperatingCostProviderBreakdown>();
  for (const provider of sources) {
    for (const project of providerProjects.get(provider) ?? []) {
      const durationMs = durations.get(`${provider}::${project.cwd}`) ?? 0;
      const metric = metricForBasis(config.basis, project, durationMs);
      providerMetrics.set(provider, (providerMetrics.get(provider) ?? 0) + metric);
      providerRows.set(`${provider}::${project.cwd}`, {
        source: provider,
        metric,
        share: 0,
        estimatedCost: project.cost,
        actualCost: 0,
      });
    }
  }

  const rows = new Map<string, OperatingCostProjectRow>();
  for (const provider of sources) {
    const plan = config.plans[provider];
    for (const project of providerProjects.get(provider) ?? []) {
      const durationMs = durations.get(`${provider}::${project.cwd}`) ?? 0;
      const metric = metricForBasis(config.basis, project, durationMs);
      const totalMetric = providerMetrics.get(provider) ?? 0;
      const share = totalMetric > 0 ? metric / totalMetric : 0;
      const actualCost = plan?.enabled && totalMetric > 0 ? (plan.monthlyCost * share) : 0;
      const providerRow = providerRows.get(`${provider}::${project.cwd}`)!;
      providerRow.share = share;
      providerRow.actualCost = actualCost;

      const current = rows.get(project.cwd) ?? {
        cwd: project.cwd,
        projectName: project.projectName,
        estimatedCost: 0,
        actualCost: 0,
        metric: 0,
        tokens: 0,
        requests: 0,
        durationMs: 0,
        sessions: 0,
        providers: [],
      };
      current.estimatedCost += project.cost;
      current.actualCost += actualCost;
      current.metric += metric;
      current.tokens += project.totalTokens;
      current.requests += project.requests;
      current.durationMs += durationMs;
      current.sessions += sessions.get(`${provider}::${project.cwd}`) ?? 0;
      current.providers.push(providerRow);
      rows.set(project.cwd, current);
    }
  }

  const configuredSources = sources.filter((provider) => config.plans[provider]?.enabled && (config.plans[provider]?.monthlyCost ?? 0) > 0);
  const configuredMonthlyCost = configuredSources.reduce((sum, provider) => sum + (config.plans[provider]?.monthlyCost ?? 0), 0);
  const reportRows = Array.from(rows.values()).sort((a, b) => b.actualCost - a.actualCost || b.estimatedCost - a.estimatedCost);

  return {
    month: config.month,
    basis: config.basis,
    currency: config.currency,
    rows: reportRows,
    estimatedTotal: reportRows.reduce((sum, row) => sum + row.estimatedCost, 0),
    actualTotal: reportRows.reduce((sum, row) => sum + row.actualCost, 0),
    configuredMonthlyCost,
    configuredSources,
    hasConfiguredPlans: configuredSources.length > 0,
  };
}
