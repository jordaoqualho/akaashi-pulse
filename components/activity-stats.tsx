'use client';

import { useState, useMemo, useCallback } from 'react';
import { cn, formatTokensCompact } from '@/lib/utils';
import { Section } from '@/components/section';
import type { ActivityStats, TokenComparison } from '@/lib/aggregator/activity';
import type { Locale } from '@/lib/i18n/dict';
import { tFn } from '@/lib/i18n/dict';

interface Props {
  stats: ActivityStats;
  comparison: TokenComparison | null;
  locale: Locale;
  className?: string;
}

export function ActivityStatsSection({ stats, comparison, locale, className }: Props) {
  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => tFn(locale, key, vars),
    [locale],
  );

  const tiles: Array<{ label: string; value: string }> = [
    { label: t('activity.activeDays'), value: stats.activeDays.toLocaleString() },
    {
      label: t('activity.streakCombinedLabel'),
      value: t('activity.streakCombinedValue', {
        current: stats.currentStreak,
        longest: stats.longestStreak,
      }),
    },
    {
      label: t('activity.peakHour'),
      value: stats.peakHour < 0 ? 'Not available' : formatHour(stats.peakHour, locale),
    },
  ];

  return (
    <Section
      title={t('activity.title')}
      desc={t('activity.subtitle')}
      inlineDesc
      fillBody
      className={className}
    >
      <div className="flex flex-col md:flex-row gap-5 md:gap-8 items-stretch flex-1">
        <div className="grid grid-cols-3 md:flex md:flex-col md:w-[170px] md:shrink-0 gap-2.5">
          {tiles.map((tile) => (
            <Tile key={tile.label} label={tile.label} value={tile.value} />
          ))}
        </div>

        <div className="flex-1 min-w-0 flex flex-col">
          <Heatmap
            data={stats.heatmap}
            tokens={stats.tokenHeatmap}
            max={stats.heatmapMax}
            locale={locale}
          />
          {comparison && (
            <div className="mt-auto pt-4 text-xs text-text-tertiary leading-relaxed">
              {t('activity.comparison', {
                multiplier: formatMultiplier(comparison.multiplier),
                ref: t(`activity.ref.${comparison.refKey}`),
              })}
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-button border border-border bg-bg-surface-hi px-3.5 py-3 flex-1 flex flex-col justify-center min-h-[64px]">
      <div className="text-[11px] uppercase tracking-[0.06em] text-text-tertiary font-semibold truncate">
        {label}
      </div>
      <div className="num-mono text-xl font-semibold text-text-primary mt-1 leading-none truncate">
        {value}
      </div>
    </div>
  );
}

interface HoverInfo {
  dow: number;
  hour: number | null;
  count: number;
  tokens: number;
  rect: { left: number; top: number; width: number; height: number };
}

function Heatmap({
  data,
  tokens,
  max,
  locale,
}: {
  data: number[][];
  tokens: number[][];
  max: number;
  locale: Locale;
}) {
  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => tFn(locale, key, vars),
    [locale],
  );
  const HOUR_LABELS = [0, 3, 6, 9, 12, 15, 18, 21];
  const [hover, setHover] = useState<HoverInfo | null>(null);

  const totals = useMemo(() => {
    let m = 0;
    let toks = 0;
    let maxTokens = 0;
    for (const row of data) for (const v of row) m += v;
    for (const row of tokens)
      for (const v of row) {
        toks += v;
        if (v > maxTokens) maxTokens = v;
      }
    return { messages: m, tokens: toks, maxTokens };
  }, [data, tokens]);

  function onCellHover(
    e: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>,
    dow: number,
    hour: number,
  ) {
    const r = e.currentTarget.getBoundingClientRect();
    setHover({
      dow,
      hour,
      count: data[dow][hour],
      tokens: tokens[dow][hour],
      rect: { left: r.left, top: r.top, width: r.width, height: r.height },
    });
  }

  function onDayHover(
    e: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>,
    dow: number,
  ) {
    const r = e.currentTarget.getBoundingClientRect();
    setHover({
      dow,
      hour: null,
      count: data[dow].reduce((sum, value) => sum + value, 0),
      tokens: tokens[dow].reduce((sum, value) => sum + value, 0),
      rect: { left: r.left, top: r.top, width: r.width, height: r.height },
    });
  }

  return (
    <div className="w-full">
      <div className="grid gap-y-[3px] [grid-template-columns:auto_1fr] items-center">
        {data.map((row, dow) => (
          <DayRow
            key={dow}
            dow={dow}
            row={row}
            max={max}
            t={t}
            locale={locale}
            onCellHover={onCellHover}
            onDayHover={onDayHover}
            onLeave={() => setHover(null)}
          />
        ))}
        <div className="text-[10px] text-text-tertiary opacity-0 select-none pr-2">.</div>
        <div className="grid [grid-template-columns:repeat(24,minmax(0,1fr))] text-[10px] text-text-tertiary tabular-nums gap-[3px] mt-1">
          {Array.from({ length: 24 }).map((_, h) => (
            <div key={h} className="text-center leading-none">
              {HOUR_LABELS.includes(h) ? formatHourShort(h, locale) : ''}
            </div>
          ))}
        </div>
      </div>

      {hover && (
        <HeatmapTooltip
          hover={hover}
          locale={locale}
          totalMessages={totals.messages}
          totalTokens={totals.tokens}
          maxCount={max}
          maxTokens={totals.maxTokens}
          t={t}
        />
      )}
    </div>
  );
}

function DayRow({
  dow,
  row,
  max,
  t,
  locale,
  onCellHover,
  onDayHover,
  onLeave,
}: {
  dow: number;
  row: number[];
  max: number;
  t: (k: string, vars?: Record<string, string | number>) => string;
  locale: Locale;
  onCellHover: (e: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>, dow: number, hour: number) => void;
  onDayHover: (e: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>, dow: number) => void;
  onLeave: () => void;
}) {
  const label = t(`activity.dow.${dow}`);
  const dayCount = row.reduce((sum, value) => sum + value, 0);
  return (
    <>
      <button
        type="button"
        className="m-0 border-0 bg-transparent p-0 pr-2.5 text-left text-[11px] leading-none text-text-tertiary tabular-nums whitespace-nowrap hover:text-text-primary focus-visible:relative focus-visible:z-10 focus-visible:rounded focus-visible:text-text-primary"
        onMouseEnter={(e) => onDayHover(e, dow)}
        onFocus={(e) => onDayHover(e, dow)}
        onMouseLeave={onLeave}
        onBlur={onLeave}
        aria-label={t('activity.heatmap.dayTooltip', { dow: label, count: dayCount })}
      >
        {label}
      </button>
      <div
        className="grid [grid-template-columns:repeat(24,minmax(0,1fr))] gap-[3px]"
        onMouseLeave={onLeave}
      >
        {row.map((count, hour) => (
          <Cell
            key={hour}
            count={count}
            max={max}
            ariaLabel={t('activity.heatmap.tooltip', {
              dow: label,
              hour: formatHourRange(hour, locale),
              count,
            })}
            onHover={(e) => onCellHover(e, dow, hour)}
            onLeave={onLeave}
          />
        ))}
      </div>
    </>
  );
}

function Cell({
  count,
  max,
  ariaLabel,
  onHover,
  onLeave,
}: {
  count: number;
  max: number;
  ariaLabel: string;
  onHover: (e: React.MouseEvent<HTMLButtonElement> | React.FocusEvent<HTMLButtonElement>) => void;
  onLeave: () => void;
}) {
  const intensity = max > 0 && count > 0 ? Math.sqrt(count / max) : 0;
  const style: React.CSSProperties = count
    ? { backgroundColor: `rgb(var(--brand) / ${(0.18 + intensity * 0.82).toFixed(2)})` }
    : {};
  return (
    <button
      type="button"
      onMouseEnter={onHover}
      onFocus={onHover}
      onBlur={onLeave}
      aria-label={ariaLabel}
      className={cn(
        'relative block aspect-square w-full appearance-none rounded-[3px] border-0 p-0 transition-transform duration-100',
        'hover:z-10 hover:scale-125 hover:ring-1 hover:ring-brand/60 focus-visible:z-10 focus-visible:scale-125 focus-visible:ring-1 focus-visible:ring-brand',
        !count && 'bg-bg-surface-hi',
      )}
      style={style}
    />
  );
}

function HeatmapTooltip({
  hover,
  locale,
  totalMessages,
  totalTokens,
  maxCount,
  maxTokens,
  t,
}: {
  hover: HoverInfo;
  locale: Locale;
  totalMessages: number;
  totalTokens: number;
  maxCount: number;
  maxTokens: number;
  t: (k: string, vars?: Record<string, string | number>) => string;
}) {
  const cellCenter = hover.rect.left + hover.rect.width / 2;
  const isDay = hover.hour === null;

  const TOOLTIP_VERTICAL_BUFFER_PX = 96;
  const flipBelow = !isDay && hover.rect.top < TOOLTIP_VERTICAL_BUFFER_PX;
  const top = isDay
    ? hover.rect.top + hover.rect.height / 2
    : flipBelow
      ? hover.rect.top + hover.rect.height + 8
      : hover.rect.top - 8;
  const left = isDay ? hover.rect.left + hover.rect.width + 8 : cellCenter;
  const transform = isDay ? 'translateY(-50%)' : `translate(-50%, ${flipBelow ? '0%' : '-100%'})`;
  const dowLabel = t(`activity.dow.${hover.dow}`);
  const sharePct = totalMessages > 0 ? (hover.count / totalMessages) * 100 : 0;
  const intensityPct = maxCount > 0 ? (hover.count / maxCount) * 100 : 0;
  const tokenSharePct = totalTokens > 0 ? (hover.tokens / totalTokens) * 100 : 0;
  const tokenPeakPct = maxTokens > 0 ? (hover.tokens / maxTokens) * 100 : 0;
  const hourRange = hover.hour === null ? null : formatHourRange(hover.hour, locale);

  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-50"
      style={{ left, top, transform }}
    >
      <div className="card-elevated rounded-button px-3 py-2 text-xs whitespace-nowrap shadow-xl border border-border-hi bg-bg-elevated min-w-[180px]">
        <div className="font-semibold text-text-primary mb-1">
          {dowLabel}  ·  {hourRange ?? t('activity.heatmap.dayTotal')}
        </div>
        {hover.hour === null ? (
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-text-secondary tabular-nums">
            <span className="text-text-tertiary">{t('activity.heatmap.messages')}</span>
            <span className="text-right">{hover.count.toLocaleString()}</span>
            <span className="text-text-tertiary">{t('activity.heatmap.tokens')}</span>
            <span className="text-right">{formatTokensCompact(hover.tokens, locale)}</span>
            <span></span>
            <span className="pt-1 text-right text-[10px] text-text-tertiary">
              {sharePct.toFixed(1)}% {t('activity.heatmap.shareLabel').toLowerCase()}
            </span>
          </div>
        ) : hover.count > 0 ? (
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-text-secondary tabular-nums">
            <span className="text-text-tertiary">{t('activity.heatmap.messages')}</span>
            <span className="text-right">
              {hover.count.toLocaleString()}
              <span className="text-text-tertiary ml-1.5">
                ·{' '}
                <span title={t('activity.heatmap.shareLabel')}>{sharePct.toFixed(1)}%</span>
                {' / '}
                <span title={t('activity.heatmap.intensityLabel')}>
                  {intensityPct.toFixed(0)}%
                </span>
              </span>
            </span>
            <span className="text-text-tertiary">{t('activity.heatmap.tokens')}</span>
            <span className="text-right">
              {formatTokensCompact(hover.tokens, locale)}
              <span className="text-text-tertiary ml-1.5">
                ·{' '}
                <span title={t('activity.heatmap.shareLabel')}>
                  {tokenSharePct.toFixed(1)}%
                </span>
                {' / '}
                <span title={t('activity.heatmap.intensityLabel')}>
                  {tokenPeakPct.toFixed(0)}%
                </span>
              </span>
            </span>
            <span></span>
            <span className="text-[10px] text-text-tertiary text-right pt-1 leading-none">
              {t('activity.heatmap.shareLabel')} / {t('activity.heatmap.intensityLabel')}
            </span>
          </div>
        ) : (
          <div className="text-text-tertiary">{t('activity.heatmap.empty')}</div>
        )}
      </div>
    </div>
  );
}

function formatHour(h: number, locale: Locale): string {
  if (locale === 'zh') return `${h}:00`;
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

function formatHourShort(h: number, locale: Locale): string {
  if (locale === 'zh') return `${h}`;
  if (h === 0) return '12a';
  if (h < 12) return `${h}a`;
  if (h === 12) return '12p';
  return `${h - 12}p`;
}

function formatHourRange(h: number, locale: Locale): string {
  const next = (h + 1) % 24;
  if (locale === 'zh')
    return `${h.toString().padStart(2, '0')}:00 - ${next.toString().padStart(2, '0')}:00`;
  return `${formatHour(h, locale)} - ${formatHour(next, locale)}`;
}

function formatMultiplier(m: number): string {
  if (m < 10) return m.toFixed(1);
  if (m < 1000) return Math.round(m).toString();
  if (m < 1_000_000) return (m / 1000).toFixed(1) + 'K';
  return (m / 1_000_000).toFixed(1) + 'M';
}
