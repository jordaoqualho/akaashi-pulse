'use client';

import {
  Activity,
  ArrowRight,
  BarChart3,
  Bot,
  Calculator,
  Clock3,
  Command,
  Database,
  DollarSign,
  FolderTree,
  FolderKanban,
  Gauge,
  KeyRound,
  LayoutDashboard,
  Lightbulb,
  ListTree,
  Plug,
  RefreshCw,
  Search,
  Settings,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/lib/i18n/context';
import { requestRefresh } from '@/components/refresh-controller';

interface SearchItem {
  id: string;
  href: string;
  icon: LucideIcon;
  labelKey: string;
  detailKey: string;
  keywords: string[];
  action?: 'refresh';
}

const SEARCH_ITEMS: SearchItem[] = [
  { id: 'overview', href: '/', icon: LayoutDashboard, labelKey: 'nav.overview', detailKey: 'nav.search.detail.overview', keywords: ['home', 'dashboard', 'summary'] },
  { id: 'usage', href: '/usage', icon: Gauge, labelKey: 'nav.usage', detailKey: 'nav.search.detail.usage', keywords: ['tokens', 'cost', 'calls', 'table'] },
  { id: 'limits', href: '/limits', icon: Clock3, labelKey: 'nav.limits', detailKey: 'nav.search.detail.limits', keywords: ['quota', 'reset', 'rate', 'agent'] },
  { id: 'sessions', href: '/sessions', icon: Activity, labelKey: 'nav.sessions', detailKey: 'nav.search.detail.sessions', keywords: ['conversation', 'turns', 'activity'] },
  { id: 'projects', href: '/projects', icon: FolderKanban, labelKey: 'nav.projects', detailKey: 'nav.search.detail.projects', keywords: ['spend', 'time', 'workspace'] },
  { id: 'models', href: '/models', icon: Bot, labelKey: 'nav.models', detailKey: 'nav.search.detail.models', keywords: ['pricing', 'provider', 'model'] },
  { id: 'tools', href: '/tools', icon: ListTree, labelKey: 'nav.tools', detailKey: 'nav.search.detail.tools', keywords: ['skills', 'mcp', 'context'] },
  { id: 'insights', href: '/insights', icon: Lightbulb, labelKey: 'nav.insights', detailKey: 'nav.search.detail.insights', keywords: ['sessions', 'patterns', 'activity', 'cost', 'trends', 'insights'] },
  { id: 'benchmark', href: '/benchmark', icon: BarChart3, labelKey: 'nav.benchmark', detailKey: 'nav.search.detail.benchmark', keywords: ['benchmark', 'compare', 'decision', 'efficiency'] },
  { id: 'settings', href: '/settings', icon: Settings, labelKey: 'nav.settings', detailKey: 'nav.search.detail.settings', keywords: ['sources', 'pricing', 'cache', 'mcp', 'preferences', 'configurações', 'ajustes'] },
  { id: 'data-sources', href: '/settings?tab=providers', icon: Database, labelKey: 'nav.search.dataSources', detailKey: 'nav.search.detail.dataSources', keywords: ['directories', 'folders', 'jsonl', 'claude', 'codex', 'fontes', 'diretórios', 'pastas'] },
  { id: 'project-scope', href: '/settings?tab=providers', icon: FolderTree, labelKey: 'nav.search.projectScope', detailKey: 'nav.search.detail.projectScope', keywords: ['workspaces', 'roots', 'projects', 'folders', 'scope', 'escopo', 'projetos'] },
  { id: 'external-agents', href: '/settings?tab=providers', icon: Bot, labelKey: 'nav.search.externalAgents', detailKey: 'nav.search.detail.externalAgents', keywords: ['cursor', 'antigravity', 'external', 'agent', 'logs', 'agentes externos', 'registros'] },
  { id: 'analytics', href: '/settings?tab=analytics', icon: Activity, labelKey: 'nav.search.analytics', detailKey: 'nav.search.detail.analytics', keywords: ['indexer', 'cache', 'scan', 'diagnostics', 'files', 'análise', 'analíticos', 'indexação'] },
  { id: 'real-costs', href: '/settings?tab=costs', icon: Calculator, labelKey: 'nav.search.realCosts', detailKey: 'nav.search.detail.realCosts', keywords: ['subscription', 'plans', 'monthly', 'operating', 'allocation', 'custos', 'assinatura', 'planos', 'mensal'] },
  { id: 'mcp', href: '/settings?tab=mcp', icon: Plug, labelKey: 'nav.search.mcp', detailKey: 'nav.search.detail.mcp', keywords: ['read-only', 'chatgpt', 'connection', 'local', 'server', 'somente leitura', 'conexão', 'servidor'] },
  { id: 'pricing', href: '/settings?tab=pricing', icon: DollarSign, labelKey: 'nav.search.pricing', detailKey: 'nav.search.detail.pricing', keywords: ['prices', 'models', 'litellm', 'refresh', 'preços', 'modelos', 'valores'] },
  { id: 'local-service', href: '/settings?tab=general', icon: RefreshCw, labelKey: 'nav.search.localService', detailKey: 'nav.search.detail.localService', keywords: ['background', 'server', '3737', 'launchagent', 'terminal', 'serviço', 'servidor local', 'segundo plano'] },
  { id: 'akaashi-os', href: '/settings/akaashi-os', icon: KeyRound, labelKey: 'nav.search.akaashiOs', detailKey: 'nav.search.detail.akaashiOs', keywords: ['integration', 'sync', 'connect', 'payload', 'integração', 'sincronização', 'conectar'] },
  { id: 'refresh', href: '/', icon: RefreshCw, labelKey: 'nav.search.refresh', detailKey: 'nav.search.detail.refresh', keywords: ['reload', 'reindex', 'rescan', 'update', 'atualizar', 'reindexar', 'varrer'], action: 'refresh' },
];

export function GlobalSearch() {
  const t = useT();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform));
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
        return;
      }
      if (!open) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  const results = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const matches = SEARCH_ITEMS.filter((item) => {
      if (!needle) return true;
      const haystack = [t(item.labelKey), t(item.detailKey), ...item.keywords].join(' ').toLocaleLowerCase();
      return haystack.includes(needle);
    });
    if (needle && matches.length === 0) {
      return [{
        id: 'usage-fallback',
        href: `/usage?q=${encodeURIComponent(query.trim())}`,
        icon: Search,
        labelKey: 'nav.search.usageFallback',
        detailKey: 'nav.search.usageFallbackDetail',
        keywords: [],
      } satisfies SearchItem];
    }
    return matches;
  }, [query, t]);

  useEffect(() => {
    setActiveIndex((index) => Math.min(index, Math.max(0, results.length - 1)));
  }, [results.length]);

  function navigateTo(item: SearchItem) {
    setOpen(false);
    setQuery('');
    if (item.action === 'refresh') {
      requestRefresh('manual');
      return;
    }
    router.push(item.href);
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const item = results[activeIndex];
      if (item) navigateTo(item);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full max-w-[520px] items-center gap-2 rounded-button border border-border bg-bg-surface px-3 text-left text-[13px] text-text-tertiary shadow-xs transition-colors hover:border-border-hi hover:bg-wash"
        aria-label={t('nav.search.label')}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Search size={15} strokeWidth={1.8} aria-hidden />
        <span className="min-w-0 flex-1 truncate">{t('nav.search.placeholder')}</span>
        <kbd className="hidden shrink-0 items-center gap-0.5 rounded border border-border bg-bg-surface-hi px-1.5 py-0.5 font-mono text-[10px] text-text-tertiary sm:inline-flex">
          {isMac ? '⌘' : 'Ctrl'} <span>K</span>
        </kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[80] bg-ink/10 px-4 pt-[76px] backdrop-blur-[2px] sm:pt-[92px]"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            className="rise mx-auto w-full max-w-[640px] overflow-hidden rounded-card border border-border bg-bg-surface shadow-pop"
            role="dialog"
            aria-modal="true"
            aria-label={t('nav.search.label')}
          >
            <div className="flex items-center gap-3 border-b border-border px-4">
              <Search size={17} className="shrink-0 text-faint" aria-hidden />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={onInputKeyDown}
                placeholder={t('nav.search.placeholder')}
                className="global-search-input h-14 min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 placeholder:text-text-tertiary"
                aria-label={t('nav.search.label')}
                role="combobox"
                aria-expanded="true"
                aria-controls="global-search-results"
                aria-activedescendant={results[activeIndex] ? `global-search-result-${activeIndex}` : undefined}
              />
              <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost h-8 w-8 px-0" aria-label={t('nav.search.close')}>
                <X size={16} aria-hidden />
              </button>
            </div>
            <div className="flex items-center justify-between border-b border-border bg-bg-surface-hi/50 px-4 py-2 text-[11px] text-text-tertiary">
              <span>{t('nav.search.commands')}</span>
              <span className="hidden items-center gap-2 sm:flex"><span>↑↓ {t('nav.search.navigate')}</span><span>↵ {t('nav.search.open')}</span></span>
            </div>
            <div id="global-search-results" className="max-h-[min(440px,calc(100dvh-190px))] overflow-y-auto p-2" role="listbox">
              {results.length > 0 ? results.map((item, index) => {
                const Icon = item.icon;
                const active = activeIndex === index;
                return (
                  <button
                    key={item.id}
                    id={`global-search-result-${index}`}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => navigateTo(item)}
                    className={`flex w-full items-center gap-3 rounded-button px-3 py-3 text-left transition-colors ${active ? 'bg-sunken text-ink' : 'text-text-secondary hover:bg-wash'}`}
                  >
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-button border ${active ? 'border-red-line bg-red-bg text-brand' : 'border-border bg-bg-surface-hi text-faint'}`}>
                      <Icon size={16} strokeWidth={1.8} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-text-primary">{t(item.labelKey)}</span>
                      <span className="mt-0.5 block truncate text-xs text-text-tertiary">{t(item.detailKey)}</span>
                    </span>
                    <ArrowRight size={15} className={active ? 'text-brand' : 'text-text-tertiary'} aria-hidden />
                  </button>
                );
              }) : (
                <div className="px-3 py-8 text-center text-sm text-text-tertiary">{t('nav.search.empty')}</div>
              )}
            </div>
            <div className="flex items-center gap-2 border-t border-border px-4 py-2.5 text-[11px] text-text-tertiary">
              <Command size={13} aria-hidden />
              <span>{t('nav.search.hint')}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
