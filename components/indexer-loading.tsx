'use client';

import { Check, Database, FileSearch, Gauge, Loader2, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PageShell } from '@/components/section';
import { useT } from '@/lib/i18n/context';

type IndexerPhase = 'idle' | 'discovering' | 'scanning' | 'building-snapshot' | 'ready' | 'error';

interface IndexerStatus {
  initialized: boolean;
  isIndexing: boolean;
  phase: IndexerPhase;
  filesIndexed: number;
  recordsIndexed: number;
  filesDiscovered: number;
  filesProcessed: number;
  cacheHits: number;
  scanTotal: number;
}

const INITIAL_STATUS: IndexerStatus = {
  initialized: false,
  isIndexing: true,
  phase: 'discovering',
  filesIndexed: 0,
  recordsIndexed: 0,
  filesDiscovered: 0,
  filesProcessed: 0,
  cacheHits: 0,
  scanTotal: 0,
};

const PHASES: IndexerPhase[] = ['discovering', 'scanning', 'building-snapshot'];

export function IndexerLoading() {
  const t = useT();
  const [status, setStatus] = useState<IndexerStatus>(INITIAL_STATUS);
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(startedAt);

  useEffect(() => {
    let cancelled = false;

    const readStatus = async () => {
      try {
        const response = await fetch('/api/indexer/status', { cache: 'no-store' });
        if (!response.ok) return;
        const payload = (await response.json()) as { indexer?: IndexerStatus };
        if (!cancelled && payload.indexer) setStatus(payload.indexer);
      } catch {
        // The status endpoint may compile at the same time as the page on a
        // cold dev server. Keep the useful local progress shell visible.
      }
    };

    void readStatus();
    const poll = window.setInterval(() => void readStatus(), 500);
    const clock = window.setInterval(() => setNow(Date.now()), 250);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
      window.clearInterval(clock);
    };
  }, []);

  const meta = useMemo(() => {
    switch (status.phase) {
      case 'discovering':
        return { title: t('overview.loading.phase.discovering'), detail: t('overview.loading.phase.discoveringDetail'), icon: FileSearch };
      case 'scanning':
        return { title: t('overview.loading.phase.scanning'), detail: t('overview.loading.phase.scanningDetail'), icon: Database };
      case 'building-snapshot':
        return { title: t('overview.loading.phase.building'), detail: t('overview.loading.phase.buildingDetail'), icon: Gauge };
      case 'error':
        return { title: t('overview.loading.phase.error'), detail: t('overview.loading.phase.errorDetail'), icon: TriangleAlert };
      default:
        return { title: t('overview.loading.phase.waiting'), detail: t('overview.loading.phase.waitingDetail'), icon: Loader2 };
    }
  }, [status.phase, t]);

  const Icon = meta.icon;
  const scanProgress = status.scanTotal > 0
    ? Math.min(100, Math.round((status.filesProcessed / status.scanTotal) * 100))
    : status.phase === 'building-snapshot'
      ? 92
      : status.phase === 'scanning'
        ? 18
        : 6;
  const elapsed = formatElapsed(now - startedAt);

  return (
    <PageShell title={t('overview.title')} desc={t('overview.loading.desc')}>
      <div className="panel overflow-hidden">
        <div className="border-b border-border bg-bg-surface-hi/30 px-5 py-5 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brand/20 bg-brand/10 text-brand">
              {status.phase === 'error' ? <TriangleAlert size={17} aria-hidden /> : <Icon size={17} className={status.phase === 'building-snapshot' ? 'animate-pulse' : 'animate-spin'} aria-hidden />}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-text-primary">{meta.title}</div>
              <p className="mt-1 text-xs leading-relaxed text-text-secondary">{meta.detail}</p>
            </div>
            <span className="ml-auto shrink-0 rounded-full border border-border bg-bg-surface px-2 py-1 font-mono text-[11px] text-text-tertiary">
              {elapsed}
            </span>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between gap-3 text-[11px] text-text-tertiary">
              <span>{t('overview.loading.progress')}</span>
              <span className="font-mono tabular-nums">{scanProgress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-bg-surface-hi">
              <div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${scanProgress}%` }} />
            </div>
          </div>
        </div>

        <div className="grid gap-3 p-5 sm:grid-cols-3 sm:p-6">
          <LoadingStat label={t('overview.loading.files')} value={status.scanTotal ? `${status.filesProcessed} / ${status.scanTotal}` : '—'} />
          <LoadingStat label={t('overview.loading.cache')} value={status.cacheHits > 0 ? `${status.cacheHits} ${t('overview.loading.reused')}` : '—'} />
          <LoadingStat label={t('overview.loading.records')} value={status.recordsIndexed.toLocaleString()} />
        </div>

        <div className="border-t border-border px-5 py-4 sm:px-6">
          <div className="grid gap-3 sm:grid-cols-3">
            {PHASES.map((phase, index) => {
              const currentIndex = PHASES.indexOf(status.phase);
              const complete = status.phase === 'ready' || currentIndex > index;
              const active = status.phase === phase;
              return (
                <div key={phase} className="flex items-center gap-2 text-xs">
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${complete ? 'border-success/30 bg-success/10 text-success' : active ? 'border-brand/30 bg-brand/10 text-brand' : 'border-border bg-bg-surface-hi text-text-tertiary'}`}>
                    {complete ? <Check size={12} aria-hidden /> : <span className="font-mono">{index + 1}</span>}
                  </span>
                  <span className={active ? 'font-medium text-text-primary' : 'text-text-tertiary'}>{phaseLabel(phase, t)}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-text-tertiary">{t('overview.loading.cacheNote')}</p>
        </div>
      </div>
    </PageShell>
  );
}

function LoadingStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-border bg-bg-surface p-3.5">
      <div className="label">{label}</div>
      <div className="num-mid mt-1.5">{value}</div>
    </div>
  );
}

function phaseLabel(phase: IndexerPhase, t: (key: string) => string): string {
  if (phase === 'discovering') return t('overview.loading.phaseLabel.discovering');
  if (phase === 'scanning') return t('overview.loading.phaseLabel.scanning');
  return t('overview.loading.phaseLabel.building');
}

function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
}
