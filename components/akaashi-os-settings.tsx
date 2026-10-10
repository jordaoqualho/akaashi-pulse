'use client';

import { useEffect, useState } from 'react';
import { Check, Eye, EyeOff, KeyRound, RefreshCw, ShieldCheck, Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ConnectionStatus, SyncMode } from '@/lib/integration/types';

interface Config {
  endpoint: string;
  tokenConfigured: boolean;
  enabled: boolean;
  syncMode: SyncMode;
  status: ConnectionStatus;
  lastSyncAt: string | null;
  lastSyncStatus: ConnectionStatus | null;
  lastSyncError: string | null;
  syncedSessions: number;
  pendingSessions: number;
}

interface PreviewResponse {
  payload: unknown;
  privacy: { included: string[]; excluded: string[] };
}

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  'not-configured': 'Not configured',
  configured: 'Configured',
  testing: 'Testing connection',
  connected: 'Connected',
  'authentication-failed': 'Authentication failed',
  'server-unavailable': 'Server unavailable',
  syncing: 'Syncing',
  synced: 'Synced',
  'partially-synced': 'Partially synced',
  'sync-failed': 'Sync failed',
};

function statusTone(status: ConnectionStatus): string {
  if (status === 'connected' || status === 'synced') return 'border-green-line bg-green-bg text-green';
  if (status === 'authentication-failed' || status === 'server-unavailable' || status === 'sync-failed') return 'border-red-line bg-red-bg text-red';
  if (status === 'testing' || status === 'syncing' || status === 'configured') return 'border-amber-line bg-amber-bg text-amber';
  return 'border-line bg-sunken text-muted';
}

function StatusBadge({ status }: { status: ConnectionStatus }) {
  return <span className={cn('pill border', statusTone(status))}><span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />{STATUS_LABEL[status]}</span>;
}

export function AkaashiOsSettings() {
  const [config, setConfig] = useState<Config | null>(null);
  const [endpoint, setEndpoint] = useState('');
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [syncMode, setSyncMode] = useState<SyncMode>('manual');
  const [busy, setBusy] = useState<'save' | 'test' | 'sync' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  async function load() {
    const response = await fetch('/api/integration/akaashi-os', { cache: 'no-store' });
    const next = (await response.json()) as Config;
    setConfig(next);
    setEndpoint(next.endpoint);
    setEnabled(next.enabled);
    setSyncMode(next.syncMode);
  }

  useEffect(() => { void load(); }, []);

  async function save() {
    setBusy('save');
    setMessage(null);
    try {
      const response = await fetch('/api/integration/akaashi-os', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, token, enabled, syncMode }),
      });
      const next = (await response.json()) as Config;
      if (!response.ok) throw new Error('The configuration could not be saved.');
      setConfig(next);
      setToken('');
      setMessage('Configuration saved locally.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The configuration could not be saved.');
    } finally { setBusy(null); }
  }

  async function testConnection() {
    setBusy('test');
    setMessage(null);
    await save();
    try {
      const response = await fetch('/api/integration/akaashi-os/test', { method: 'POST' });
      const result = (await response.json()) as { status: ConnectionStatus; error?: string };
      setConfig((current) => current ? { ...current, status: result.status, lastSyncError: result.error ?? null } : current);
      setMessage(result.error ?? STATUS_LABEL[result.status]);
    } catch { setMessage('The connection test failed.'); }
    setBusy(null);
  }

  async function syncNow() {
    setBusy('sync');
    setMessage(null);
    const response = await fetch('/api/integration/akaashi-os/sync', { method: 'POST' });
    const result = (await response.json()) as { status: ConnectionStatus; synced?: number; pending?: number; error?: string };
    setConfig((current) => current ? { ...current, status: result.status, lastSyncError: result.error ?? null, pendingSessions: result.pending ?? current.pendingSessions, syncedSessions: current.syncedSessions + (result.synced ?? 0) } : current);
    setMessage(result.error ?? `${result.synced ?? 0} sessions synced.`);
    setBusy(null);
  }

  async function togglePreview() {
    if (previewOpen) { setPreviewOpen(false); return; }
    const response = await fetch('/api/integration/akaashi-os/preview', { cache: 'no-store' });
    setPreview((await response.json()) as PreviewResponse);
    setPreviewOpen(true);
  }

  if (!config) return <div className="panel h-48 animate-pulse bg-sunken" aria-label="Loading AKAASHI OS settings" />;

  return (
    <div className="space-y-5">
      <section className="panel overflow-hidden">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line bg-wash px-5 py-4 sm:px-6">
          <div>
            <div className="flex items-center gap-2"><KeyRound size={16} className="text-faint" aria-hidden /><h2 className="text-sm font-semibold text-ink">Connection</h2></div>
            <p className="mt-1.5 max-w-[60ch] text-sm leading-relaxed text-muted">Optional synchronization from Pulse to your AKAASHI OS workspace. It is disabled until you enable it.</p>
          </div>
          <StatusBadge status={config.status} />
        </header>
        <div className="space-y-4 p-5 sm:p-6">
          <label className="block space-y-1.5"><span className="text-[13px] font-medium text-ink">Endpoint</span><input className="field" type="url" value={endpoint} onChange={(event) => setEndpoint(event.target.value)} placeholder="https://app.akaashi.com.br/api/integrations/pulse" autoComplete="url" /><span className="block text-xs text-faint">Leave blank while the AKAASHI OS receiving API is being prepared.</span></label>
          <label className="block space-y-1.5"><span className="text-[13px] font-medium text-ink">Integration token</span><span className="relative block"><input className="field pr-10" type={showToken ? 'text' : 'password'} value={token} onChange={(event) => setToken(event.target.value)} placeholder={config.tokenConfigured ? 'Token saved. Enter a replacement to rotate it.' : 'Paste a dedicated integration token'} autoComplete="off" /><button type="button" onClick={() => setShowToken((value) => !value)} className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-faint hover:bg-wash hover:text-ink" aria-label={showToken ? 'Hide token' : 'Show token'}>{showToken ? <EyeOff size={15} /> : <Eye size={15} />}</button></span><span className="block text-xs text-faint">Stored locally with restricted file permissions. It is never rendered back to the browser.</span></label>
          <div className="flex flex-wrap items-center gap-2"><button type="button" className="btn btn-line" onClick={testConnection} disabled={busy !== null}><RefreshCw size={14} className={busy === 'test' ? 'animate-spin' : ''} aria-hidden />Test connection</button><button type="button" className="btn btn-ink" onClick={save} disabled={busy !== null}>Save configuration</button></div>
          {message && <p className="text-sm text-muted" role="status">{message}</p>}
        </div>
      </section>

      <section className="panel overflow-hidden">
        <header className="border-b border-line bg-wash px-5 py-4 sm:px-6"><h2 className="text-sm font-semibold text-ink">Sync</h2><p className="mt-1.5 text-sm text-muted">Choose when sanitized analytics may leave this machine.</p></header>
        <div className="space-y-4 p-5 sm:p-6">
          <button type="button" onClick={() => setEnabled((value) => !value)} aria-pressed={enabled} className="flex w-full items-center justify-between gap-4 rounded-button border border-line bg-surface px-3 py-3 text-left hover:bg-wash"><span><span className="block text-[13px] font-medium text-ink">Enable synchronization</span><span className="mt-0.5 block text-xs text-muted">No data is sent while this is off.</span></span><span className={cn('flex h-5 w-5 items-center justify-center rounded border', enabled ? 'border-ink bg-ink text-white' : 'border-input bg-surface text-transparent')}><Check size={13} aria-hidden /></span></button>
          <div><p className="mb-2 text-[13px] font-medium text-ink">Sync mode</p><div className="grid gap-2 sm:grid-cols-3">{([['manual', 'Manual only', 'Send only when you choose Sync now.'], ['after-indexing', 'After indexing', 'Send new sessions after a local scan.'], ['scheduled', 'Scheduled', 'Reserved for a future local schedule.']] as const).map(([value, label, description]) => <button type="button" key={value} onClick={() => setSyncMode(value)} aria-pressed={syncMode === value} className={cn('rounded-button border px-3 py-2.5 text-left transition-colors', syncMode === value ? 'border-ink bg-sunken' : 'border-line bg-surface hover:bg-wash')}><span className="flex items-center gap-2 text-[13px] font-medium text-ink"><span className={cn('h-3.5 w-3.5 rounded-full border', syncMode === value ? 'border-[4px] border-ink' : 'border-input')} aria-hidden />{label}</span><span className="mt-1 block text-xs leading-relaxed text-muted">{description}</span></button>)}</div></div>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <header className="border-b border-line bg-wash px-5 py-4 sm:px-6"><div className="flex items-center gap-2"><ShieldCheck size={16} className="text-faint" aria-hidden /><h2 className="text-sm font-semibold text-ink">Data sharing</h2></div><p className="mt-1.5 text-sm text-muted">The outgoing contract is aggregate-only and versioned.</p></header>
        <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6"><div><p className="mb-2 text-[13px] font-medium text-ink">May be sent</p><ul className="space-y-2 text-sm text-muted">{['Project identifier', 'Repository identifier', 'Provider', 'Session metadata', 'Model usage', 'Token counts', 'Estimated active time', 'API-equivalent cost'].map((item) => <li key={item} className="flex items-center gap-2"><Check size={14} className="text-green" aria-hidden />{item}</li>)}</ul></div><div><p className="mb-2 text-[13px] font-medium text-ink">Never sent</p><ul className="space-y-2 text-sm text-muted">{['Prompts', 'AI responses', 'Source code', 'Files', 'MCP content', 'Environment variables', 'Secrets', 'Absolute local paths'].map((item) => <li key={item} className="flex items-center gap-2"><X size={14} className="text-red" aria-hidden />{item}</li>)}</ul></div></div>
        <div className="flex flex-wrap items-center gap-2 border-t border-line bg-wash px-5 py-3 sm:px-6"><button type="button" className="btn btn-line btn-sm" onClick={togglePreview}><Eye size={14} aria-hidden />{previewOpen ? 'Hide payload' : 'Preview payload'}</button><span className="text-xs text-faint">Inspect the exact JSON generated from the current local index.</span></div>
        {previewOpen && preview && <div className="border-t border-line bg-sunken p-5 sm:p-6"><div className="mb-3 flex items-center justify-between gap-3"><p className="text-[13px] font-semibold text-ink">Outgoing payload</p><span className="font-mono text-[11px] text-faint">schemaVersion: 1</span></div><pre className="max-h-[480px] overflow-auto rounded-button border border-line bg-surface p-4 font-mono text-[11px] leading-relaxed text-muted">{JSON.stringify(preview.payload, null, 2)}</pre></div>}
      </section>

      <section className="panel overflow-hidden">
        <header className="border-b border-line bg-wash px-5 py-4 sm:px-6"><h2 className="text-sm font-semibold text-ink">Sync status</h2></header>
        <div className="grid gap-4 p-5 sm:grid-cols-3 sm:p-6"><div><p className="meta">Last sync</p><p className="mt-1 text-sm text-ink">{config.lastSyncAt ? new Date(config.lastSyncAt).toLocaleString('en-US') : 'Not synced yet'}</p></div><div><p className="meta">Sessions synced</p><p className="kpi mt-1">{config.syncedSessions}</p></div><div><p className="meta">Pending</p><p className="kpi mt-1">{config.pendingSessions}</p></div></div>
        <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-4 sm:px-6"><button type="button" className="btn btn-ink" onClick={syncNow} disabled={busy !== null || !enabled}><Upload size={14} aria-hidden />{busy === 'sync' ? 'Syncing' : 'Sync now'}</button>{!enabled && <span className="text-xs text-faint">Enable synchronization before sending anything.</span>}{config.lastSyncError && <span className="text-sm text-red">{config.lastSyncError}</span>}</div>
      </section>
    </div>
  );
}
