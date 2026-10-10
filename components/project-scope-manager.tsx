'use client';

import { Check, FolderPlus, FolderTree, Loader2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/lib/i18n/context';

type ScopeResponse = {
  roots?: string[];
  automatic?: boolean;
  error?: string;
};

export function ProjectScopeManager({
  roots: initialRoots,
  automatic: initialAutomatic,
}: {
  roots: string[];
  automatic: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [roots, setRoots] = useState(initialRoots);
  const [automatic, setAutomatic] = useState(initialAutomatic);
  const [root, setRoot] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<'success' | 'error' | null>(null);

  async function update(action: 'add' | 'remove' | 'auto' | 'all', value?: string) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch('/api/project-scope', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, root: value }),
      });
      const payload = (await response.json()) as ScopeResponse;
      if (!response.ok || !payload.roots || payload.automatic === undefined) {
        throw new Error(payload.error ?? 'update failed');
      }
      setRoots(payload.roots);
      setAutomatic(payload.automatic);
      setRoot('');
      setMessage('success');
      router.refresh();
    } catch {
      setMessage('error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 rounded-card border border-border bg-bg-surface-hi/40 p-4">
      <div className="flex items-start gap-3">
        <FolderTree size={16} className="mt-0.5 shrink-0 text-faint" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-medium text-text-primary">{t('settings.projectScope.title')}</div>
            <span className="pill border border-border bg-bg-surface text-text-tertiary text-xs">
              {automatic ? t('settings.projectScope.automatic') : t('settings.projectScope.manual')}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-text-secondary">{t('settings.projectScope.desc')}</p>
          <p className="mt-1 text-xs leading-relaxed text-text-tertiary">{t('settings.projectScope.virtualHint')}</p>

          {roots.length > 0 ? (
            <div className="mt-3 space-y-1.5">
              <div className="label">{t('settings.projectScope.roots')}</div>
              {roots.map((value) => (
                <div key={value} className="flex items-center justify-between gap-3 rounded-button border border-border bg-bg-surface px-3 py-2">
                  <span className="min-w-0 truncate font-mono text-xs text-text-primary">{value}</span>
                  {!automatic && (
                    <button
                      type="button"
                      className="btn btn-ghost h-7 w-7 shrink-0 px-0 text-text-tertiary hover:text-danger"
                      disabled={busy}
                      onClick={() => void update('remove', value)}
                      aria-label={`${t('settings.projectScope.remove')} ${value}`}
                    >
                      <Trash2 size={13} aria-hidden />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-button border border-border bg-bg-surface px-3 py-2 text-xs text-text-secondary">
              {automatic ? t('settings.projectScope.autoHint') : t('settings.projectScope.includeAllHint')}
            </div>
          )}

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={root}
              onChange={(event) => setRoot(event.target.value)}
              placeholder={t('settings.projectScope.pathPlaceholder')}
              className="field min-w-0 flex-1 font-mono text-xs"
              aria-label={t('settings.projectScope.pathPlaceholder')}
            />
            <button
              type="button"
              className="btn btn-ink btn-sm shrink-0"
              disabled={busy || !root.trim()}
              onClick={() => void update('add', root)}
            >
              {busy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <FolderPlus size={14} aria-hidden />}
              {t('settings.projectScope.add')}
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {!automatic && (
              <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void update('auto')}>
                {t('settings.projectScope.useAutomatic')}
              </button>
            )}
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy || (!automatic && roots.length === 0)} onClick={() => void update('all')}>
              {t('settings.projectScope.includeAll')}
            </button>
          </div>

          {message === 'success' && <div className="mt-2 flex items-center gap-1.5 text-xs text-success"><Check size={13} aria-hidden />{t('settings.projectScope.saved')}</div>}
          {message === 'error' && <div className="mt-2 text-xs text-danger">{t('settings.projectScope.invalidPath')}</div>}
        </div>
      </div>
    </div>
  );
}
