'use client';

import { useRouter } from 'next/navigation';
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';

interface ClickableTableRowProps {
  href: string;
  ariaLabel: string;
  children: ReactNode;
  className?: string;
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest('a,button,input,select,textarea'));
}

/** Makes a data row behave like the link it contains without invalid table markup. */
export function ClickableTableRow({ href, ariaLabel, children, className = '' }: ClickableTableRowProps) {
  const router = useRouter();

  const navigate = () => router.push(href);
  const handleClick = (event: MouseEvent<HTMLTableRowElement>) => {
    if (!isInteractiveTarget(event.target)) navigate();
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (isInteractiveTarget(event.target)) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      navigate();
    }
  };

  return (
    <tr
      tabIndex={0}
      role="link"
      aria-label={ariaLabel}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`cursor-pointer outline-none transition-colors focus-visible:bg-bg-surface-hi/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand ${className}`}
    >
      {children}
    </tr>
  );
}
