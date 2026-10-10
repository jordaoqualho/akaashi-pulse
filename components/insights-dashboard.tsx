'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowUpRight,
  CalendarClock,
  Coffee,
  DatabaseZap,
  FolderKanban,
  Hourglass,
  Scale,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { Section } from '@/components/section';
import { KpiCard } from '@/components/kpi-card';
import { useCurrency } from '@/lib/currency/context';
import { useI18n, useT } from '@/lib/i18n/context';
import { cn, formatCurrency, formatDuration, formatTokensCompact } from '@/lib/utils';
import type {
  InsightFinding,
  SessionInsightPoint,
  SessionInsightRank,
  SessionInsightSession,
  SessionInsights,
} from '@/lib/session-insights';

/** Sequential single-hue ramp (brand red) for the activity heatmap; index 0 = no activity. */
const HEAT_STEPS = [0, 0.14, 0.3, 0.5, 0.72, 1];

function pct(value: number): string {
  if (value > 0 && value < 0.01) return '<1%';
  return `${Math.round(value * 100)}%`;
}

function delta(current: number, previous: number | undefined): number | null {
  if (previous === undefined || previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

function hourLabel(hour: number): string {
  return `${String(hour % 24).padStart(2, '0')}:00`;
}

export function InsightsDashboard({ data, range }: { data: SessionInsights; range: string }) {
  const t = useT();
  const { locale } = useI18n();
  const { currency } = useCurrency();
  const { totals, previous } = data;
  const compareTitle = previous ? t('insights.kpi.vsPrevious') : undefined;

  return (
    <div className="space-y-5 sm:space-y-6">
      <FindingsPanel findings={data.findings} range={range} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label={t('insights.kpi.cost')}
          value={formatCurrency(totals.cost, currency)}
          delta={deltaProp(totals.cost, previous?.cost, false)}
          deltaTitle={compareTitle}
          hint={t('insights.kpi.averageCost', { amount: formatCurrency(totals.averageCost, currency) })}
        />
        <KpiCard
          label={t('insights.kpi.sessions')}
          value={totals.sessions.toLocaleString(locale)}
          delta={deltaProp(totals.sessions, previous?.sessions)}
          deltaTitle={compareTitle}
          hint={t('insights.kpi.sessionsHint', { days: totals.activeDays, requests: totals.requests.toLocaleString(locale) })}
        />
        <KpiCard
          label={t('insights.kpi.activeTime')}
          value={formatDuration(totals.activeMs)}
          delta={deltaProp(totals.activeMs, previous?.activeMs)}
          deltaTitle={compareTitle}
          hint={t('insights.kpi.activeTimeHint', { duration: formatDuration(totals.averageActiveMs) })}
        />
        <KpiCard
          label={t('insights.kpi.costPerHour')}
          value={totals.costPerActiveHour ? formatCurrency(totals.costPerActiveHour, currency) : '—'}
          delta={deltaProp(totals.costPerActiveHour, previous?.costPerActiveHour, false)}
          deltaTitle={compareTitle}
          hint={t('insights.kpi.costPerHourHint')}
        />
        <KpiCard
          className="col-span-2 md:col-span-1"
          label={t('insights.kpi.cache')}
          value={pct(totals.cacheShare)}
          hint={totals.saved > 0
            ? t('insights.kpi.cacheSaved', { amount: formatCurrency(totals.saved, currency) })
            : t('insights.kpi.cacheHint', { tokens: formatTokensCompact(totals.tokens, locale) })}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.7fr)]">
        <Section
          title={t('insights.daily.title')}
          desc={t('insights.daily.desc')}
          right={data.peakDay ? <span className="pill-muted">{t('insights.daily.peak', { day: data.peakDay.label, amount: formatCurrency(data.peakDay.cost, currency) })}</span> : undefined}
        >
          <DailySpendChart data={data.daily} />
        </Section>
        <Section title={t('insights.duration.title')} desc={t('insights.duration.desc')}>
          <DurationProfile buckets={data.durationBuckets} />
        </Section>
      </div>

      <Section id="rhythm" title={t('insights.rhythm.title')} desc={t('insights.rhythm.desc')}>
        <ActivityHeatmap heatmap={data.heatmap} />
      </Section>

      <div className="grid gap-5 lg:grid-cols-2">
        <RankedSection title={t('insights.projects.title')} desc={t('insights.projects.desc')} rows={data.projects} />
        <RankedSection title={t('insights.models.title')} desc={t('insights.models.desc')} rows={data.models} showUnitCost />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <NotableSessions title={t('insights.costliest.title')} desc={t('insights.costliest.desc')} sessions={data.costliest} metric="cost" />
        <NotableSessions title={t('insights.longest.title')} desc={t('insights.longest.desc')} sessions={data.longest} metric="duration" />
      </div>

      <p className="max-w-3xl text-xs leading-relaxed text-text-tertiary">{t('insights.methodology')}</p>
    </div>
  );
}

function deltaProp(current: number, previous: number | undefined, positiveIsGood = true) {
  const value = delta(current, previous);
  return value === null ? null : { value, positiveIsGood };
}

/* ─────────────────────────────── Findings ─────────────────────────────── */

function FindingsPanel({ findings, range }: { findings: InsightFinding[]; range: string }) {
  const t = useT();
  return (
    <section className="panel overflow-hidden" aria-labelledby="insights-findings">
      <header className="flex items-center gap-2.5 border-b border-border px-5 pb-3 pt-4 sm:px-6 sm:pt-5">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand/10 text-brand" aria-hidden>
          <Sparkles size={14} strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <h2 id="insights-findings" className="text-[15px] font-semibold leading-tight tracking-tight text-text-primary">{t('insights.findings.title')}</h2>
          <p className="mt-1 text-xs leading-relaxed text-text-secondary">{t('insights.findings.desc')}</p>
        </div>
      </header>
      {findings.length ? (
        <ol className="grid divide-y divide-border/70 md:grid-cols-2 md:divide-y-0">
          {findings.map((finding, index) => (
            <li
              key={`${finding.kind}-${index}`}
              className={cn(
                'border-border/70 md:border-b',
                index % 2 === 0 && 'md:border-r',
                // Drop the bottom rule on the last visual row.
                index >= findings.length - (findings.length % 2 === 0 ? 2 : 1) && 'md:border-b-0',
              )}
            >
              <FindingRow finding={finding} rank={index + 1} range={range} />
            </li>
          ))}
        </ol>
      ) : (
        <p className="px-5 py-6 text-sm text-text-secondary sm:px-6">{t('insights.findings.empty')}</p>
      )}
    </section>
  );
}

function FindingRow({ finding, rank, range }: { finding: InsightFinding; rank: number; range: string }) {
  const view = useFindingView(finding, range);
  const Icon = view.icon;
  return (
    <div className="flex h-full gap-3.5 px-5 py-4 sm:px-6">
      <span className="relative mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-bg-surface-hi text-text-secondary" aria-hidden>
        <Icon size={15} strokeWidth={1.8} />
        {rank === 1 && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-brand ring-2 ring-bg-surface" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug text-text-primary">{view.title}</p>
        <p className="mt-1 text-xs leading-relaxed text-text-secondary">{view.detail}</p>
        {view.action && (
          <Link href={view.action.href} className="mt-2 inline-flex items-center gap-1 rounded-sm text-xs font-medium text-text-primary underline-offset-4 hover:text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40">
            {view.action.label}
            <ArrowUpRight size={12} aria-hidden />
          </Link>
        )}
      </div>
    </div>
  );
}

function useFindingView(finding: InsightFinding, range: string): {
  icon: typeof Sparkles;
  title: string;
  detail: string;
  action?: { href: string; label: string };
} {
  const t = useT();
  const { currency } = useCurrency();
  const money = (value: number) => formatCurrency(value, currency);
  const usageHref = `/usage?range=${encodeURIComponent(range)}`;

  switch (finding.kind) {
    case 'spendChange':
      return {
        icon: finding.change >= 0 ? TrendingUp : TrendingDown,
        title: t(finding.change >= 0 ? 'insights.finding.spendUp.title' : 'insights.finding.spendDown.title', { pct: pct(Math.abs(finding.change)), days: finding.days }),
        detail: t('insights.finding.spendChange.detail', { current: money(finding.current), previous: money(finding.previous) }),
        action: { href: usageHref, label: t('insights.finding.action.usage') },
      };
    case 'projectConcentration':
      return {
        icon: FolderKanban,
        title: t('insights.finding.project.title', { project: finding.project, pct: pct(finding.share) }),
        detail: t('insights.finding.project.detail', { amount: money(finding.cost) }),
        action: finding.href ? { href: finding.href, label: t('insights.finding.action.project') } : undefined,
      };
    case 'modelPremium':
      return {
        icon: Scale,
        title: t('insights.finding.model.title', { expensive: finding.expensive, cheap: finding.cheap, ratio: finding.ratio.toFixed(1) }),
        detail: t('insights.finding.model.detail', { requests: pct(finding.requestShare), cost: pct(finding.costShare) }),
        action: { href: '/benchmark', label: t('insights.finding.action.benchmark') },
      };
    case 'cacheSavings':
      return {
        icon: DatabaseZap,
        title: t('insights.finding.cache.title', { amount: money(finding.saved) }),
        detail: t('insights.finding.cache.detail', { pct: pct(finding.cacheShare) }),
        action: { href: usageHref, label: t('insights.finding.action.usage') },
      };
    case 'outlierSession':
      return {
        icon: Zap,
        title: t('insights.finding.outlier.title', { pct: pct(finding.share) }),
        detail: t('insights.finding.outlier.detail', { title: finding.session.title, project: finding.session.project, amount: money(finding.session.cost) }),
        action: { href: finding.session.href, label: t('insights.openSession') },
      };
    case 'longSessions':
      return {
        icon: Hourglass,
        title: t('insights.finding.long.title', { pct: pct(finding.costShare) }),
        detail: t('insights.finding.long.detail', { pct: pct(finding.sessionShare) }),
      };
    case 'idleTime':
      return {
        icon: Coffee,
        title: t('insights.finding.idle.title', { pct: pct(finding.idleShare) }),
        detail: t('insights.finding.idle.detail'),
      };
    case 'focusWindow':
      return {
        icon: CalendarClock,
        title: t('insights.finding.focus.title', { weekday: finding.weekday, from: hourLabel(finding.from), to: hourLabel(finding.to) }),
        detail: t('insights.finding.focus.detail', { pct: pct(finding.share) }),
        action: { href: '#rhythm', label: t('insights.finding.action.rhythm') },
      };
  }
}

/* ─────────────────────────────── Charts ─────────────────────────────── */

function DailySpendChart({ data }: { data: SessionInsightPoint[] }) {
  const { currency } = useCurrency();
  const t = useT();
  return (
    <div className="h-[280px] w-full min-w-0" role="img" aria-label={t('insights.daily.title')}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
          <defs>
            <linearGradient id="insightsCostFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(var(--brand))" stopOpacity={0.2} />
              <stop offset="100%" stopColor="rgb(var(--brand))" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgb(var(--chart-grid))" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: 'rgb(var(--chart-axis))', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={28} />
          <YAxis tickFormatter={(value) => formatCurrency(Number(value), currency, { maxFrac: 0, minFrac: 0 })} tick={{ fill: 'rgb(var(--chart-axis))', fontSize: 11 }} tickLine={false} axisLine={false} width={56} />
          <Tooltip content={<DailyTooltip />} cursor={{ stroke: 'rgb(var(--border-hi))', strokeWidth: 1 }} />
          <Area type="monotone" dataKey="cost" name={t('common.cost')} stroke="rgb(var(--brand))" strokeWidth={2} fill="url(#insightsCostFill)" activeDot={{ r: 4, fill: 'rgb(var(--brand))', stroke: 'rgb(var(--bg-surface))', strokeWidth: 2 }} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function DailyTooltip(props: { active?: boolean; payload?: Array<{ payload: SessionInsightPoint }>; label?: string }) {
  const t = useT();
  const { currency } = useCurrency();
  if (!props.active || !props.payload?.length) return null;
  const point = props.payload[0].payload;
  return (
    <TooltipCard label={props.label}>
      <TooltipRow label={t('common.cost')} value={formatCurrency(point.cost, currency)} accent />
      <TooltipRow label={t('insights.chart.sessions')} value={point.sessions.toLocaleString()} />
      <TooltipRow label={t('insights.chart.requests')} value={point.requests.toLocaleString()} />
      <TooltipRow label={t('insights.kpi.activeTime')} value={point.activeMs ? formatDuration(point.activeMs) : '—'} />
    </TooltipCard>
  );
}

function TooltipCard({ label, children }: { label?: string; children: React.ReactNode }) {
  return <div className="card-elevated min-w-[180px] rounded-card border border-border-hi p-3 text-xs"><div className="mb-2 font-medium text-text-primary">{label}</div><div className="space-y-1.5">{children}</div></div>;
}

function TooltipRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return <div className="flex items-center justify-between gap-4"><span className="text-text-secondary">{label}</span><span className={cn('num-mono', accent ? 'font-medium text-text-primary' : 'text-text-primary')}>{value}</span></div>;
}

function DurationProfile({ buckets }: { buckets: SessionInsights['durationBuckets'] }) {
  const t = useT();
  const { currency } = useCurrency();
  const total = buckets.reduce((sum, bucket) => sum + bucket.cost, 0);
  const maxShare = Math.max(...buckets.map((bucket) => bucket.share), 0.0001);
  return (
    <div>
      <div className="mb-3 grid grid-cols-[56px_minmax(0,1fr)_auto] gap-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-tertiary">
        <span>{t('insights.duration.active')}</span>
        <span>{t('insights.duration.sessions')}</span>
        <span className="text-right">{t('insights.duration.spend')}</span>
      </div>
      <ul className="space-y-3">
        {buckets.map((bucket) => (
          <li key={bucket.key} className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3 text-sm">
            <span className="num-mono text-xs text-text-secondary">{bucket.label}</span>
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-bg-surface-hi">
                <span className="block h-full rounded-full bg-text-secondary/70" style={{ width: `${bucket.sessions ? Math.max(3, (bucket.share / maxShare) * 100) : 0}%` }} />
              </span>
              <span className="num-mono w-9 shrink-0 text-right text-xs text-text-primary">{bucket.sessions}</span>
            </span>
            <span className="num-mono w-[64px] text-right text-xs text-text-secondary" title={formatCurrency(bucket.cost, currency)}>{pct(total > 0 ? bucket.cost / total : 0)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 border-t border-border/70 pt-3 text-xs leading-relaxed text-text-tertiary">{t('insights.duration.note')}</p>
    </div>
  );
}

function ActivityHeatmap({ heatmap }: { heatmap: SessionInsights['heatmap'] }) {
  const t = useT();
  const [hover, setHover] = useState<{ day: number; hour: number } | null>(null);
  const step = (value: number) => {
    if (!value || !heatmap.max) return 0;
    return Math.min(HEAT_STEPS.length - 1, 1 + Math.floor((value / heatmap.max) * (HEAT_STEPS.length - 1) * 0.999));
  };
  const hovered = hover ? heatmap.cells[hover.day][hover.hour] : null;
  const dayTotals = heatmap.cells.map((row) => row.reduce((sum, value) => sum + value, 0));
  const busiestDay = dayTotals.indexOf(Math.max(...dayTotals));

  return (
    <div>
      <div className="mb-3 flex min-h-5 flex-wrap items-center justify-between gap-2 text-xs text-text-secondary" aria-live="polite">
        <span>
          {hover && hovered !== null
            ? t('insights.rhythm.cell', { weekday: heatmap.weekdays[hover.day], from: hourLabel(hover.hour), to: hourLabel(hover.hour + 1), count: hovered.toLocaleString() })
            : t('insights.rhythm.hint')}
        </span>
        <span className="inline-flex items-center gap-1.5 text-text-tertiary">
          {t('insights.rhythm.less')}
          {HEAT_STEPS.map((opacity, index) => <HeatSwatch key={index} opacity={opacity} />)}
          {t('insights.rhythm.more')}
        </span>
      </div>
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div role="table" aria-label={t('insights.rhythm.title')} className="min-w-[620px]" onMouseLeave={() => setHover(null)}>
          {heatmap.cells.map((row, day) => (
            <div role="row" key={heatmap.weekdays[day]} className="grid grid-cols-[44px_repeat(24,minmax(0,1fr))] items-center gap-[3px] py-[1.5px]">
              <span role="rowheader" className={cn('text-[11px]', day === busiestDay && dayTotals[day] > 0 ? 'font-semibold text-text-primary' : 'text-text-tertiary')}>{heatmap.weekdays[day]}</span>
              {row.map((value, hour) => (
                <span
                  role="cell"
                  key={hour}
                  aria-label={t('insights.rhythm.cell', { weekday: heatmap.weekdays[day], from: hourLabel(hour), to: hourLabel(hour + 1), count: value.toLocaleString() })}
                  onMouseEnter={() => setHover({ day, hour })}
                  className={cn('h-6 rounded-[4px] transition-[box-shadow]', hover?.day === day && hover?.hour === hour && 'ring-2 ring-text-primary/60 ring-offset-1 ring-offset-bg-surface')}
                  style={heatStyle(HEAT_STEPS[step(value)])}
                />
              ))}
            </div>
          ))}
          <div className="grid grid-cols-[44px_repeat(24,minmax(0,1fr))] gap-[3px] pt-1.5" aria-hidden>
            <span />
            {Array.from({ length: 24 }, (_, hour) => (
              <span key={hour} className="text-[10px] text-text-tertiary">{hour % 3 === 0 ? hourLabel(hour).slice(0, 2) : ''}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function heatStyle(opacity: number): React.CSSProperties {
  return opacity
    ? { background: `rgb(var(--brand) / ${opacity})` }
    : { background: 'rgb(var(--bg-surface-hi))', boxShadow: 'inset 0 0 0 1px rgb(var(--border) / 0.7)' };
}

function HeatSwatch({ opacity }: { opacity: number }) {
  return <span className="h-3 w-3 rounded-[3px]" style={heatStyle(opacity)} aria-hidden />;
}

/* ─────────────────────────────── Rankings ─────────────────────────────── */

function RankedSection({ title, desc, rows, showUnitCost }: { title: string; desc: string; rows: SessionInsightRank[]; showUnitCost?: boolean }) {
  const t = useT();
  const { currency } = useCurrency();
  const max = rows[0]?.cost || 1;
  return (
    <Section title={title} desc={desc}>
      {rows.length ? (
        <ol className="space-y-4">
          {rows.map((row) => {
            const name = <span className="min-w-0 truncate font-medium text-text-primary">{row.name}</span>;
            return (
              <li key={row.name}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                  {row.href ? <Link href={row.href} className="min-w-0 truncate hover:text-brand">{name}</Link> : name}
                  <span className="flex shrink-0 items-baseline gap-2">
                    <span className="num-mono text-text-primary">{formatCurrency(row.cost, currency)}</span>
                    <span className="num-mono w-10 text-right text-xs text-text-tertiary">{pct(row.share)}</span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-bg-surface-hi">
                  <div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${row.cost > 0 ? Math.max(3, (row.cost / max) * 100) : 0}%` }} />
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-text-tertiary">
                  <span>{row.sessions.toLocaleString()} {t('common.sessions')}</span>
                  <span>{row.requests.toLocaleString()} {t('common.requests')}</span>
                  {showUnitCost
                    ? <span>{t('insights.models.perRequest', { amount: formatCurrency(row.costPerRequest, currency, { maxFrac: 4, minFrac: 2 }) })}</span>
                    : <span>{t('insights.projects.active', { duration: formatDuration(row.activeMs) })}</span>}
                </div>
              </li>
            );
          })}
        </ol>
      ) : <p className="text-sm text-text-tertiary">{t('chart.empty.short')}</p>}
    </Section>
  );
}

function NotableSessions({ title, desc, sessions, metric }: { title: string; desc: string; sessions: SessionInsightSession[]; metric: 'duration' | 'cost' }) {
  const t = useT();
  const { currency } = useCurrency();
  return (
    <Section title={title} desc={desc}>
      <div className="divide-y divide-border/70">
        {sessions.length ? sessions.map((session, index) => (
          <Link key={`${session.source}:${session.id}`} href={session.href} className="group flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            <span className="num-mono mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-bg-surface-hi text-[11px] text-text-tertiary">{index + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-text-primary group-hover:text-brand">{session.title}</span>
              <span className="mt-1 block truncate text-xs text-text-tertiary">
                {session.project} · {session.requests.toLocaleString()} {t('common.requests')} · {metric === 'duration' ? formatCurrency(session.cost, currency) : t('insights.projects.active', { duration: formatDuration(session.activeMs) })}
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block num-mono text-sm text-text-primary">{metric === 'duration' ? formatDuration(session.activeMs) : formatCurrency(session.cost, currency)}</span>
              <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-text-tertiary group-hover:text-brand">{t('insights.openSession')}<ArrowUpRight size={12} aria-hidden /></span>
            </span>
          </Link>
        )) : <p className="text-sm text-text-tertiary">{t('chart.empty.short')}</p>}
      </div>
    </Section>
  );
}

