import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface SectionProps {
  title?: string;
  desc?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;

  inlineDesc?: boolean;

  fillBody?: boolean;
}

export function Section({
  title,
  desc,
  right,
  children,
  className,
  id,
  inlineDesc,
  fillBody,
}: SectionProps) {
  return (

    <section id={id} className={cn('panel scroll-mt-24 overflow-hidden', fillBody && 'flex flex-col', className)}>
      {(title || right) && (
        <header
          className={cn(
            'section-header',
            'flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4',
            'px-5 sm:px-6 pt-4 sm:pt-5 pb-3 border-b border-border',
          )}
        >
          <div className={cn('min-w-0', inlineDesc && 'sm:flex sm:items-baseline sm:gap-2.5')}>
            {title && (
              <h2 className="text-[15px] font-semibold text-text-primary tracking-tight leading-tight">
                {title}
              </h2>
            )}
            {desc && (
              <p
                className={cn(
                  'text-xs text-text-secondary leading-relaxed',
                  inlineDesc ? 'mt-1 sm:mt-0' : 'mt-1.5',
                )}
              >
                {desc}
              </p>
            )}
          </div>
          {right && <div className="flex items-center gap-2 flex-wrap">{right}</div>}
        </header>
      )}
      <div className={cn('p-5 sm:p-6', fillBody && 'flex-1 flex flex-col')}>{children}</div>
    </section>
  );
}

export function PageShell({
  title,
  desc,
  right,
  children,
}: {
  title: string;
  desc?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (

    <div className="dash-stagger mx-auto w-full max-w-[1480px] px-4 pb-16 pt-6 sm:px-8 sm:pt-8 space-y-5 sm:space-y-6">
      {/*
        relative z-20: the dash-stagger animation gives every direct child a
        non-`none` transform, which makes each child its own stacking context.
        Without an explicit z-index, the top bar (DOM-earlier) loses to the
        body content (DOM-later), so any popover inside the top bar — the
        custom-range picker, model / project dropdowns — gets painted under
        the KPI cards / chart. Lifting the top bar above the body keeps every
        page's filter popovers on top.
      */}
      <div className="relative z-20 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="title text-[30px] sm:text-[36px] truncate">
            {title}
          </h1>
          {desc && <p className="mt-1.5 text-sm leading-relaxed text-muted">{desc}</p>}
        </div>
        {right && <div className="flex items-center gap-2 flex-wrap">{right}</div>}
      </div>
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  desc,
  icon,
  action,
}: {
  title: string;
  desc?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="panel flex flex-col items-center gap-3 px-6 py-14 text-center sm:py-16">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-sunken text-faint">
        {icon ?? <DefaultEmptyIcon />}
      </div>
      <div className="text-base font-medium text-ink">{title}</div>
      {desc && <div className="max-w-md text-sm leading-relaxed text-muted">{desc}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

function DefaultEmptyIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9h.01M15 9h.01M9 15c1 1 2 1.5 3 1.5s2-.5 3-1.5" />
    </svg>
  );
}
