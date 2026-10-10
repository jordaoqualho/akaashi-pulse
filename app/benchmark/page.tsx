import { ExternalLink } from 'lucide-react';
import { getCachedScan } from '@/lib/data-loader/scan';
import { aggregateByModel } from '@/lib/aggregator';
import { KpiCard } from '@/components/kpi-card';
import { EmptyState, PageShell, Section } from '@/components/section';
import { ModelBenchmarkTable, type BenchmarkRow } from '@/components/model-benchmark-table';
import { formatTokensCompact, formatCurrency, formatCurrencyPrecise } from '@/lib/utils';
import { getServerLocale, getServerT } from '@/lib/i18n/server';
import { getServerCurrency } from '@/lib/currency/server';
import { expandSources, filterBySource, resolveSource } from '@/lib/source';
import { getProvider } from '@/lib/providers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function BenchmarkPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  const sp = await searchParams;
  const source = await resolveSource(sp.source);
  const t = await getServerT();
  const locale = await getServerLocale();
  const currency = await getServerCurrency();
  const scan = await getCachedScan();
  const records = filterBySource(scan.records, source);
  const sources = expandSources(source);
  const models = sources
    .flatMap((provider) => aggregateByModel(records, { source: provider }))
    .sort((a, b) => b.requests - a.requests);

  if (models.length === 0) {
    return (
      <PageShell title={t('benchmark.title')} desc={t('benchmark.subtitle', { count: 0 })}>
        <EmptyState title={t('benchmark.empty')} desc={t('benchmark.emptyHint')} />
      </PageShell>
    );
  }

  const rows: BenchmarkRow[] = models.map((model) => {
    const cacheableInput = model.cacheReadTokens + model.inputTokens + model.cacheCreationTokens;
    return {
      id: `${model.source}:${model.model}`,
      model: model.model,
      displayModel: getProvider(model.source).shortenModel(model.model),
      providerId: model.source,
      providerLabel: getProvider(model.source).displayName[locale],
      logoSrc: getProvider(model.source).logoSrc,
      requests: model.requests,
      tokens: model.totalTokens,
      cost: model.cost,
      averageCost: model.requests > 0 ? model.cost / model.requests : null,
      costPerMillion: model.totalTokens > 0 ? (model.cost / model.totalTokens) * 1_000_000 : null,
      cacheHit: cacheableInput > 0 ? model.cacheReadTokens / cacheableInput : null,
      inputPrice: model.pricing?.input ?? null,
      outputPrice: model.pricing?.output ?? null,
      priced: model.priced,
    };
  });

  const totalCost = rows.reduce((sum, row) => sum + row.cost, 0);
  const totalTokens = rows.reduce((sum, row) => sum + row.tokens, 0);
  const totalRequests = rows.reduce((sum, row) => sum + row.requests, 0);
  const lowestCost = rows
    .filter((row) => row.costPerMillion != null && row.priced)
    .sort((a, b) => (a.costPerMillion ?? Infinity) - (b.costPerMillion ?? Infinity))[0];
  const mostUsed = rows.slice().sort((a, b) => b.requests - a.requests)[0];
  const cacheLeader = rows
    .filter((row) => row.cacheHit != null)
    .sort((a, b) => (b.cacheHit ?? -1) - (a.cacheHit ?? -1))[0];

  return (
    <PageShell title={t('benchmark.title')} desc={t('benchmark.subtitle', { count: rows.length })}>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label={t('benchmark.kpi.models')} value={rows.length.toLocaleString()} hint={t('benchmark.kpi.modelsHint')} />
        <KpiCard label={t('benchmark.kpi.requests')} value={totalRequests.toLocaleString()} hint={t('benchmark.kpi.requestsHint')} accent="brand" />
        <KpiCard label={t('benchmark.kpi.tokens')} value={formatTokensCompact(totalTokens, locale)} hint={t('benchmark.kpi.tokensHint')} accent="success" />
        <KpiCard label={t('benchmark.kpi.cost')} value={formatCurrency(totalCost, currency)} hint={t('benchmark.kpi.costHint')} accent="warning" />
      </div>

      <Section title={t('benchmark.decisions.title')} desc={t('benchmark.decisions.desc')}>
        <div className="grid gap-3 lg:grid-cols-3">
          <DecisionCard
            title={t('benchmark.decision.costTitle')}
            desc={t('benchmark.decision.costDesc')}
            row={lowestCost}
            value={lowestCost?.costPerMillion == null ? '—' : formatCurrencyPrecise(lowestCost.costPerMillion, currency)}
            valueLabel={t('benchmark.decision.perMillion')}
            empty={t('benchmark.decision.noPricedData')}
            tone="brand"
          />
          <DecisionCard
            title={t('benchmark.decision.usageTitle')}
            desc={t('benchmark.decision.usageDesc')}
            row={mostUsed}
            value={mostUsed ? mostUsed.requests.toLocaleString() : '—'}
            valueLabel={t('benchmark.decision.requests')}
            empty={t('benchmark.decision.noUsageData')}
            tone="success"
          />
          <DecisionCard
            title={t('benchmark.decision.cacheTitle')}
            desc={t('benchmark.decision.cacheDesc')}
            row={cacheLeader}
            value={cacheLeader?.cacheHit == null ? '—' : `${Math.round(cacheLeader.cacheHit * 100)}%`}
            valueLabel={t('benchmark.decision.cacheHit')}
            empty={t('benchmark.decision.noCacheData')}
            tone="warning"
          />
        </div>
        <p className="mt-4 text-xs leading-relaxed text-text-tertiary">{t('benchmark.decisions.note')}</p>
      </Section>

      <ModelBenchmarkTable
        rows={rows}
        locale={locale}
        labels={{
          title: t('benchmark.table.title'),
          description: t('benchmark.table.desc'),
          searchPlaceholder: t('benchmark.table.search'),
          allProviders: t('benchmark.table.allProviders'),
          noMatches: t('benchmark.table.noMatches'),
          modelsCount: t('benchmark.table.modelsCount'),
          model: t('benchmark.table.model'),
          activity: t('benchmark.table.activity'),
          cost: t('benchmark.table.cost'),
          observedCost: t('benchmark.table.observedCost'),
          cache: t('benchmark.table.cache'),
          rates: t('benchmark.table.rates'),
          requests: t('benchmark.table.requests'),
          tokens: t('benchmark.table.tokens'),
          sortBy: t('benchmark.table.sortBy'),
        }}
      />

      <Section title={t('benchmark.reference.title')} desc={t('benchmark.reference.desc')}>
        <div className="flex flex-col gap-4 rounded-button border border-border bg-bg-surface-hi/40 p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-3xl">
            <div className="text-sm font-semibold text-text-primary">{t('benchmark.reference.name')}</div>
            <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">{t('benchmark.reference.body')}</p>
            <p className="mt-2 text-xs leading-relaxed text-text-tertiary">{t('benchmark.reference.caveat')}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <a href="https://artificialanalysis.ai/leaderboards/models" target="_blank" rel="noreferrer" className="btn btn-line btn-sm">
              {t('benchmark.reference.open')} <ExternalLink size={14} aria-hidden />
            </a>
            <a href="https://artificialanalysis.ai/methodology" target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
              {t('benchmark.reference.methodology')} <ExternalLink size={14} aria-hidden />
            </a>
          </div>
        </div>
      </Section>
    </PageShell>
  );
}

function DecisionCard({
  title,
  desc,
  row,
  value,
  valueLabel,
  empty,
  tone,
}: {
  title: string;
  desc: string;
  row?: BenchmarkRow;
  value: string;
  valueLabel: string;
  empty: string;
  tone: 'brand' | 'success' | 'warning';
}) {
  const toneClass = {
    brand: 'bg-brand',
    success: 'bg-success',
    warning: 'bg-warning',
  }[tone];
  return (
    <div className="relative overflow-hidden rounded-button border border-border bg-bg-surface-hi/40 p-4">
      <div className={`absolute inset-x-0 top-0 h-[3px] ${toneClass}`} aria-hidden />
      <div className="label">{title}</div>
      <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">{desc}</p>
      {row ? (
        <div className="mt-4 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-text-primary">{row.displayModel}</div>
            <div className="mt-0.5 truncate text-xs text-text-tertiary">{row.providerLabel}</div>
          </div>
          <div className="shrink-0 text-right">
            <div className="num-mid">{value}</div>
            <div className="text-xs text-text-tertiary">{valueLabel}</div>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-text-tertiary">{empty}</p>
      )}
    </div>
  );
}
