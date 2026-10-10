'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatUSD } from '@/lib/utils';
import { useT } from '@/lib/i18n/context';

export interface CostLineDatum {
  label: string;
  cost: number;
  saved: number;
  requests?: number;
}

export function CostLineChart({ data }: { data: CostLineDatum[] }) {
  const t = useT();
  if (!data.length) {
    return (
      <div className="h-64 flex items-center justify-center text-text-tertiary text-sm">
        {t('chart.empty.short')}
      </div>
    );
  }
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
          <CartesianGrid stroke="rgb(var(--chart-grid))" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: 'rgb(var(--chart-axis))', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: 'rgb(var(--chart-grid))' }}
            interval="preserveStartEnd"
            minTickGap={32}
          />
          <YAxis
            tickFormatter={(v) => `$${Number(v).toFixed(0)}`}
            tick={{ fill: 'rgb(var(--chart-axis))', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: 'rgb(var(--chart-grid))' }}
            width={56}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload || !payload.length) return null;
              const d = payload[0].payload as CostLineDatum;
              return (
                <div className="card-elevated border border-border-hi p-3 text-xs">
                  <div className="font-medium text-text-primary mb-2">{label}</div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-text-secondary">{t('chart.tooltip.cost')}</span>
                    <span className="num-mono text-brand">{formatUSD(d.cost)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 mt-1">
                    <span className="text-text-secondary">{t('common.savedViaCache', { amount: '' }).trim()}</span>
                    <span className="num-mono text-success">{formatUSD(d.saved)}</span>
                  </div>
                  {typeof d.requests === 'number' && (
                    <div className="mt-1 flex items-center justify-between gap-4">
                      <span className="text-text-secondary">{t('chart.tooltip.requests')}</span>
                      <span className="num-mono text-text-primary">{d.requests}</span>
                    </div>
                  )}
                </div>
              );
            }}
            cursor={{ stroke: 'rgb(var(--border-hi))', strokeWidth: 1 }}
          />
          <Area
            type="monotone"
            dataKey="cost"
            stroke="rgb(var(--brand))"
            strokeWidth={2.5}
            fill="rgb(var(--brand) / 0.10)"
            activeDot={{ r: 5, strokeWidth: 2, stroke: 'rgb(var(--brand))', fill: 'rgb(var(--bg-surface))' }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="saved"
            stroke="rgb(var(--chart-input))"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: 'rgb(var(--chart-input))', fill: 'rgb(var(--bg-surface))' }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
