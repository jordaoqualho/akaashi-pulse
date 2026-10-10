import { getCachedScan } from '@/lib/data-loader/scan';
import { Suspense } from 'react';
import {
  aggregateByModel,
  aggregateByProject,
  aggregateBySession,
  aggregateByTime,
  aggregateTotals,
  bucketKey,
} from '@/lib/aggregator';
import { buildTurnIndex } from '@/lib/turns';
import { blockProgress } from '@/lib/blocks/compute';
import { KpiCard } from '@/components/kpi-card';
import { Section, PageShell, EmptyState } from '@/components/section';
import { type TokenStackDatum } from '@/components/charts/token-stack-chart';
import { ModelBarChart } from '@/components/charts/model-bar-chart';
import { BlockProgress } from '@/components/block-progress';
import { OverviewTrendCard } from '@/components/overview-trend-card';
import { CostLineChart } from '@/components/charts/cost-line-chart';
import { ProjectSpendChart, type ProjectSpendDatum } from '@/components/charts/project-spend-chart';
import { blockToSerialized } from '@/lib/serialize';
import {
  formatTokensCompact,
  formatCurrency,
  formatDuration,
  formatPct,
} from '@/lib/utils';
import { getServerT, getServerLocale } from '@/lib/i18n/server';
import { resolveSource, filterBySource, expandSources } from '@/lib/source';
import { combineTimeBuckets, combineTotals } from '@/lib/source-merge';
import { getProvider } from '@/lib/providers';
import { computeActivityStats, pickTokenComparison } from '@/lib/aggregator/activity';
import { ActivityStatsSection } from '@/components/activity-stats';
import { AutoRefresh } from '@/components/auto-refresh';
import { IndexerLoading } from '@/components/indexer-loading';
import { resolveProjectRootCwd } from '@/lib/project-label';
import type { AssistantRecord, ModelSummary, ProviderId, UserRecord } from '@/lib/types';
import { getServerCurrency } from '@/lib/currency/server';
import { totalActiveTime } from '@/lib/session-insights';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function isToday(ts: string): boolean {
  const d = new Date(ts);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isYesterday(ts: string): boolean {
  const d = new Date(ts);
  const ref = new Date();
  ref.setDate(ref.getDate() - 1);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

function isThisMonth(ts: string): boolean {
  const d = new Date(ts);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function buildProjectInsights(
  records: AssistantRecord[],
  userRecords: UserRecord[],
  sources: ProviderId[],
): ProjectSpendDatum[] {
  const projects = new Map<string, ProjectSpendDatum>();

  for (const provider of sources) {
    for (const project of aggregateByProject(records, { source: provider })) {
      const name = resolveProjectRootCwd(project.cwd).split(/[\\/]/).filter(Boolean).pop() ?? project.projectName;
      const key = resolveProjectRootCwd(project.cwd);
      const current = projects.get(key) ?? {
        name,
        cost: 0,
        durationMs: 0,
        sessions: 0,
        requests: 0,
        href: `/projects/${encodeURIComponent(key)}?source=${sources.length > 1 ? 'all' : sources[0]}`,
      };
      current.cost += project.cost;
      current.sessions += project.sessions;
      current.requests += project.requests;
      projects.set(key, current);
    }

    for (const session of aggregateBySession(records, userRecords, { source: provider })) {
      const key = resolveProjectRootCwd(session.cwd);
      const current = projects.get(key);
      if (current) current.durationMs += session.durationMs;
    }
  }

  return Array.from(projects.values()).sort((a, b) => b.cost - a.cost);
}

export default function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  return (
    <Suspense fallback={<IndexerLoading />}>
      <OverviewContent searchParams={searchParams} />
    </Suspense>
  );
}

async function OverviewContent({ searchParams }: { searchParams: Promise<{ source?: string }> }) {
  const sp = await searchParams;
  const source = await resolveSource(sp.source);
  const scan = await getCachedScan();

  const records = filterBySource(scan.records, source);
  const sources = expandSources(source);

  const t = await getServerT();
  const locale = await getServerLocale();
  const currency = await getServerCurrency();
  const fmtTokens = (n: number) => formatTokensCompact(n, locale);

  const shorten = (m: ModelSummary) => getProvider(m.source).shortenModel(m.model);

  if (records.length === 0) {
    return (
      <PageShell title={t('overview.title')} desc={t('brand.tagline')}>
        <AutoRefresh intervalMs={30_000} />
        <EmptyState
          title={t('overview.empty.title')}
          desc={t('overview.subtitle.empty', { dirs: scan.stats.scannedDirs.length })}
        />
      </PageShell>
    );
  }

  const todayRecs = records.filter((r) => isToday(r.timestamp));
  const yesterdayRecs = records.filter((r) => isYesterday(r.timestamp));
  const monthRecs = records.filter((r) => isThisMonth(r.timestamp));

  const today = combineTotals(sources.map((s) => aggregateTotals(todayRecs, { source: s })));
  const yest = combineTotals(sources.map((s) => aggregateTotals(yesterdayRecs, { source: s })));
  const month = combineTotals(sources.map((s) => aggregateTotals(monthRecs, { source: s })));

  const hasYesterday = yest.totalTokens > 0 || yest.cost > 0;
  const tokenDelta = yest.totalTokens > 0 ? ((today.totalTokens - yest.totalTokens) / yest.totalTokens) * 100 : NaN;
  const firstTimeDelta = !hasYesterday && (today.totalTokens > 0 || today.cost > 0)
    ? { firstTime: true as const, label: t('overview.delta.firstTime') }
    : null;

  const cacheHit =
    today.cacheReadTokens + today.inputTokens > 0
      ? today.cacheReadTokens / (today.cacheReadTokens + today.inputTokens + today.cacheCreationTokens)
      : 0;

  const blocksBySource: Array<{ source: ProviderId; serialized: ReturnType<typeof blockToSerialized> }> = sources.map(
    (s) => {
      const provider = getProvider(s);
      const recs = source === 'all' ? records.filter((r) => r.source === s) : records;
      const block = blockProgress(recs, provider.capabilities.blockWindowMs);
      return { source: s, serialized: blockToSerialized(block) };
    },
  );

  const thirtyAgo = new Date();
  thirtyAgo.setDate(thirtyAgo.getDate() - 30);

  const trendBuckets = combineTimeBuckets(
    sources.map((s) => aggregateByTime(records, 'day', { source: s, from: thirtyAgo })),
  );

  const fromIso = thirtyAgo.toISOString();
  const scopedRecords = records.filter((r) => r.timestamp >= fromIso);
  const scopedUsers = filterBySource(scan.userRecords, source).filter(
    (u) => u.timestamp >= fromIso,
  );
  const turnIndex = buildTurnIndex(scopedRecords, scopedUsers, scan.parentMap);
  const turnStartTs = new Map<string, string>();
  for (const r of scopedRecords) {
    const turnId = turnIndex.get(r.uuid) ?? r.uuid;
    const existing = turnStartTs.get(turnId);
    if (!existing || r.timestamp < existing) turnStartTs.set(turnId, r.timestamp);
  }
  const turnsByBucket = new Map<string, number>();
  for (const ts of turnStartTs.values()) {
    const { key } = bucketKey(ts, 'day');
    turnsByBucket.set(key, (turnsByBucket.get(key) ?? 0) + 1);
  }

  const trendData: TokenStackDatum[] = trendBuckets.map((b) => ({
    label: b.label,
    input: b.inputTokens,
    output: b.outputTokens,
    cacheRead: b.cacheReadTokens,
    cacheCreation: b.cacheCreationTokens,
    cost: b.cost,
    saved: b.saved,
    requests: b.requests,
    turns: turnsByBucket.get(b.key) ?? 0,
  }));

  const recentTotals = combineTotals(
    sources.map((s) => aggregateTotals(scopedRecords, { source: s })),
  );
  const recentSessions = sources.flatMap((s) =>
    aggregateBySession(scopedRecords, scopedUsers, { source: s }),
  );
  const trackedTimeMs = totalActiveTime(recentSessions, scopedRecords);
  const costPerHour = trackedTimeMs > 0 ? recentTotals.cost / (trackedTimeMs / 3_600_000) : 0;
  const projectInsights = buildProjectInsights(scopedRecords, scopedUsers, sources);
  const activeDays = trendBuckets.length;
  const activeDaysHint =
    activeDays === 1
      ? t('overview.trend.activeDays', { n: 1 })
      : t('overview.trend.activeDays.plural', { n: activeDays });

  const monthModelsAllSources = sources
    .flatMap((s) => aggregateByModel(records, { source: s, from: startOfMonth() }))
    .sort((a, b) => b.cost - a.cost);
  const topModel = monthModelsAllSources[0];
  const topModelPct =
    topModel && month.cost > 0 ? formatPct(topModel.cost / month.cost) : '—';

  const sourceFileCount =
    source === 'all'
      ? scan.bySource.reduce((sum, s) => sum + s.filesScanned, 0)
      : (scan.bySource.find((s) => s.source === source)?.filesScanned ?? 0);
  const sourceRecordCount =
    source === 'all'
      ? scan.bySource.reduce((sum, s) => sum + s.assistantRecords, 0)
      : (scan.bySource.find((s) => s.source === source)?.assistantRecords ?? records.length);
  const activeBlockSource = source === 'all' ? pickBusierBlock(blocksBySource) : source;
  const activeBlock = blocksBySource.find((block) => block.source === activeBlockSource) ?? blocksBySource[0];
  const activeBlockProvider = getProvider(activeBlock.source);
  const activeBlockLabel = locale === 'zh'
    ? activeBlockProvider.displayName.zh
    : activeBlockProvider.displayName.en;

  return (
    <PageShell
      title={t('overview.title')}
      desc={t('overview.subtitle', {
        count: sourceRecordCount.toLocaleString(),
        files: sourceFileCount,
        ms: scan.stats.durationMs,
      })}
    >
      <AutoRefresh intervalMs={30_000} />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label={t('overview.kpi.tokensToday')}
          value={fmtTokens(today.totalTokens)}
          hint={t('overview.kpi.tokensToday.hint', { count: today.requests })}
          delta={Number.isFinite(tokenDelta) ? { value: tokenDelta, positiveIsGood: false } : firstTimeDelta}
          deltaTitle={t('overview.delta.title')}
        />
        <KpiCard
          label={t('overview.kpi.thisMonth')}
          value={formatCurrency(month.cost, currency)}
          hint={t('overview.kpi.thisMonth.hint', {
            tokens: fmtTokens(month.totalTokens),
            req: month.requests,
          })}
          warning={
            month.unpricedRequests > 0
              ? t('common.unpricedCalls', { count: month.unpricedRequests })
              : undefined
          }
        />
        <KpiCard
          label={t('overview.kpi.cacheHit')}
          value={formatPct(cacheHit, 0)}
          hint={t('overview.kpi.cacheHit.hint', { amount: formatCurrency(today.saved, currency) })}
          accent="success"
          progress={{ value: cacheHit, tone: 'success' }}
        />
        <KpiCard
          label={t('overview.kpi.topModel')}
          value={topModel ? shorten(topModel) : '—'}
          hint={topModel ? t('overview.kpi.topModel.hint', { pct: topModelPct }) : ''}
          accent="brand"
        />
        <KpiCard
          label={t('overview.kpi.trackedTime')}
          value={formatDuration(trackedTimeMs)}
          hint={t('overview.kpi.trackedTime.hint', { count: recentSessions.length })}
          accent="success"
        />
        <KpiCard
          label={t('overview.kpi.costPerHour')}
          value={trackedTimeMs > 0 ? formatCurrency(costPerHour, currency, { minFrac: 3, maxFrac: 3 }) : '—'}
          hint={t('overview.kpi.costPerHour.hint')}
          accent="warning"
        />
      </div>

      <OverviewTrendCard data={trendData} activeDaysHint={activeDaysHint} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Section
          title={t('overview.costTrend.title')}
          desc={t('overview.costTrend.desc')}
          className="xl:col-span-3"
        >
          <CostLineChart
            data={trendData.map((item) => ({
              label: item.label,
              cost: item.cost,
              saved: item.saved ?? 0,
              requests: item.requests,
            }))}
          />
        </Section>
        <Section
          title={t('overview.costByModel.title')}
          desc={t('overview.costByModel.desc')}
          className="xl:col-span-2"
        >
          <ModelBarChart models={monthModelsAllSources.slice(0, 6)} />
        </Section>
      </div>

      <div className="grid min-w-0 grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
        <div className="flex min-w-0 lg:col-span-2">
          <ActivityStatsSection
            stats={computeActivityStats(records, { source })}
            comparison={pickTokenComparison(
              records.reduce(
                (s, r) =>
                  s +
                  r.usage.input_tokens +
                  r.usage.output_tokens +
                  r.usage.cache_read_input_tokens +
                  r.usage.cache_creation_input_tokens,
                0,
              ),
            )}
            locale={locale}
            className="flex-1"
          />
        </div>
        <div className="flex min-w-0">
          <BlockProgress
            initial={activeBlock.serialized}
            sourceLabel={source === 'all' ? activeBlockLabel : undefined}
            cliName={activeBlock.source === 'claude' ? 'Claude Code' : activeBlockProvider.displayName.en}
            className="flex-1"
          />
        </div>
      </div>

      <Section title={t('overview.projects.title')} desc={t('overview.projects.desc')}>
        <ProjectSpendChart
          data={projectInsights}
          costTitle={t('overview.projects.cost')}
          timeTitle={t('overview.projects.time')}
          rateLabel={t('overview.projects.rate')}
          emptyLabel={t('overview.projects.empty')}
          sessionsLabel={t('projects.stat.sessions')}
          requestsLabel={t('projects.stat.requests')}
          currency={currency}
        />
      </Section>
    </PageShell>
  );
}

function startOfMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function pickBusierBlock(
  blocks: Array<{ source: ProviderId; serialized: ReturnType<typeof blockToSerialized> }>,
): ProviderId {
  if (blocks.length === 0) return 'claude';
  const withActive = blocks.filter((b) => b.serialized.hasBlock);
  if (withActive.length === 1) return withActive[0].source;
  const pool = withActive.length > 0 ? withActive : blocks;
  let best = pool[0];
  for (const b of pool) {
    if (b.serialized.cost > best.serialized.cost) best = b;
  }
  return best.source;
}
