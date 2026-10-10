'use client';

import {
  Check,
  CheckCircle2,
  Circle,
  Database,
  FileSearch,
  Layers3,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/lib/i18n/context';

type IndexerPhase = 'idle' | 'discovering' | 'scanning' | 'building-snapshot' | 'ready' | 'error';

interface IndexerStatusSnapshot {
  initialized: boolean;
  isIndexing: boolean;
  phase: IndexerPhase;
  filesIndexed: number;
  recordsIndexed: number;
  filesDiscovered: number;
  filesProcessed: number;
  cacheHits: number;
  scanTotal: number;
  bySource?: Array<{ source: string }>;
}

interface ScanResponse {
  stats?: {
    filesScanned: number;
    recordsParsed: number;
    assistantRecords: number;
    durationMs: number;
  };
  bySource?: Array<{ source: string }>;
  rateLimits?: Record<string, unknown>;
  indexer?: IndexerStatusSnapshot;
  sync?: { ok?: boolean } | null;
}

export type RefreshMode = 'manual' | 'automatic';
export type RefreshStage = 'idle' | 'indexing' | 'applying' | 'complete' | 'error';

export interface RefreshUiState {
  active: boolean;
  mode: RefreshMode;
  stage: RefreshStage;
  phase: IndexerPhase;
  status: IndexerStatusSnapshot | null;
  result: ScanResponse | null;
  error: string | null;
}

const REQUEST_EVENT = 'akaashi-pulse:refresh-request';
const STATE_EVENT = 'akaashi-pulse:refresh-state';

const INITIAL_STATE: RefreshUiState = {
  active: false,
  mode: 'manual',
  stage: 'idle',
  phase: 'idle',
  status: null,
  result: null,
  error: null,
};

const PHASES: Array<{ key: IndexerPhase; icon: typeof FileSearch; label: string; detail: string }> = [
  { key: 'discovering', icon: FileSearch, label: 'refresh.phase.discovering', detail: 'refresh.phase.discoveringDetail' },
  { key: 'scanning', icon: Database, label: 'refresh.phase.scanning', detail: 'refresh.phase.scanningDetail' },
  { key: 'building-snapshot', icon: Layers3, label: 'refresh.phase.building', detail: 'refresh.phase.buildingDetail' },
];

export function requestRefresh(mode: RefreshMode = 'manual'): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(REQUEST_EVENT, { detail: { mode } }));
}

export function useRefreshState(): RefreshUiState {
  const [state, setState] = useState<RefreshUiState>(INITIAL_STATE);

  useEffect(() => {
    const onState = (event: Event) => {
      const detail = (event as CustomEvent<RefreshUiState>).detail;
      if (detail) setState(detail);
    };
    window.addEventListener(STATE_EVENT, onState);
    return () => window.removeEventListener(STATE_EVENT, onState);
  }, []);

  return state;
}

export function RefreshController() {
  const router = useRouter();
  const t = useT();
  const [state, setState] = useState<RefreshUiState>(INITIAL_STATE);
  const [visible, setVisible] = useState(false);
  const activeRef = useRef(false);
  const dismissedRef = useRef(false);
  const closeTimerRef = useRef<number | null>(null);
  const pollTimerRef = useRef<number | null>(null);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent(STATE_EVENT, { detail: state }));
  }, [state]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function start(mode: RefreshMode) {
      if (activeRef.current) return;
      activeRef.current = true;
      dismissedRef.current = false;
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
      setVisible(true);
      setState({ ...INITIAL_STATE, active: true, mode, stage: 'indexing', phase: 'discovering' });

      let pollTimer: number | null = null;

      const readStatus = async () => {
        try {
          const response = await fetch('/api/indexer/status', { cache: 'no-store' });
          if (!response.ok) return;
          const payload = (await response.json()) as { indexer?: IndexerStatusSnapshot };
          if (cancelled || !payload.indexer) return;
          setState((current) => ({
            ...current,
            phase: payload.indexer?.phase ?? current.phase,
            status: payload.indexer ?? current.status,
          }));
        } catch {
          // The scan request remains the source of truth. A temporary status
          // polling failure should not make a successful refresh look broken.
        }
      };

      void readStatus();
      pollTimer = window.setInterval(() => void readStatus(), 450);
      pollTimerRef.current = pollTimer;

      try {
        const response = await fetch('/api/scan', { method: 'POST', cache: 'no-store' });
        const payload = (await response.json().catch(() => ({}))) as ScanResponse & { message?: string };
        if (!response.ok) throw new Error(payload.message || `Refresh failed (${response.status})`);

        if (pollTimer !== null) window.clearInterval(pollTimer);
        pollTimerRef.current = null;
        await readStatus();
        if (cancelled) return;

        activeRef.current = false;
        setState((current) => ({
          ...current,
          active: false,
          stage: 'applying',
          result: payload,
          status: payload.indexer ?? current.status,
          phase: payload.indexer?.phase ?? 'ready',
        }));

        // Keep the previous page visible while Next fetches the new RSC tree.
        router.refresh();
        window.dispatchEvent(new Event('akaashi-pulse:refresh'));

        await wait(650);
        if (cancelled) return;
        setState((current) => ({ ...current, active: false, stage: 'complete', phase: 'ready' }));
        closeTimerRef.current = window.setTimeout(() => {
          if (!dismissedRef.current) setVisible(false);
          setState(INITIAL_STATE);
        }, 2_200);
      } catch (error) {
        if (pollTimer !== null) window.clearInterval(pollTimer);
        pollTimerRef.current = null;
        activeRef.current = false;
        if (cancelled) return;
        setState((current) => ({
          ...current,
          active: false,
          stage: 'error',
          phase: 'error',
          error: error instanceof Error ? error.message : String(error),
        }));
      } finally {
        if (pollTimer !== null) window.clearInterval(pollTimer);
        pollTimerRef.current = null;
        activeRef.current = false;
      }
    }

    const onRequest = (event: Event) => {
      const mode = (event as CustomEvent<{ mode?: RefreshMode }>).detail?.mode ?? 'manual';
      void start(mode);
    };

    window.addEventListener(REQUEST_EVENT, onRequest);
    return () => {
      cancelled = true;
      window.removeEventListener(REQUEST_EVENT, onRequest);
      if (pollTimerRef.current !== null) window.clearInterval(pollTimerRef.current);
    };
  }, [router]);

  const meta = useMemo(() => {
    if (state.stage === 'applying') {
      return { title: t('refresh.phase.applying'), detail: t('refresh.phase.applyingDetail'), icon: RefreshCw };
    }
    if (state.stage === 'complete') {
      return { title: t('refresh.phase.complete'), detail: t('refresh.phase.completeDetail'), icon: CheckCircle2 };
    }
    if (state.stage === 'error') {
      return { title: t('refresh.phase.error'), detail: t('refresh.phase.errorDetail'), icon: TriangleAlert };
    }
    const phase = PHASES.find((item) => item.key === state.phase) ?? PHASES[0];
    return { title: t(phase.label), detail: t(phase.detail), icon: phase.icon };
  }, [state.phase, state.stage, t]);

  if (!visible) return null;

  const Icon = meta.icon;
  const progress = progressFor(state);
  const status = state.status;
  const stats = state.result?.stats;
  const files = status?.scanTotal || stats?.filesScanned
    ? `${status?.filesProcessed ?? stats?.filesScanned ?? 0} / ${status?.scanTotal ?? stats?.filesScanned ?? 0}`
    : '—';
  const cache = status?.cacheHits ?? 0;
  const records = status?.recordsIndexed ?? stats?.assistantRecords ?? 0;
  const sources = state.result?.bySource?.length ?? status?.bySource?.length ?? 0;
  const duration = stats?.durationMs ? formatDuration(stats.durationMs) : '—';
  const hasLimits = Boolean(state.result?.rateLimits && Object.keys(state.result.rateLimits).length > 0);
  const syncLabel = state.active
    ? t('refresh.pending')
    : state.result?.sync === null || state.result?.sync === undefined
      ? t('refresh.syncSkipped')
      : state.result.sync.ok === false
        ? t('refresh.syncFailed')
        : t('refresh.syncDone');

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-ink/20 p-4 backdrop-blur-[2px]" role="presentation">
      <section
        className="rise max-h-[calc(100dvh-2rem)] w-full max-w-[640px] overflow-y-auto rounded-card border border-border bg-bg-surface shadow-pop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="refresh-dialog-title"
        aria-describedby="refresh-dialog-detail"
      >
        <div className="border-b border-border bg-bg-surface-hi/45 px-5 py-5 sm:px-6">
          <div className="flex items-start gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${state.stage === 'error' ? 'border-danger/25 bg-danger/10 text-danger' : state.stage === 'complete' ? 'border-success/25 bg-success/10 text-success' : 'border-brand/25 bg-brand/10 text-brand'}`}>
              <Icon size={18} className={state.active ? 'animate-spin' : undefined} aria-hidden />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="refresh-dialog-title" className="text-[15px] font-semibold text-text-primary">
                  {state.mode === 'automatic' ? t('refresh.autoTitle') : t('refresh.title')}
                </h2>
                <span className="rounded-full border border-border bg-bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-text-tertiary">
                  {state.mode === 'automatic' ? t('refresh.automatic') : t('refresh.manual')}
                </span>
              </div>
              <p id="refresh-dialog-detail" className="mt-1 text-xs leading-relaxed text-text-secondary">{meta.detail}</p>
            </div>
            <button type="button" onClick={() => setVisible(false)} className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-button text-text-tertiary hover:bg-bg-surface-hi hover:text-text-primary" aria-label={t('refresh.close')}>
              <X size={15} aria-hidden />
            </button>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between gap-3 text-[11px] text-text-tertiary">
              <span>{meta.title}</span>
              <span className="font-mono tabular-nums">{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-bg-surface-hi">
              <div className={`h-full rounded-full transition-[width] duration-300 ${state.stage === 'error' ? 'bg-danger' : state.stage === 'complete' ? 'bg-success' : 'bg-brand'}`} style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 px-5 py-4 sm:grid-cols-4 sm:px-6">
          <RefreshStat label={t('refresh.files')} value={files} />
          <RefreshStat label={t('refresh.cache')} value={cache.toLocaleString()} />
          <RefreshStat label={t('refresh.records')} value={records.toLocaleString()} />
          <RefreshStat label={t('refresh.sources')} value={sources.toLocaleString()} />
        </div>

        <div className="border-t border-border px-5 py-4 sm:px-6">
          <div className="grid gap-2 sm:grid-cols-3">
            {PHASES.map((item, index) => {
              const phaseIndex = PHASES.findIndex((phase) => phase.key === state.phase);
              const done = state.stage === 'complete' || state.stage === 'applying' || phaseIndex > index;
              const active = state.stage === 'indexing' && item.key === state.phase;
              const StepIcon = item.icon;
              return (
                <div key={item.key} className={`flex items-center gap-2 rounded-button border px-2.5 py-2 text-xs ${active ? 'border-brand/30 bg-brand/5 text-text-primary' : 'border-border bg-bg-surface-hi/35 text-text-tertiary'}`}>
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${done ? 'border-success/30 bg-success/10 text-success' : active ? 'border-brand/30 bg-brand/10 text-brand' : 'border-border bg-bg-surface text-text-tertiary'}`}>
                    {done ? <Check size={12} aria-hidden /> : active ? <StepIcon size={12} className="animate-pulse" aria-hidden /> : <Circle size={10} aria-hidden />}
                  </span>
                  <span className={active ? 'font-medium' : undefined}>{t(item.label)}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 border-t border-border px-5 py-5 sm:grid-cols-2 sm:px-6">
          <ChangeList title={t('refresh.updated.title')} tone="positive">
            <ChangeRow icon={Database} title={t('refresh.updated.index')} detail={t('refresh.updated.indexDetail')} status={state.active ? t('refresh.pending') : t('refresh.ready')} />
            <ChangeRow icon={Layers3} title={t('refresh.updated.analytics')} detail={t('refresh.updated.analyticsDetail')} status={state.active ? t('refresh.pending') : t('refresh.ready')} />
            <ChangeRow icon={ShieldCheck} title={t('refresh.updated.limits')} detail={t('refresh.updated.limitsDetail')} status={state.active ? t('refresh.pending') : hasLimits ? t('refresh.checked') : t('refresh.unavailable')} />
            <ChangeRow icon={RefreshCw} title={t('refresh.updated.sync')} detail={syncLabel} status={syncLabel} />
          </ChangeList>

          <ChangeList title={t('refresh.unchanged.title')} tone="neutral">
            <ChangeRow icon={ShieldCheck} title={t('refresh.unchanged.files')} detail={t('refresh.unchanged.filesDetail')} />
            <ChangeRow icon={Database} title={t('refresh.unchanged.pricing')} detail={t('refresh.unchanged.pricingDetail')} />
            <ChangeRow icon={Layers3} title={t('refresh.unchanged.settings')} detail={t('refresh.unchanged.settingsDetail')} />
            <ChangeRow icon={ShieldCheck} title={t('refresh.unchanged.network')} detail={t('refresh.unchanged.networkDetail')} />
          </ChangeList>
        </div>

        {state.stage === 'error' && (
          <div className="mx-5 mb-4 rounded-button border border-danger/25 bg-danger/5 px-3 py-2.5 text-xs text-danger sm:mx-6">
            {state.error || t('refresh.phase.errorDetail')}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4 sm:px-6">
          <span className="text-[11px] text-text-tertiary">
            {stats?.durationMs ? `${t('refresh.duration')}: ${duration}` : t('refresh.desc')}
          </span>
          <div className="flex items-center gap-2">
            {state.active && (
              <button type="button" onClick={() => setVisible(false)} className="btn btn-line btn-sm">
                {t('refresh.continue')}
              </button>
            )}
            {state.stage === 'error' && (
              <button type="button" onClick={() => requestRefresh(state.mode)} className="btn btn-ink btn-sm">
                <RefreshCw size={14} aria-hidden />
                {t('refresh.retry')}
              </button>
            )}
            {!state.active && state.stage !== 'error' && (
              <button type="button" onClick={() => setVisible(false)} className="btn btn-line btn-sm">
                {t('refresh.close')}
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function RefreshStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-button border border-border bg-bg-surface-hi/35 px-3 py-2.5">
      <div className="label">{label}</div>
      <div className="mt-1 font-mono text-[13px] font-semibold tabular-nums text-text-primary">{value}</div>
    </div>
  );
}

function ChangeList({ title, tone, children }: { title: string; tone: 'positive' | 'neutral'; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-border bg-bg-surface-hi/25 p-3.5">
      <div className="flex items-center gap-2 text-xs font-semibold text-text-primary">
        <span className={`h-1.5 w-1.5 rounded-full ${tone === 'positive' ? 'bg-success' : 'bg-text-tertiary'}`} aria-hidden />
        {title}
      </div>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}

function ChangeRow({ icon: Icon, title, detail, status }: { icon: typeof Database; title: string; detail: string; status?: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={14} className="mt-0.5 shrink-0 text-text-tertiary" aria-hidden />
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <div className="text-xs font-medium text-text-primary">{title}</div>
          {status && <span className="text-[10px] font-medium text-success">{status}</span>}
        </div>
        <p className="mt-0.5 text-[11px] leading-relaxed text-text-tertiary">{detail}</p>
      </div>
    </div>
  );
}

function progressFor(state: RefreshUiState): number {
  if (state.stage === 'complete') return 100;
  if (state.stage === 'error') return 100;
  if (state.stage === 'applying') return 96;
  const status = state.status;
  if (state.phase === 'discovering') return 8;
  if (state.phase === 'scanning') {
    const ratio = status?.scanTotal ? Math.min(1, status.filesProcessed / status.scanTotal) : 0.08;
    return 14 + Math.round(ratio * 68);
  }
  if (state.phase === 'building-snapshot') return 88;
  return 6;
}

function formatDuration(ms: number): string {
  if (ms < 1_000) return `${ms}ms`;
  return `${(ms / 1_000).toFixed(1)}s`;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
