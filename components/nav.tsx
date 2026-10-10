'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  BarChart3,
  Bot,
  Clock3,
  FolderKanban,
  Gauge,
  KeyRound,
  LayoutDashboard,
  ListTree,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Settings,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlobalSearch } from '@/components/global-search';
import { Logo } from '@/components/logo';
import { requestRefresh, useRefreshState } from '@/components/refresh-controller';
import { SourceSwitcher } from '@/components/source-switcher';
import type { SourceChoice, SourceSwitcherProps } from '@/components/source-switcher';
import { useT } from '@/lib/i18n/context';
interface NavItem {
  href: string;
  labelKey: string;
  icon: typeof LayoutDashboard;
}

const GROUPS: Array<{ labelKey: string; items: NavItem[] }> = [
  { labelKey: 'nav.workspace', items: [{ href: '/', labelKey: 'nav.overview', icon: LayoutDashboard }] },
  {
    labelKey: 'nav.monitor',
    items: [
      { href: '/usage', labelKey: 'nav.usage', icon: Gauge },
      { href: '/limits', labelKey: 'nav.limits', icon: Clock3 },
      { href: '/sessions', labelKey: 'nav.sessions', icon: Activity },
    ],
  },
  {
    labelKey: 'nav.explore',
    items: [
      { href: '/projects', labelKey: 'nav.projects', icon: FolderKanban },
      { href: '/models', labelKey: 'nav.models', icon: Bot },
      { href: '/tools', labelKey: 'nav.tools', icon: ListTree },
    ],
  },
  {
    labelKey: 'nav.decide',
    items: [{ href: '/benchmark', labelKey: 'nav.benchmark', icon: BarChart3 }],
  },
  {
    labelKey: 'nav.system',
    items: [{ href: '/settings', labelKey: 'nav.settings', icon: Settings }],
  },
];

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

function Tip({ children }: { children: string }) {
  return (
    <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs font-medium text-white opacity-0 shadow-pop transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden>
      {children}
    </span>
  );
}

export function Nav({
  initialSidebarCollapsed,
  sourceSwitcher,
  children,
}: {
  initialSidebarCollapsed: boolean;
  sourceSwitcher?: Omit<SourceSwitcherProps, 'className'>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const t = useT();
  const [collapsed, setCollapsed] = useState(initialSidebarCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { active: refreshing } = useRefreshState();

  const toggle = useCallback(() => {
    setCollapsed((value) => {
      const next = !value;
      document.cookie = `ak_sidebar=${next ? 'collapsed' : 'open'}; path=/; max-age=31536000; samesite=lax`;
      return next;
    });
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '[' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return;
      event.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  return (
    <div className="flex min-h-dvh">
      <aside className={cn('on-dark sticky top-0 flex h-dvh shrink-0 flex-col bg-side text-side-text transition-[width] duration-200 ease-out max-lg:hidden', collapsed ? 'w-[68px]' : 'w-[232px]')}>
        <div className={cn('flex h-16 shrink-0 items-center', collapsed ? 'justify-center' : 'justify-between pl-5 pr-3')}>
          {collapsed ? (
            <Link href="/" className="group relative flex h-9 w-9 items-center justify-center rounded-md hover:bg-side-hover" aria-label="Overview">
              <span className="title text-[22px] leading-none text-paper" aria-hidden>a</span>
              <span className="absolute bottom-[10px] right-[9px] h-1.5 w-1.5 rounded-full bg-brand-red" aria-hidden />
              <Tip>Overview</Tip>
            </Link>
          ) : (
            <>
              <Link href="/" className="text-paper" aria-label="AKAASHI Pulse overview">
                <Logo className="text-[24px]" />
              </Link>
              <button type="button" onClick={toggle} className="flex h-8 w-8 items-center justify-center rounded-md text-side-faint hover:bg-side-hover hover:text-white" aria-label="Collapse navigation" title="Collapse navigation [">
                <PanelLeftClose size={17} strokeWidth={1.8} />
              </button>
            </>
          )}
        </div>

        <nav className={cn('flex-1 pb-4', collapsed ? 'overflow-visible px-2.5' : 'overflow-y-auto overflow-x-hidden px-3')} aria-label="Primary">
          {GROUPS.map((group, groupIndex) => (
            <div key={group.labelKey} className={cn(collapsed ? 'mt-3 border-t border-side-line pt-3' : groupIndex === 0 ? 'mt-2' : 'mt-6')}>
              {!collapsed && <p className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-side-faint">{t(group.labelKey)}</p>}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link href={item.href} aria-current={active ? 'page' : undefined} className={cn('group relative flex h-9 items-center rounded-md text-[13.5px] font-medium transition-colors', collapsed ? 'justify-center' : 'gap-2.5 px-2.5', active ? 'bg-side-active text-white' : 'text-side-text hover:bg-side-hover hover:text-white')}>
                        {active && <span className="absolute -left-1.5 h-1.5 w-1.5 rounded-full bg-brand-red" aria-hidden />}
                        <Icon size={17} strokeWidth={1.8} className={active ? 'text-white' : 'text-side-faint group-hover:text-side-text'} aria-hidden />
                        <span className={collapsed ? 'sr-only' : 'flex-1 truncate'}>{t(item.labelKey)}</span>
                        {collapsed && <Tip>{t(item.labelKey)}</Tip>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {groupIndex === GROUPS.length - 1 && !collapsed && <div className="mt-5 border-t border-side-line" />}
            </div>
          ))}
        </nav>

        {collapsed && (
          <div className="flex justify-center pb-3">
            <button type="button" onClick={toggle} className="group relative flex h-9 w-9 items-center justify-center rounded-md text-side-faint hover:bg-side-hover hover:text-white" aria-label="Expand navigation">
              <PanelLeftOpen size={17} strokeWidth={1.8} />
              <Tip>Expand navigation [</Tip>
            </button>
          </div>
        )}

        {!collapsed && (
          <div className="border-t border-side-line px-5 py-4">
            <p className="text-[13px] font-medium text-white">AKAASHI Pulse</p>
            <p className="mt-0.5 text-[11.5px] text-side-faint">Local development analytics</p>
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-line bg-canvas/95 px-8 backdrop-blur-md max-md:px-4">
          <div className="relative lg:hidden">
            <button type="button" onClick={() => setMobileOpen((open) => !open)} className="btn btn-line btn-sm w-9 px-0" aria-label="Open navigation" aria-expanded={mobileOpen}>
              {mobileOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
            {mobileOpen && (
              <nav className="rise absolute left-0 top-11 z-50 w-64 rounded-card bg-surface p-1.5 shadow-pop" aria-label="Mobile navigation">
                {sourceSwitcher && (
                  <div className="mb-1 border-b border-line px-2.5 pb-3 pt-1">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">{t('nav.source')}</p>
                    <p className="mb-2 text-xs leading-relaxed text-muted">{t('nav.sourceHint')}</p>
                    <SourceSwitcher {...sourceSwitcher} className="items-start" onSelect={(_source: SourceChoice) => setMobileOpen(false)} />
                  </div>
                )}
                {GROUPS.map((group) => (
                  <div key={group.labelKey} className="mt-2 first:mt-0">
                    <p className="mb-1 px-2.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-faint">{t(group.labelKey)}</p>
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      return <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={cn('flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm', isActive(pathname, item.href) ? 'bg-sunken font-medium text-ink' : 'text-muted hover:bg-wash')}><Icon size={16} aria-hidden />{t(item.labelKey)}</Link>;
                    })}
                  </div>
                ))}
              </nav>
            )}
          </div>
          <Link href="/" className="lg:hidden" aria-label="AKAASHI Pulse overview"><Logo className="text-[21px]" /></Link>
          <div className="absolute left-1/2 hidden w-[min(520px,calc(100%-520px))] -translate-x-1/2 lg:block">
            <GlobalSearch />
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {sourceSwitcher && (
              <div className="hidden min-w-0 items-center gap-2 lg:flex" title={t('nav.sourceHint')}>
                <span className="hidden text-[11px] font-semibold uppercase tracking-[0.06em] text-muted xl:inline">{t('nav.source')}</span>
                <SourceSwitcher {...sourceSwitcher} />
              </div>
            )}
            <button type="button" onClick={() => requestRefresh('manual')} disabled={refreshing} className="btn btn-line btn-sm" title="Refresh local analytics">
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} aria-hidden />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <Link href="/settings/akaashi-os" className="btn btn-ink btn-sm" title="AKAASHI OS settings">
              <KeyRound size={14} aria-hidden />
              <span className="hidden md:inline">Connect OS</span>
            </Link>
          </div>
          <div className="min-w-0 flex-1 lg:hidden">
            <GlobalSearch />
          </div>
        </header>
        <main className="w-full min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
