'use client';

import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ModelFilter } from '@/components/model-filter';
import { ProjectFilter } from '@/components/project-filter';
import { RangePicker } from '@/components/range-picker';
import { SegmentedPicker } from '@/components/segmented-picker';
import { usePendingNav } from '@/lib/use-pending-nav';
import { useI18n } from '@/lib/i18n/context';
import { usePathname, useSearchParams } from 'next/navigation';

export function SessionsToolbar({
  allModels,
  allProjects,
  selectedModels,
  selectedProjects,
  query,
}: {
  allModels: string[];
  allProjects: string[];
  selectedModels: string[];
  selectedProjects: string[];
  query: string;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const { t } = useI18n();
  const { pending, navigate } = usePendingNav();
  const [draft, setDraft] = useState(query);

  useEffect(() => setDraft(query), [query]);

  function applySearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = new URLSearchParams(params.toString());
    const value = draft.trim();
    if (value) next.set('q', value);
    else next.delete('q');
    next.delete('page');
    const qs = next.toString();
    navigate(qs ? `${pathname}?${qs}` : pathname);
  }

  function clearFilters() {
    const next = new URLSearchParams();
    const source = params.get('source');
    if (source) next.set('source', source);
    navigate(`${pathname}${next.toString() ? `?${next.toString()}` : ''}`);
  }

  const hasFilters = Boolean(
    query ||
      selectedModels.length > 0 ||
      selectedProjects.length > 0 ||
      (params.get('range') && params.get('range') !== 'all') ||
      (params.get('sort') && params.get('sort') !== 'recent'),
  );
  const selectedCount = selectedModels.length + selectedProjects.length;

  return (
    <section className="panel p-3 sm:p-4" aria-label={t('sessions.filters')} aria-busy={pending}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <form onSubmit={applySearch} className="relative min-w-0 flex-1 lg:max-w-xl">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" aria-hidden />
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t('sessions.searchPlaceholder')}
            aria-label={t('sessions.searchLabel')}
            className="h-9 w-full rounded-button border border-border bg-bg-surface pl-9 pr-20 text-sm text-text-primary placeholder:text-text-tertiary focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
          {draft && (
            <button
              type="button"
              onClick={() => setDraft('')}
              className="absolute right-16 top-1/2 -translate-y-1/2 rounded p-1 text-text-tertiary hover:bg-bg-surface-hi hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
              aria-label={t('common.clear')}
            >
              <X size={14} aria-hidden />
            </button>
          )}
          <button
            type="submit"
            className="absolute right-1 top-1/2 h-7 -translate-y-1/2 rounded-button bg-brand-strong px-2.5 text-xs font-semibold text-white transition-colors hover:bg-brand-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-progress disabled:opacity-60"
            disabled={pending}
          >
            {t('common.search')}
          </button>
        </form>

        <div className="flex items-center gap-2 text-xs text-text-tertiary">
          <SlidersHorizontal size={14} aria-hidden />
          <span>{t('sessions.filters')}</span>
          {selectedCount > 0 && <span className="pill-muted">{selectedCount}</span>}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
        <ModelFilter all={allModels} selected={selectedModels} />
        <ProjectFilter all={allProjects} selected={selectedProjects} />
        <RangePicker defaultValue="all" />
        <SegmentedPicker
          paramKey="sort"
          defaultValue="recent"
          ariaLabel={t('sessions.sortLabel')}
          options={[
            { value: 'recent', tk: 'sessions.sort.recent' },
            { value: 'cost', tk: 'sessions.sort.cost' },
            { value: 'tokens', tk: 'sessions.sort.tokens' },
            { value: 'duration', tk: 'sessions.sort.duration' },
          ]}
        />
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="btn-ghost btn-sm ml-auto text-xs text-text-secondary hover:text-text-primary"
            disabled={pending}
          >
            <X size={13} aria-hidden />
            {t('sessions.clearFilters')}
          </button>
        )}
      </div>
    </section>
  );
}
