import type { ReactNode } from 'react';

export function Pill({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-800/70 px-2.5 py-0.5 text-xs font-medium text-zinc-300 ${className}`}>
      {children}
    </span>
  );
}
