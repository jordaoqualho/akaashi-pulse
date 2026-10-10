'use client';

import { useEffect, useState } from 'react';
import { Check, CircleStop, Loader2, RefreshCw, Server, Terminal } from 'lucide-react';
import { useT } from '@/lib/i18n/context';

interface ServiceSnapshot {
  service: {
    installed: boolean;
    running: boolean;
    url: string | null;
    port: number | null;
    mode: string | null;
    logFile: string | null;
    installedAt: string | null;
  };
  background: {
    running: boolean;
    pid: number | null;
    url: string | null;
    port: number | null;
  };
  canStop: boolean;
}

export function LocalServiceControl() {
  const t = useT();
  const [snapshot, setSnapshot] = useState<ServiceSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);

  async function loadStatus() {
    setError(false);
    try {
      const response = await fetch('/api/service', { cache: 'no-store' });
      if (!response.ok) throw new Error('service status request failed');
      setSnapshot((await response.json()) as ServiceSnapshot);
    } catch {
      setError(true);
    }
  }

  useEffect(() => { void loadStatus(); }, []);

  async function stop() {
    setBusy(true);
    setMessage(null);
    setError(false);
    try {
      const response = await fetch('/api/service', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' }),
      });
      if (!response.ok) throw new Error('service stop request failed');
      setMessage(t('settings.about.service.stopScheduled'));
      setConfirming(false);
      setSnapshot((current) => current ? {
        ...current,
        canStop: false,
        service: { ...current.service, installed: false, running: false },
        background: { ...current.background, running: false, pid: null },
      } : current);
    } catch {
      setError(true);
      setMessage(t('settings.about.service.error'));
    } finally {
      setBusy(false);
    }
  }

  const serviceRunning = snapshot?.service.running ?? false;
  const backgroundRunning = snapshot?.background.running ?? false;
  const activeUrl = serviceRunning ? snapshot?.service.url : snapshot?.background.url;
  const activePort = serviceRunning ? snapshot?.service.port : snapshot?.background.port;
  const activeMode = serviceRunning ? snapshot?.service.mode : null;
  const status = serviceRunning
    ? t('settings.about.service.running')
    : snapshot?.service.installed
      ? t('settings.about.service.installedStopped')
      : backgroundRunning
        ? t('settings.about.service.backgroundRunning')
        : t('settings.about.service.notInstalled');

  return (
    <div className="rounded-card border border-border bg-bg-surface-hi p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-button border border-border bg-bg-surface text-text-secondary">
            <Server size={17} aria-hidden />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-text-primary">{t('settings.about.service.title')}</h3>
            <p className="mt-1 max-w-[62ch] text-xs leading-relaxed text-text-secondary">
              {t('settings.about.service.desc')}
            </p>
          </div>
        </div>
        <span className={`pill border ${serviceRunning || backgroundRunning ? 'border-success/20 bg-success/10 text-success' : 'border-border bg-bg-surface text-text-tertiary'}`}>
          <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
          {snapshot ? status : t('settings.about.service.checking')}
        </span>
      </div>

      {snapshot && (serviceRunning || backgroundRunning || snapshot.service.installed) && (
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <Detail label={t('settings.about.service.url')} value={activeUrl ?? '127.0.0.1'} mono />
          <Detail label={t('settings.about.service.port')} value={activePort ? String(activePort) : '3737'} mono />
          <Detail label={t('settings.about.service.mode')} value={activeMode ?? t('settings.about.service.manualMode')} />
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {snapshot?.canStop && !confirming && (
          <button type="button" className="btn btn-line btn-sm" onClick={() => setConfirming(true)} disabled={busy}>
            <CircleStop size={14} aria-hidden />
            {serviceRunning ? t('settings.about.service.stop') : t('settings.about.service.stopBackground')}
          </button>
        )}
        {snapshot && !snapshot.canStop && !confirming && (
          <span className="flex items-center gap-1.5 text-xs text-text-tertiary">
            {snapshot.service.installed ? <Terminal size={13} aria-hidden /> : <Check size={13} aria-hidden />}
            {snapshot.service.installed ? t('settings.about.service.startHint') : t('settings.about.service.manualHint')}
          </span>
        )}
        {!snapshot && !error && <span className="text-xs text-text-tertiary">{t('settings.about.service.checking')}</span>}
        {error && <span className="text-xs text-danger">{t('settings.about.service.error')}</span>}
        <button type="button" className="btn btn-line btn-sm" onClick={() => void loadStatus()} disabled={busy}>
          <RefreshCw size={13} aria-hidden />
          {t('settings.about.service.refresh')}
        </button>
      </div>

      {confirming && (
        <div className="mt-4 rounded-button border border-danger/25 bg-danger/5 p-3" role="alertdialog" aria-labelledby="stop-service-title">
          <p id="stop-service-title" className="text-sm font-semibold text-text-primary">{t('settings.about.service.confirmTitle')}</p>
          <p className="mt-1 text-xs leading-relaxed text-text-secondary">{t('settings.about.service.confirmDesc')}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn btn-line btn-sm" onClick={() => setConfirming(false)} disabled={busy}>
              {t('settings.about.service.cancel')}
            </button>
            <button type="button" className="btn btn-line btn-sm text-danger border-danger/30 hover:bg-danger/10" onClick={() => void stop()} disabled={busy}>
              {busy && <Loader2 size={13} className="animate-spin" aria-hidden />}
              {busy ? t('settings.about.service.stopping') : t('settings.about.service.confirm')}
            </button>
          </div>
        </div>
      )}

      {message && <p className="mt-3 text-xs text-success" role="status">{message}</p>}
    </div>
  );
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-button border border-border bg-bg-surface p-2.5">
      <div className="meta">{label}</div>
      <div className={`mt-1 truncate text-xs text-text-primary ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  );
}
