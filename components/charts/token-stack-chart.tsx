'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatTokensCompact, formatUSD } from '@/lib/utils';
import { useT, useI18n } from '@/lib/i18n/context';

export interface TokenStackDatum {
  label: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheCreation: number;
  cost: number;
  saved?: number;

  requests: number;

  turns?: number;
}

const COLORS = {
  input: 'rgb(var(--chart-input))',
  output: 'rgb(var(--chart-output))',
  cacheRead: 'rgb(var(--chart-cache-read))',
  cacheCreation: 'rgb(var(--chart-cache-create))',
};

export function TokenStackChart({ data, height = 'h-72' }: { data: TokenStackDatum[]; height?: string }) {
  const t = useT();
  const { locale } = useI18n();
  if (!data.length) {
    return (
      <div className={`${height} flex items-center justify-center text-text-tertiary text-sm`}>
        {t('chart.empty')}
      </div>
    );
  }
  return (
    <div className={`${height} flex w-full min-w-0 flex-col`}>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 8 }} barCategoryGap="28%">
            <CartesianGrid
              stroke="rgb(var(--chart-grid))"
              strokeOpacity={0.6}
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fill: 'rgb(var(--chart-axis))', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={32}
              tickMargin={8}
            />
            <YAxis
              tickFormatter={(v) => formatTokensCompact(Number(v), locale)}
              tick={{ fill: 'rgb(var(--chart-axis))', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={56}
              tickMargin={4}
            />
            <Tooltip
              content={<TokenStackTooltip />}
              cursor={{ fill: 'rgb(var(--text-primary) / 0.05)', radius: 4 }}
            />
            <Bar dataKey="input" stackId="a" fill={COLORS.input} maxBarSize={30} activeBar={{ stroke: 'rgb(var(--text-primary) / 0.28)', strokeWidth: 1 }} isAnimationActive={false} />
            <Bar dataKey="cacheCreation" stackId="a" fill={COLORS.cacheCreation} maxBarSize={30} activeBar={{ stroke: 'rgb(var(--text-primary) / 0.28)', strokeWidth: 1 }} isAnimationActive={false} />
            <Bar dataKey="cacheRead" stackId="a" fill={COLORS.cacheRead} maxBarSize={30} activeBar={{ stroke: 'rgb(var(--text-primary) / 0.28)', strokeWidth: 1 }} isAnimationActive={false} />
            <Bar dataKey="output" stackId="a" fill={COLORS.output} maxBarSize={30} radius={[4, 4, 0, 0]} activeBar={{ stroke: 'rgb(var(--text-primary) / 0.28)', strokeWidth: 1 }} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex shrink-0 flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-border/70 pt-3 text-xs text-text-secondary">
        <Legend color={COLORS.input} label={t('chart.legend.input')} />
        <Legend color={COLORS.cacheCreation} label={t('chart.legend.cacheWrite')} />
        <Legend color={COLORS.cacheRead} label={t('chart.legend.cacheRead')} />
        <Legend color={COLORS.output} label={t('chart.legend.output')} />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      <span>{label}</span>
    </span>
  );
}

function TokenStackTooltip(props: {
  active?: boolean;
  payload?: Array<{ payload: TokenStackDatum }>;
  label?: string;
}) {
  const t = useT();
  const { locale } = useI18n();
  if (!props.active || !props.payload || !props.payload.length) return null;
  const d = props.payload[0].payload;
  const total = d.input + d.output + d.cacheRead + d.cacheCreation;
  return (
    <div className="card-elevated border border-border-hi rounded-card p-3 text-xs min-w-[200px]">
      <div className="font-medium text-text-primary mb-2">{props.label}</div>
      <div className="space-y-1">
        <Row color={COLORS.input} label={t('chart.legend.input')} value={d.input} locale={locale} />
        <Row color={COLORS.cacheCreation} label={t('chart.legend.cacheWrite')} value={d.cacheCreation} locale={locale} />
        <Row color={COLORS.cacheRead} label={t('chart.legend.cacheRead')} value={d.cacheRead} locale={locale} />
        <Row color={COLORS.output} label={t('chart.legend.output')} value={d.output} locale={locale} />
      </div>
      <div className="mt-2 pt-2 border-t border-border flex items-center justify-between">
        <span className="text-text-secondary">{t('chart.tooltip.total')}</span>
        <span className="num-mono text-text-primary">{formatTokensCompact(total, locale)}</span>
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-text-secondary">{t('chart.tooltip.cost')}</span>
        <span className="num-mono text-brand">{formatUSD(d.cost)}</span>
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-text-secondary">{t('chart.tooltip.requests')}</span>
        <span className="num-mono text-text-primary">{d.requests}</span>
      </div>
    </div>
  );
}

function Row({ color, label, value, locale }: { color: string; label: string; value: number; locale: 'en' | 'zh' }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-1.5 text-text-secondary">
        <span className="w-2 h-2 rounded-sm" style={{ background: color }} />
        {label}
      </span>
      <span className="num-mono text-text-primary">{formatTokensCompact(value, locale)}</span>
    </div>
  );
}
