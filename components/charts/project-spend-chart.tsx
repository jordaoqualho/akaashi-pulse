import Link from 'next/link';
import { formatCurrency, formatDuration, formatPct } from '@/lib/utils';
import type { DisplayCurrency } from '@/lib/currency';

export interface ProjectSpendDatum {
  name: string;
  cost: number;
  durationMs: number;
  sessions: number;
  requests: number;
  /** The fixed monthly subscription allocation for the current month. */
  actualCost?: number;
  href?: string;
}

interface ProjectSpendChartProps {
  data: ProjectSpendDatum[];
  costTitle: string;
  timeTitle: string;
  rateLabel: string;
  emptyLabel: string;
  sessionsLabel: string;
  requestsLabel: string;
  currency?: DisplayCurrency;
  maxRows?: number;
  actualCostTitle?: string;
  actualCostTotal?: number;
  actualCostCurrency?: DisplayCurrency;
  actualCostUnavailableLabel?: string;
  actualShareLabel?: string;
}

export function ProjectSpendChart({
  data,
  costTitle,
  timeTitle,
  rateLabel,
  emptyLabel,
  sessionsLabel,
  requestsLabel,
  currency = 'USD',
  maxRows = 6,
  actualCostTitle,
  actualCostTotal,
  actualCostCurrency = 'USD',
  actualCostUnavailableLabel = 'Not configured',
  actualShareLabel = 'real share',
}: ProjectSpendChartProps) {
  if (!data.length) {
    return <div className="flex min-h-56 items-center justify-center text-sm text-text-tertiary">{emptyLabel}</div>;
  }

  const rows = data.slice(0, maxRows);
  const totalCost = data.reduce((sum, item) => sum + item.cost, 0);
  const totalDuration = data.reduce((sum, item) => sum + item.durationMs, 0);
  const maxCost = Math.max(...rows.map((item) => item.cost), 0.0001);
  const maxActualCost = Math.max(...rows.map((item) => item.actualCost ?? 0), 0.0001);
  const maxDuration = Math.max(...rows.map((item) => item.durationMs), 1);

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <MetricColumn
        title={costTitle}
        rows={rows}
        total={totalCost}
        max={maxCost}
        value={(item) => formatCurrency(item.cost, currency)}
        share={(item) => (totalCost > 0 ? formatPct(item.cost / totalCost) : '0%')}
        fill="var(--red)"
        barLabel={(item) => `${formatCurrency(item.cost, currency)} · ${formatPct(totalCost > 0 ? item.cost / totalCost : 0)}`}
        isTime={false}
        rateLabel={rateLabel}
        sessionsLabel={sessionsLabel}
        requestsLabel={requestsLabel}
        actualCostTitle={actualCostTitle}
        actualCostTotal={actualCostTotal}
        actualCostCurrency={actualCostCurrency ?? currency}
        currency={currency}
        actualCostUnavailableLabel={actualCostUnavailableLabel}
        actualShareLabel={actualShareLabel}
        actualMax={maxActualCost}
      />
      <MetricColumn
        title={timeTitle}
        rows={[...rows].sort((a, b) => b.durationMs - a.durationMs)}
        total={totalDuration}
        max={maxDuration}
        value={(item) => formatDuration(item.durationMs)}
        share={(item) => (totalDuration > 0 ? formatPct(item.durationMs / totalDuration) : '0%')}
        fill="rgb(var(--chart-input))"
        barLabel={(item) => `${formatDuration(item.durationMs)} · ${formatRate(item.cost, item.durationMs, rateLabel, currency)}`}
        isTime
        rateLabel={rateLabel}
        sessionsLabel={sessionsLabel}
        requestsLabel={requestsLabel}
        currency={currency}
      />
    </div>
  );
}

function MetricColumn({
  title,
  rows,
  total,
  max,
  value,
  share,
  fill,
  barLabel,
  isTime,
  rateLabel,
  sessionsLabel,
  requestsLabel,
  actualCostTitle,
  actualCostTotal,
  actualCostCurrency = 'USD',
  actualCostUnavailableLabel = 'Not configured',
  actualShareLabel = 'real share',
  actualMax,
  currency,
}: {
  title: string;
  rows: ProjectSpendDatum[];
  total: number;
  max: number;
  value: (item: ProjectSpendDatum) => string;
  share: (item: ProjectSpendDatum) => string;
  fill: string;
  barLabel: (item: ProjectSpendDatum) => string;
  isTime: boolean;
  rateLabel: string;
  sessionsLabel: string;
  requestsLabel: string;
  actualCostTitle?: string;
  actualCostTotal?: number;
  actualCostCurrency?: DisplayCurrency;
  actualCostUnavailableLabel?: string;
  actualShareLabel?: string;
  actualMax?: number;
  currency: DisplayCurrency;
}) {
  const hasActualCost = !isTime && Boolean(actualCostTitle);
  const hasActualValues = hasActualCost && (actualCostTotal ?? 0) > 0;
  const resolvedActualMax = actualMax ?? 0.0001;
  const formatActualCost = (value: number) => formatCurrency(value, actualCostCurrency);

  return (
    <div className="rounded-card border border-border bg-bg-surface p-4 sm:p-5">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="label">{title}</div>
        <div className="text-right">
          <div className="num-mono text-xs text-text-secondary">
    {isTime ? formatDuration(total) : formatCurrency(total, currency)}
          </div>
          {hasActualCost && (
            <div className="num-mono mt-0.5 text-[11px] text-brand">
              {actualCostTotal && actualCostTotal > 0
                ? formatActualCost(actualCostTotal)
                : actualCostUnavailableLabel}
            </div>
          )}
        </div>
      </div>
      {hasActualCost && (
        <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-text-tertiary">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-red" aria-hidden />
            {title}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />
            {actualCostTitle}
          </span>
        </div>
      )}
      <div className="space-y-4">
        {rows.map((item, index) => {
          const amount = isTime ? item.durationMs : item.cost;
          const width = Math.max(3, (amount / max) * 100);
          const actualAmount = item.actualCost ?? 0;
          const actualWidth = Math.max(3, (actualAmount / resolvedActualMax) * 100);
          const content = (
            <>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-medium text-text-primary" title={item.name}>
                  <span className="mr-2 text-[11px] text-text-tertiary">{String(index + 1).padStart(2, '0')}</span>
                  {item.name}
                </span>
                <span className="flex shrink-0 items-baseline gap-2 text-right num-mono text-xs">
                  <span className="text-text-secondary">{value(item)}</span>
                  {hasActualCost && (
                    <span className="text-brand" title={actualCostTitle}>
                      {actualAmount > 0 ? formatActualCost(actualAmount) : '—'}
                    </span>
                  )}
                </span>
              </div>
              <div className="space-y-1" aria-label={`${item.name}: ${barLabel(item)}`}>
                <div
                  className="h-2 overflow-hidden rounded-full bg-bg-surface"
                  role="img"
                  aria-label={`${item.name}: ${barLabel(item)}`}
                >
                  <div
                    className="bar-grow h-full rounded-full transition-[filter] duration-150 group-hover:brightness-110 group-focus-visible:brightness-110"
                    style={{ width: `${width}%`, background: fill }}
                  />
                </div>
                {hasActualValues && (
                  <div className="h-1.5 overflow-hidden rounded-full bg-bg-surface-hi" role="img" aria-label={`${item.name}: ${actualCostTitle}`}>
                    <div
                      className="bar-grow h-full rounded-full bg-brand transition-[filter] duration-150 group-hover:brightness-110 group-focus-visible:brightness-110"
                      style={{ width: `${actualWidth}%` }}
                    />
                  </div>
                )}
              </div>
              <div className="flex justify-between gap-3 text-[11px] text-text-tertiary">
                <span>
                  {isTime
                    ? formatRate(item.cost, item.durationMs, rateLabel, currency)
                    : `${item.sessions} ${sessionsLabel} · ${item.requests} ${requestsLabel}`}
                </span>
                <span className="flex gap-2 num-mono">
                  <span>{share(item)}</span>
                  {hasActualValues && actualCostTotal && (
                    <span className="text-brand" title={actualShareLabel}>
                      {formatPct(actualAmount / actualCostTotal)}
                    </span>
                  )}
                </span>
              </div>
            </>
          );
          const rowClassName = "group -mx-2 space-y-1.5 rounded-button px-2 py-1.5 transition-colors hover:bg-bg-surface-hi/45 focus-visible:bg-bg-surface-hi/45 focus-visible:outline-none";
          return item.href ? (
            <Link
              key={`${item.name}:${index}`}
              href={item.href}
              className={`block ${rowClassName}`}
              aria-label={`${item.name}: ${barLabel(item)}`}
            >
              {content}
            </Link>
          ) : (
            <div
              key={`${item.name}:${index}`}
              className={rowClassName}
              tabIndex={0}
              role="group"
              aria-label={`${item.name}: ${barLabel(item)}`}
            >
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatRate(cost: number, durationMs: number, label: string, currency: DisplayCurrency): string {
  const hours = durationMs / 3_600_000;
  const rate = hours > 0 ? cost / hours : 0;
  return `${label} ${formatCurrency(rate, currency, { minFrac: 3, maxFrac: 3 })}/h`;
}
