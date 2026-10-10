'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useT, useI18n } from '@/lib/i18n/context';
import { usePendingNav } from '@/lib/use-pending-nav';
import type { ProviderId } from '@/lib/providers/types';

export interface SourceSwitcherProviderInfo {
  id: ProviderId;
  shortLabel: string;
  fg: string;
  bg: string;
  displayEn: string;
  displayZh: string;

  logoSrc?: string;
}

export type SourceChoice = ProviderId | 'all';

export interface SourceSwitcherProps {
  available: ProviderId[];
  initial: SourceChoice;
  providers: SourceSwitcherProviderInfo[];
  className?: string;
  onSelect?: (source: SourceChoice) => void;
}

const COOKIE_NAME = 'akaashi_pulse_source';

function setCookie(value: string) {
  if (typeof document === 'undefined') return;
  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(value)}; path=/; max-age=${oneYear}; SameSite=Lax`;
}

function deepLinkRoute(pathname: string): boolean {
  return /^\/sessions\/[^/]+|^\/projects\/[^/]+/.test(pathname);
}

function isChoice(v: string | null | undefined, available: ProviderId[]): v is SourceChoice {
  if (!v) return false;
  if (v === 'all') return available.length >= 2;
  return (available as string[]).includes(v);
}

export function SourceSwitcher({ available, initial, providers, className, onSelect }: SourceSwitcherProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useT();
  const { locale } = useI18n();
  // Shared hook rather than a local useTransition: a source switch is a
  // same-route navigation, so it needs the hook's stuck-transition rescue too.
  const { pending, navigate } = usePendingNav();
  const urlSource = searchParams.get('source');
  const urlChoice: SourceChoice | null = isChoice(urlSource, available) ? (urlSource as SourceChoice) : null;
  const [current, setCurrent] = useState<SourceChoice>(urlChoice ?? initial);

  useEffect(() => {
    if (urlChoice && urlChoice !== current) setCurrent(urlChoice);
  }, [urlChoice, current]);

  if (available.length < 2) return null;

  const select = (id: SourceChoice) => {
    if (id === current) return;
    setCurrent(id);
    setCookie(id);
    onSelect?.(id);
    const params = new URLSearchParams(searchParams.toString());
    params.set('source', id);
    const target = deepLinkRoute(pathname)
      ? `/${pathname.split('/')[1]}?${params.toString()}`
      : `${pathname}?${params.toString()}`;
    navigate(target);
  };

  const orderedProviders = providers.filter((p) => available.includes(p.id));
  const currentProvider = orderedProviders.find((item) => item.id === current);
  const currentLabel = current === 'all'
    ? t('source.all')
    : currentProvider
      ? (locale === 'zh' ? currentProvider.displayZh : currentProvider.displayEn)
      : current;

  return (
    <div className={`flex min-w-0 flex-col items-end gap-1.5 ${className ?? ''}`}>
      <div
        role="group"
        aria-label={t('nav.source')}
        className={`relative inline-flex max-w-full items-center gap-0.5 rounded-md border border-border bg-bg-surface p-0.5 ${pending ? 'cursor-progress' : ''}`}
        aria-busy={pending}
        title={t('nav.source')}
      >
        <AllButton
          active={current === 'all'}
          label={t('source.all')}
          onSelect={() => select('all')}
          disabled={pending}
          providers={orderedProviders}
        />
        {orderedProviders.map((p) => {
          const isActive = p.id === current;
          const label = locale === 'zh' ? p.displayZh : p.displayEn;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => select(p.id)}
              aria-pressed={isActive}
              aria-label={label}
              title={label}
              disabled={pending}
              className={`inline-flex h-7 w-7 items-center justify-center rounded transition-colors ${
                isActive
                  ? 'bg-brand-strong text-white shadow-sm'
                  : 'text-text-tertiary hover:text-text-primary hover:bg-bg-surface-hi'
              }`}
            >
              <ProviderMark provider={p} active={isActive} />
            </button>
          );
        })}
        {pending && (
          <div className="absolute inset-0 z-10 flex items-center justify-center gap-1.5 rounded-md bg-bg-surface/95 px-2 text-[11px] text-text-secondary" role="status" aria-live="polite">
            <Loader2 size={12} className="animate-spin text-brand" aria-hidden />
            <span className="truncate">{t('source.loading', { source: currentLabel })}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ProviderMark({ provider, active = false }: { provider: SourceSwitcherProviderInfo; active?: boolean }) {
  if (provider.logoSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={provider.logoSrc}
        alt=""
        aria-hidden
        className={`h-[18px] w-[18px] shrink-0 rounded-[3px] object-contain ${active && provider.id === 'cursor' ? 'brightness-0 invert' : ''}`}
      />
    );
  }
  return (
    <span
      className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[9px] font-bold leading-none"
      style={{ background: provider.bg, color: provider.fg }}
    >
      {provider.shortLabel}
    </span>
  );
}

function AllButton({
  active,
  label,
  onSelect,
  disabled,
  providers,
}: {
  active: boolean;
  label: string;
  onSelect: () => void;
  disabled: boolean;
  providers: SourceSwitcherProviderInfo[];
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`inline-flex h-7 w-8 items-center justify-center rounded transition-colors ${
        active
          ? 'bg-brand-strong text-white shadow-sm'
          : 'text-text-tertiary hover:text-text-primary hover:bg-bg-surface-hi'
      }`}
    >
      <span
        className="relative inline-flex items-center w-[26px] h-4 shrink-0"
        aria-hidden
      >
        {providers.slice(0, 2).map((p, i) => {

          const left = i === 0 ? 0 : 10;
          if (p.logoSrc) {
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={p.id}
                src={p.logoSrc}
                alt=""
                className={`absolute h-[18px] w-[18px] rounded-[3px] object-contain ${active && p.id === 'cursor' ? 'brightness-0 invert' : ''}`}
                style={{ left, zIndex: providers.length - i }}
              />
            );
          }
          return (
            <span
              key={p.id}
              className="absolute inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[9px] font-bold leading-none"
              style={{
                background: p.bg,
                color: p.fg,
                left,
                zIndex: providers.length - i,
              }}
            >
              {p.shortLabel}
            </span>
          );
        })}
      </span>
    </button>
  );
}
