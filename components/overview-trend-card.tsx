'use client';

import { useState } from 'react';
import { Section } from '@/components/section';
import { TokenStackChart, type TokenStackDatum } from '@/components/charts/token-stack-chart';
import { ConversationsBarChart } from '@/components/charts/conversations-bar-chart';
import { useI18n, useT } from '@/lib/i18n/context';
import { formatTokensCompact, formatCurrency } from '@/lib/utils';
import { useTabIndicator } from '@/components/use-tab-indicator';
import { TabIndicator } from '@/components/tab-indicator';
import { useCurrency } from '@/lib/currency/context';

type Metric = 'tokens' | 'conversations';

interface Props {
  data: TokenStackDatum[];

  activeDaysHint: string;
}

export function OverviewTrendCard({ data, activeDaysHint }: Props) {
  const t = useT();
  const { locale } = useI18n();
  const { currency } = useCurrency();
  const [metric, setMetric] = useState<Metric>('tokens');
  const metricLabel = t(
    metric === 'tokens' ? 'overview.trend.desc.tokens' : 'overview.trend.desc.conversations',
  );
  const totals = data.reduce(
    (summary, item) => ({
      tokens: summary.tokens + item.input + item.output + item.cacheRead + item.cacheCreation,
      conversations: summary.conversations + (item.turns ?? 0),
      cost: summary.cost + item.cost,
    }),
    { tokens: 0, conversations: 0, cost: 0 },
  );
  const activeDays = Math.max(data.length, 1);
  const primaryTotal = metric === 'tokens' ? totals.tokens : totals.conversations;
  const peak = data.reduce(
    (best, item) => {
      const value = metric === 'tokens'
        ? item.input + item.output + item.cacheRead + item.cacheCreation
        : item.turns ?? 0;
      return value > best.value ? { label: item.label, value } : best;
    },
    { label: '—', value: 0 },
  );
  const formatPrimary = (value: number) =>
    metric === 'tokens'
      ? formatTokensCompact(value, locale)
      : value.toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US');
  return (
    <Section
      title={t('overview.trend.title')}
      desc={t('overview.trend.desc', { metric: metricLabel })}
      right={
        <div className="flex items-center gap-3">
          <MetricToggle value={metric} onChange={setMetric} />
          <span className="text-xs text-text-tertiary whitespace-nowrap">{activeDaysHint}</span>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-border bg-border sm:grid-cols-4">
          <TrendStat label={t('overview.trend.summary.total')} value={formatPrimary(primaryTotal)} />
          <TrendStat
            label={t('overview.trend.summary.average')}
            value={formatPrimary(primaryTotal / activeDays)}
          />
          <TrendStat label={t('overview.trend.summary.peak')} value={formatPrimary(peak.value)} hint={peak.label} />
          <TrendStat label={t('overview.trend.summary.spend')} value={formatCurrency(totals.cost, currency)} accent />
        </div>
        <div className="min-w-0 rounded-card border border-border bg-bg-surface-hi/30 px-2 pt-3 sm:px-3">
          {metric === 'tokens' ? <TokenStackChart data={data} /> : <ConversationsBarChart data={data} />}
        </div>
      </div>
    </Section>
  );
}

function TrendStat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0 bg-bg-surface px-3 py-3 sm:px-4">
      <div className="label truncate">{label}</div>
      <div className={`mt-1 truncate text-base font-semibold tabular-nums ${accent ? 'text-brand' : 'text-text-primary'}`}>
        {value}
      </div>
      {hint && <div className="mt-0.5 truncate text-[11px] text-text-tertiary">{hint}</div>}
    </div>
  );
}

function MetricToggle({
  value,
  onChange,
}: {
  value: Metric;
  onChange: (m: Metric) => void;
}) {
  const t = useT();
  const opts: Array<{ id: Metric; labelKey: string }> = [
    { id: 'tokens', labelKey: 'overview.trend.metric.tokens' },
    { id: 'conversations', labelKey: 'overview.trend.metric.conversations' },
  ];
  const { containerRef, rect } = useTabIndicator<HTMLDivElement>(value);
  const showFallback = rect === null;
  return (
    <div className="inline-flex items-center rounded-md border border-border bg-bg-surface p-0.5">
      <div ref={containerRef} role="tablist" aria-label={t('overview.trend.title')} className="relative flex gap-0.5">
        <TabIndicator rect={rect} />
        {opts.map((o) => {
          const isActive = o.id === value;
          return (
            <button
              key={o.id}
              type="button"
              role="tab"
              data-tab={o.id}
              aria-selected={isActive}
              onClick={() => onChange(o.id)}
              className={`relative z-10 px-2.5 h-6 text-xs inline-flex items-center rounded transition-colors ${
                isActive
                  ? `text-white font-semibold ${showFallback ? 'bg-brand-strong shadow-sm' : ''}`
                  : 'text-text-tertiary font-medium hover:text-text-primary hover:bg-bg-surface-hi'
              }`}
            >
              {t(o.labelKey)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
