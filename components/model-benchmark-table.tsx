'use client';

import { ArrowDown, ArrowUp, ChevronsUpDown, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatPct, formatTokensCompact, formatCurrency, formatCurrencyPrecise } from '@/lib/utils';
import type { Locale } from '@/lib/i18n/dict';
import type { ProviderId } from '@/lib/providers/types';
import { useCurrency } from '@/lib/currency/context';
import { Section } from '@/components/section';

export interface BenchmarkRow {
  id: string;
  model: string;
  displayModel: string;
  providerId: ProviderId;
  providerLabel: string;
  logoSrc: string;
  requests: number;
  tokens: number;
  cost: number;
  averageCost: number | null;
  costPerMillion: number | null;
  cacheHit: number | null;
  inputPrice: number | null;
  outputPrice: number | null;
  priced: boolean;
}

export interface BenchmarkTableLabels {
  title: string;
  description: string;
  searchPlaceholder: string;
  allProviders: string;
  noMatches: string;
  modelsCount: string;
  model: string;
  activity: string;
  cost: string;
  observedCost: string;
  cache: string;
  rates: string;
  requests: string;
  tokens: string;
  sortBy: string;
}

type SortKey = 'requests' | 'cost' | 'costPerMillion' | 'cacheHit';

export function ModelBenchmarkTable({
  rows,
  labels,
  locale,
}: {
  rows: BenchmarkRow[];
  labels: BenchmarkTableLabels;
  locale: Locale;
}) {
  const { currency } = useCurrency();
  const [query, setQuery] = useState('');
  const [provider, setProvider] = useState<'all' | ProviderId>('all');
  const [sortKey, setSortKey] = useState<SortKey>('requests');
  const [descending, setDescending] = useState(true);

  const providerOptions = useMemo(
    () => Array.from(new Map(rows.map((row) => [row.providerId, row.providerLabel])).entries()),
    [rows],
  );

  const visibleRows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return rows
      .filter((row) => provider === 'all' || row.providerId === provider)
      .filter((row) => {
        if (!needle) return true;
        return `${row.model} ${row.displayModel} ${row.providerLabel}`.toLocaleLowerCase().includes(needle);
      })
      .sort((a, b) => {
        const aValue = sortableValue(a, sortKey);
        const bValue = sortableValue(b, sortKey);
        return (descending ? -1 : 1) * (aValue - bValue);
      });
  }, [descending, provider, query, rows, sortKey]);

  function changeSort(next: SortKey) {
    if (next === sortKey) {
      setDescending((value) => !value);
      return;
    }
    setSortKey(next);
    setDescending(true);
  }

  return (
    <Section
      title={labels.title}
      desc={labels.description}
      right={
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:max-w-full">
          <label className="relative min-w-[200px] flex-1 sm:w-[240px] sm:flex-none lg:w-[280px]">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" aria-hidden />
            <span className="sr-only">{labels.searchPlaceholder}</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={labels.searchPlaceholder}
              className="h-9 w-full rounded-button border border-border bg-bg-surface pl-9 pr-3 text-sm text-text-primary outline-none transition-colors placeholder:text-text-tertiary focus:border-brand focus:ring-2 focus:ring-brand/15"
            />
          </label>
          <select
            value={provider}
            onChange={(event) => setProvider(event.target.value as 'all' | ProviderId)}
            className="h-9 min-w-[132px] rounded-button border border-border bg-bg-surface px-3 text-sm text-text-primary outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
            aria-label={labels.allProviders}
          >
            <option value="all">{labels.allProviders}</option>
            {providerOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          <span className="ml-auto whitespace-nowrap text-xs text-text-tertiary">{labels.modelsCount.replace('{count}', String(visibleRows.length))}</span>
        </div>
      }
    >
      <div className="mt-4 overflow-x-auto rounded-button border border-border">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-bg-surface-hi/50 text-left text-xs text-text-tertiary">
            <tr>
              <th className="px-4 py-3 font-medium">{labels.model}</th>
              <SortableHeader label={labels.activity} sortKey="requests" active={sortKey} descending={descending} onSort={changeSort} />
              <SortableHeader label={labels.cost} sortKey="cost" active={sortKey} descending={descending} onSort={changeSort} />
              <SortableHeader label={labels.observedCost} sortKey="costPerMillion" active={sortKey} descending={descending} onSort={changeSort} />
              <SortableHeader label={labels.cache} sortKey="cacheHit" active={sortKey} descending={descending} onSort={changeSort} />
              <th className="px-4 py-3 text-right font-medium">{labels.rates}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visibleRows.map((row, index) => (
              <tr key={row.id} className="align-top transition-colors hover:bg-bg-surface-hi/40">
                <td className="max-w-[300px] px-4 py-3">
                  <div className="flex items-start gap-2.5">
                    <span className="num-mono mt-0.5 w-5 shrink-0 text-xs text-text-tertiary">{index + 1}</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={row.logoSrc} alt="" aria-hidden className="mt-0.5 h-5 w-5 shrink-0 rounded-[4px] object-contain" />
                    <div className="min-w-0">
                      <div className="truncate font-medium text-text-primary">{row.displayModel}</div>
                      <div className="truncate text-xs text-text-tertiary">{row.providerLabel} · {row.model}</div>
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <div className="num-mono text-text-primary">{row.requests.toLocaleString()}</div>
                  <div className="mt-0.5 text-xs text-text-tertiary">{labels.requests} · {formatTokensCompact(row.tokens, locale)} {labels.tokens}</div>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <div className="num-mono text-text-primary">{formatCurrency(row.cost, currency)}</div>
                  <div className="mt-0.5 text-xs text-text-tertiary">{row.averageCost == null ? '—' : `${formatCurrencyPrecise(row.averageCost, currency)} / ${labels.requests.toLowerCase()}`}</div>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <div className="num-mono text-text-primary">{row.costPerMillion == null ? '—' : formatCurrencyPrecise(row.costPerMillion, currency)}</div>
                  <div className="mt-0.5 text-xs text-text-tertiary">{labels.observedCost}</div>
                </td>
                <td className="w-[150px] px-4 py-3">
                  {row.cacheHit == null ? (
                    <span className="text-text-tertiary">—</span>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="num-mono text-text-primary">{formatPct(row.cacheHit, 0)}</span>
                        <span className="text-text-tertiary">{labels.cache}</span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg-surface-hi">
                        <div className="h-full rounded-full bg-success" style={{ width: `${Math.max(0, Math.min(1, row.cacheHit)) * 100}%` }} />
                      </div>
                    </>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  {row.priced ? (
                    <div className="num-mono text-xs text-text-secondary">
                      <div>in {row.inputPrice == null ? '—' : formatCurrencyPrecise(row.inputPrice, currency)}</div>
                      <div className="mt-0.5">out {row.outputPrice == null ? '—' : formatCurrencyPrecise(row.outputPrice, currency)}</div>
                    </div>
                  ) : (
                    <span className="pill-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-text-tertiary">{labels.noMatches}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function SortableHeader({
  label,
  sortKey,
  active,
  descending,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  active: SortKey;
  descending: boolean;
  onSort: (key: SortKey) => void;
}) {
  const selected = active === sortKey;
  const Icon = selected ? (descending ? ArrowDown : ArrowUp) : ChevronsUpDown;
  return (
    <th className="px-4 py-3 text-right font-medium" aria-sort={selected ? (descending ? 'descending' : 'ascending') : 'none'}>
      <button type="button" onClick={() => onSort(sortKey)} className="inline-flex items-center gap-1.5 text-right hover:text-text-primary" aria-label={`Sort by ${label}`}>
        {label}
        <Icon size={13} aria-hidden />
      </button>
    </th>
  );
}

function sortableValue(row: BenchmarkRow, key: SortKey): number {
  const value = row[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : -1;
}
