import { cn } from '@/lib/utils';

/** AKAASHI wordmark used by Pulse. The red dot is the only brand accent. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('title inline-flex items-baseline whitespace-nowrap leading-none', className)} aria-label="AKAASHI Pulse">
      <span>akaashi</span><span className="text-brand-red">.</span>
      <span className="ml-2 translate-y-[-1px] rounded-[3px] border border-current/[0.12] bg-current/[0.08] px-1.5 py-[3px] font-sans text-[8px] font-semibold tracking-[0.12em] text-current/[0.72]">
        PULSE
      </span>
    </span>
  );
}
