'use client';

import { useEffect, useState } from 'react';
import { Clock3, ShieldAlert, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AgentLimitSnapshot, AgentLimitWindow, ProviderId } from '@/lib/types';

interface AgentInfo {
  id: ProviderId;
  label: string;
  logoSrc: string;
  exportsLimitTelemetry: boolean;
}

export interface LimitLabels {
  remaining: string;
  used: string;
  resetIn: string;
  resetAt: string;
  observed: string;
  available: string;
  nearLimit: string;
  exhausted: string;
  afterReset: string;
  primary: string;
  secondary: string;
  window: string;
  plan: string;
  credits: string;
  unlimited: string;
  noTelemetry: string;
  noTelemetryHint: string;
  claudeNoTelemetryHint: string;
  notSupported: string;
  notSupportedSummary: string;
  notSupportedHint: Partial<Record<ProviderId, string>>;
  note: string;
}

export function LimitsDashboard({
  agents,
  limits,
  labels,
}: {
  agents: AgentInfo[];
  limits: Partial<Record<ProviderId, AgentLimitSnapshot>>;
  labels: LimitLabels;
}) {
  const observedValues = Object.values(limits)
    .filter((snapshot): snapshot is AgentLimitSnapshot => Boolean(snapshot))
    .map((snapshot) => Date.parse(snapshot.observedAt))
    .filter((value) => Number.isFinite(value));
  const initialNow = observedValues.length > 0 ? Math.max(...observedValues) : 0;
  const [now, setNow] = useState(initialNow);

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        {agents.map((agent) => (
          <AgentLimitCard
            key={agent.id}
            agent={agent}
            snapshot={limits[agent.id]}
            labels={labels}
            now={now}
          />
        ))}
      </div>
      <div className="flex items-start gap-2 rounded-button border border-border bg-bg-surface-hi/40 px-4 py-3 text-xs leading-relaxed text-text-secondary">
        <Clock3 size={14} className="mt-0.5 shrink-0 text-text-tertiary" aria-hidden />
        <span>{labels.note}</span>
      </div>
    </div>
  );
}

function AgentLimitCard({
  agent,
  snapshot,
  labels,
  now,
}: {
  agent: AgentInfo;
  snapshot?: AgentLimitSnapshot;
  labels: LimitLabels;
  now: number;
}) {
  const unsupported = !agent.exportsLimitTelemetry;

  return (
    <section className="panel overflow-hidden">
      <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={agent.logoSrc} alt="" aria-hidden className="h-8 w-8 shrink-0 rounded-md object-contain" />
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-text-primary">{agent.label}</h2>
            <p className="mt-0.5 text-xs text-text-tertiary">
              {snapshot
                ? formatObserved(labels.observed, snapshot.observedAt)
                : unsupported
                  ? labels.notSupportedSummary
                  : labels.noTelemetry}
            </p>
          </div>
        </div>
        {snapshot ? (
          <span className="pill shrink-0 border border-success/20 bg-success/10 text-success">
            <ShieldCheck size={13} aria-hidden />
            {snapshot.planType ? `${labels.plan}: ${snapshot.planType}` : labels.available}
          </span>
        ) : unsupported ? (
          <span className="pill-muted shrink-0">{labels.notSupported}</span>
        ) : (
          <span className="pill shrink-0 border border-amber-line bg-amber-bg text-amber-text">
            <ShieldAlert size={13} aria-hidden />
            {labels.noTelemetry}
          </span>
        )}
      </header>

      {!snapshot ? (
        <div className="px-5 py-8 text-sm leading-relaxed text-text-secondary sm:px-6">
          <p>
            {unsupported
              ? labels.notSupportedHint[agent.id] ?? labels.noTelemetryHint
              : agent.id === 'claude'
                ? labels.claudeNoTelemetryHint
                : labels.noTelemetryHint}
          </p>
        </div>
      ) : (
        <div className="space-y-5 p-5 sm:p-6">
          {snapshot.windows.map((window) => (
            <LimitWindowRow key={window.id} window={window} labels={labels} now={now} />
          ))}
          {(snapshot.credits || snapshot.rateLimitReachedType || snapshot.spendControlReached) && (
            <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-4 text-xs text-text-secondary">
              {snapshot.credits && (
                <span>
                  <span className="text-text-tertiary">{labels.credits}: </span>
                  {snapshot.credits.unlimited ? labels.unlimited : snapshot.credits.balance ?? '—'}
                </span>
              )}
              {snapshot.rateLimitReachedType && (
                <span className="font-medium text-danger">
                  <ShieldAlert size={13} className="mr-1 inline" aria-hidden />
                  {labels.exhausted}
                </span>
              )}
              {snapshot.spendControlReached && <span className="font-medium text-danger">{labels.exhausted}</span>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function LimitWindowRow({
  window,
  labels,
  now,
}: {
  window: AgentLimitWindow;
  labels: LimitLabels;
  now: number;
}) {
  const used = Math.max(0, Math.min(100, window.usedPercent));
  const remaining = Math.max(0, 100 - used);
  const resetMs = window.resetsAt ? Date.parse(window.resetsAt) : NaN;
  const expired = Number.isFinite(resetMs) && now >= resetMs;
  const exhausted = used >= 100;
  const warning = used >= 80;
  const tone = expired ? 'bg-border-hi' : exhausted ? 'bg-danger' : warning ? 'bg-warning' : 'bg-success';
  const textTone = expired ? 'text-text-secondary' : exhausted ? 'text-danger' : warning ? 'text-warning' : 'text-success';
  const status = expired
    ? labels.afterReset
    : exhausted
      ? labels.exhausted
      : warning
        ? labels.nearLimit
        : labels.available;
  const windowLabel = window.windowMinutes === 300
    ? labels.primary
    : window.windowMinutes === 10080
      ? labels.secondary
      : labels.window.replace('{minutes}', String(window.windowMinutes ?? '—'));

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-text-primary">{windowLabel}</div>
          <div className={cn('mt-1 text-xs', textTone)}>{status}</div>
        </div>
        <div className="text-right">
          <div className="num-hero text-[25px]">{Math.round(remaining)}%</div>
          <div className="text-xs text-text-tertiary">{labels.remaining}</div>
        </div>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-bg-surface-hi" aria-label={`${Math.round(used)}% ${labels.used}`}>
        <div className={cn('h-full rounded-full transition-[width] duration-500', tone)} style={{ width: `${used}%` }} />
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-text-tertiary">
        <span>{Math.round(used)}% {labels.used}</span>
        {window.resetsAt && (
          <span className={cn(expired && 'text-warning')}>
            {expired
              ? labels.afterReset
              : formatReset(labels.resetIn, labels.resetAt, window.resetsAt, now)}
          </span>
        )}
      </div>
    </div>
  );
}

function formatObserved(template: string, value: string): string {
  const date = new Date(value);
  return template.replace('{time}', Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-US'));
}

function formatReset(resetIn: string, resetAt: string, value: string, now: number): string {
  const date = new Date(value);
  const remaining = date.getTime() - now;
  const exact = resetAt.replace('{time}', date.toLocaleString('en-US'));
  if (remaining <= 0) return exact;
  return `${resetIn.replace('{time}', formatDuration(remaining))} · ${exact}`;
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.max(1, Math.ceil(ms / 60_000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
