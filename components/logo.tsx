import { cn } from '@/lib/utils';

/** AKAASHI wordmark used by Pulse. The red dot is the only brand accent. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('title inline-flex items-baseline whitespace-nowrap leading-none', className)} aria-label="AKAASHI Pulse">
      <span>akaashi</span><span className="text-brand-red">.</span>
      <span className="ml-2 translate-y-[-1px] rounded-[4px] border border-red-line bg-red-bg px-1.5 py-0.5 font-sans text-[9px] font-semibold tracking-[0.14em] text-brand-red">
        PULSE
      </span>
    </span>
  );
}
