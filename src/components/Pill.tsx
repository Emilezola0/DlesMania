import type { ReactNode } from 'react';

export function Pill({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-sm border border-rule-strong bg-card px-2.5 py-0.5 font-display text-[11px] font-semibold tracking-wider text-ink-soft ${className}`}>
      {children}
    </span>
  );
}
