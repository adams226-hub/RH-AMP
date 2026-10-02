import { ReactNode } from 'react';

// Remplace le `rounded-xl border border-slate-200 bg-white shadow-sm` dupliqué sur chaque page.
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>;
}
