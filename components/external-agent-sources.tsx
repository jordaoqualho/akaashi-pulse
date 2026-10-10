import { ShieldCheck } from 'lucide-react';
import type { ExternalAgentDiscovery } from '@/lib/data-sources/discovery';
import { getServerT } from '@/lib/i18n/server';

export async function ExternalAgentSources({ agents }: { agents: ExternalAgentDiscovery[] }) {
  const t = await getServerT();
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {agents.map((agent) => {
        const existing = agent.paths.filter((item) => item.exists);
        return (
          <div key={agent.id} className="rounded-card border border-border bg-bg-surface p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-button border border-border bg-bg-surface-hi text-faint">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={agent.id === 'cursor' ? '/cursor-logo.svg' : '/antigravity-logo.svg'}
                    alt=""
                    aria-hidden
                    className="h-5 w-5 object-contain"
                  />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-text-primary">{agent.name}</div>
                  <div className="mt-0.5 text-xs text-text-tertiary">{agent.detected ? t('settings.external.detected') : t('settings.external.notDetected')}</div>
                </div>
              </div>
              <span className="pill border border-blue-line bg-blue-bg text-blue-text">{t('settings.external.metadataOnly')}</span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Metric label={t('settings.external.conversations')} value={agent.conversations == null ? '—' : agent.conversations.toLocaleString()} />
              <Metric label={agent.id === 'antigravity' ? t('settings.external.steps') : t('settings.external.lastActivity')} value={agent.id === 'antigravity' ? (agent.steps == null ? '—' : agent.steps.toLocaleString()) : formatDate(agent.lastActivity)} />
            </div>
            {agent.id === 'cursor' && <div className="mt-2 text-xs text-text-tertiary">{t('settings.external.lastActivity')}: {formatDate(agent.lastActivity)}</div>}

            <div className="mt-4 space-y-1.5">
              <div className="label">{t('settings.external.paths')}</div>
              {existing.length > 0 ? existing.map((item) => (
                <div key={item.path} className="flex items-center gap-2 rounded-button border border-border bg-bg-surface-hi/50 px-2.5 py-2">
                  <ShieldCheck size={13} className="shrink-0 text-success" aria-hidden />
                  <span className="min-w-0 truncate font-mono text-[11px] text-text-secondary" title={item.path}>{item.path}</span>
                </div>
              )) : <p className="text-xs text-text-tertiary">{t('settings.external.noPaths')}</p>}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-text-tertiary">{t('settings.external.limitation')}</p>
          </div>
        );
      })}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-button border border-border bg-bg-surface-hi/50 px-3 py-2">
      <div className="label">{label}</div>
      <div className="mt-1 text-sm font-semibold tabular-nums text-text-primary">{value}</div>
    </div>
  );
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}
