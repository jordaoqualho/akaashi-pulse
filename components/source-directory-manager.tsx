'use client';

import { Check, FolderPlus, Loader2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/lib/i18n/context';
import type { ProviderId } from '@/lib/providers';

export function SourceDirectoryManager({
  source,
  configuredDirectories,
}: {
  source: ProviderId;
  configuredDirectories: string[];
}) {
  const t = useT();
  const router = useRouter();
  const [directory, setDirectory] = useState('');
  const [directories, setDirectories] = useState(configuredDirectories);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<'success' | 'error' | null>(null);

  async function update(action: 'add' | 'remove', value: string) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch('/api/data-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, source, directory: value }),
      });
      const payload = (await response.json()) as { directories?: string[] };
      if (!response.ok || !payload.directories) throw new Error('update failed');
      setDirectories(payload.directories);
      setDirectory('');
      setMessage('success');
      router.refresh();
    } catch {
      setMessage('error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-card border border-border bg-bg-surface-hi/40 p-4">
      <div className="flex items-start gap-3">
        <FolderPlus size={16} className="mt-0.5 shrink-0 text-faint" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-text-primary">{t('settings.dataSources.addTitle')}</div>
          <p className="mt-1 text-xs leading-relaxed text-text-secondary">{t('settings.dataSources.addDesc')}</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={directory}
              onChange={(event) => setDirectory(event.target.value)}
              placeholder={t('settings.dataSources.pathPlaceholder')}
              className="field min-w-0 flex-1 font-mono text-xs"
              aria-label={t('settings.dataSources.pathPlaceholder')}
            />
            <button
              type="button"
              className="btn btn-ink btn-sm shrink-0"
              disabled={busy || !directory.trim()}
              onClick={() => void update('add', directory)}
            >
              {busy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <FolderPlus size={14} aria-hidden />}
              {t('settings.dataSources.add')}
            </button>
          </div>
          {message === 'success' && <div className="mt-2 flex items-center gap-1.5 text-xs text-success"><Check size={13} aria-hidden />{t('settings.dataSources.saved')}</div>}
          {message === 'error' && <div className="mt-2 text-xs text-danger">{t('settings.dataSources.invalidPath')}</div>}
          {directories.length > 0 && (
            <div className="mt-3 space-y-1.5">
              <div className="label">{t('settings.dataSources.customTitle')}</div>
              {directories.map((value) => (
                <div key={value} className="flex items-center justify-between gap-3 rounded-button border border-border bg-bg-surface px-3 py-2">
                  <span className="min-w-0 truncate font-mono text-xs text-text-primary">{value}</span>
                  <button type="button" className="btn btn-ghost h-7 w-7 shrink-0 px-0 text-text-tertiary hover:text-danger" disabled={busy} onClick={() => void update('remove', value)} aria-label={`${t('settings.dataSources.remove')} ${value}`}>
                    <Trash2 size={13} aria-hidden />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
