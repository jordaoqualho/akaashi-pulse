import { formatDuration, formatPct, formatUSD } from '@/lib/utils';

export interface ProjectSpendDatum {
  name: string;
  cost: number;
  durationMs: number;
  sessions: number;
  requests: number;
}

interface ProjectSpendChartProps {
  data: ProjectSpendDatum[];
  costTitle: string;
  timeTitle: string;
  rateLabel: string;
  emptyLabel: string;
  sessionsLabel: string;
  requestsLabel: string;
  maxRows?: number;
}

export function ProjectSpendChart({
  data,
  costTitle,
  timeTitle,
  rateLabel,
  emptyLabel,
  sessionsLabel,
  requestsLabel,
  maxRows = 6,
}: ProjectSpendChartProps) {
  if (!data.length) {
    return <div className="flex min-h-56 items-center justify-center text-sm text-text-tertiary">{emptyLabel}</div>;
  }

  const rows = data.slice(0, maxRows);
  const totalCost = data.reduce((sum, item) => sum + item.cost, 0);
  const totalDuration = data.reduce((sum, item) => sum + item.durationMs, 0);
  const maxCost = Math.max(...rows.map((item) => item.cost), 0.0001);
  const maxDuration = Math.max(...rows.map((item) => item.durationMs), 1);

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <MetricColumn
        title={costTitle}
        rows={rows}
        total={totalCost}
        max={maxCost}
        value={(item) => formatUSD(item.cost)}
        share={(item) => (totalCost > 0 ? formatPct(item.cost / totalCost) : '0%')}
        fill="var(--red)"
        barLabel={(item) => `${formatUSD(item.cost)} · ${formatPct(totalCost > 0 ? item.cost / totalCost : 0)}`}
        isTime={false}
        rateLabel={rateLabel}
        sessionsLabel={sessionsLabel}
        requestsLabel={requestsLabel}
      />
      <MetricColumn
        title={timeTitle}
        rows={[...rows].sort((a, b) => b.durationMs - a.durationMs)}
        total={totalDuration}
        max={maxDuration}
        value={(item) => formatDuration(item.durationMs)}
        share={(item) => (totalDuration > 0 ? formatPct(item.durationMs / totalDuration) : '0%')}
        fill="rgb(var(--chart-input))"
        barLabel={(item) => `${formatDuration(item.durationMs)} · ${formatRate(item.cost, item.durationMs, rateLabel)}`}
        isTime
        rateLabel={rateLabel}
        sessionsLabel={sessionsLabel}
        requestsLabel={requestsLabel}
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
}) {
  return (
    <div className="rounded-card border border-border bg-bg-surface p-4 sm:p-5">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="label">{title}</div>
        <div className="num-mono text-xs text-text-tertiary">
          {isTime ? formatDuration(total) : formatUSD(total)}
        </div>
      </div>
      <div className="space-y-4">
        {rows.map((item, index) => {
          const amount = isTime ? item.durationMs : item.cost;
          const width = Math.max(3, (amount / max) * 100);
          return (
            <div
              key={`${item.name}:${index}`}
              className="group space-y-1.5 rounded-button px-2 py-1.5 -mx-2 transition-colors hover:bg-bg-surface-hi/45 focus-visible:bg-bg-surface-hi/45"
              tabIndex={0}
              role="group"
              aria-label={`${item.name}: ${barLabel(item)}`}
            >
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-medium text-text-primary" title={item.name}>
                  <span className="mr-2 text-[11px] text-text-tertiary">{String(index + 1).padStart(2, '0')}</span>
                  {item.name}
                </span>
                <span className="num-mono shrink-0 text-xs text-text-secondary">{value(item)}</span>
              </div>
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
              <div className="flex justify-between gap-3 text-[11px] text-text-tertiary">
                <span>
                  {isTime
                    ? formatRate(item.cost, item.durationMs, rateLabel)
                    : `${item.sessions} ${sessionsLabel} · ${item.requests} ${requestsLabel}`}
                </span>
                <span className="num-mono">{share(item)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatRate(cost: number, durationMs: number, label: string): string {
  const hours = durationMs / 3_600_000;
  const rate = hours > 0 ? cost / hours : 0;
  return `${label} ${formatUSD(rate, { minFrac: 3, maxFrac: 3 })}/h`;
}
