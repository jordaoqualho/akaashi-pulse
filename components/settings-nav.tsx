'use client';

import Link from 'next/link';
import { ArrowUpRight, BarChart3, Calculator, Database, DollarSign, Plug, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/context';

export type SettingsTab = 'general' | 'providers' | 'analytics' | 'costs' | 'mcp' | 'pricing';
export type SettingsNavKey = SettingsTab | 'akaashi-os';

const TABS = [
  { key: 'general', icon: SlidersHorizontal, labelKey: 'settings.nav.general' },
  { key: 'providers', icon: Database, labelKey: 'settings.nav.providers' },
  { key: 'analytics', icon: BarChart3, labelKey: 'settings.nav.analytics' },
  { key: 'costs', icon: Calculator, labelKey: 'settings.nav.costs' },
  { key: 'mcp', icon: Plug, labelKey: 'settings.nav.mcp' },
  { key: 'pricing', icon: DollarSign, labelKey: 'settings.nav.pricing' },
] as const;

export function settingsTabHref(tab: SettingsTab): string {
  return `/settings?tab=${tab}`;
}

export function SettingsNav({ active }: { active: SettingsNavKey }) {
  const t = useT();

  return (
    <nav aria-label={t('settings.nav.label')} className="lg:sticky lg:top-24 lg:self-start">
      <p className="meta mb-2 px-2">{t('settings.nav.label')}</p>
      <div className="flex gap-1 overflow-x-auto pb-1 lg:block lg:space-y-0.5">
        {TABS.map((item) => {
          const Icon = item.icon;
          const selected = active === item.key;
          return (
            <Link
              key={item.key}
              href={settingsTabHref(item.key)}
              className={cn(
                'flex items-center gap-2 whitespace-nowrap rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors',
                selected ? 'bg-sunken text-ink' : 'text-muted hover:bg-wash hover:text-ink',
              )}
              aria-current={selected ? 'page' : undefined}
            >
              <Icon size={15} strokeWidth={1.8} aria-hidden />
              <span>{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </div>

      <div className="mt-4 border-t border-line pt-3">
        <p className="meta mb-2 px-2">{t('settings.nav.integrations')}</p>
        <Link
          href="/settings/akaashi-os"
          className={cn(
            'flex items-center justify-between gap-2 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors',
            active === 'akaashi-os' ? 'bg-sunken text-ink' : 'text-muted hover:bg-wash hover:text-ink',
          )}
          aria-current={active === 'akaashi-os' ? 'page' : undefined}
        >
          <span className="flex items-center gap-2">
            <Plug size={15} strokeWidth={1.8} aria-hidden />
            <span>{t('settings.nav.akaashiOs')}</span>
          </span>
          <ArrowUpRight size={14} className="text-faint" aria-hidden />
        </Link>
      </div>
    </nav>
  );
}
