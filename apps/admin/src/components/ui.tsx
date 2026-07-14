import { type ButtonHTMLAttributes, type ReactNode } from 'react';

export function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  const styles = {
    primary: 'bg-brand-500 text-white hover:bg-brand-600',
    ghost: 'bg-transparent text-ink-800 hover:bg-ink-100',
    danger: 'bg-danger text-white hover:opacity-90',
  }[variant];
  return (
    <button
      className={`inline-flex items-center justify-center rounded-lg px-4 py-2 font-semibold transition disabled:opacity-50 ${styles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-ink-200 bg-white p-5 shadow-sm dark:bg-ink-800 ${className}`}>
      {children}
    </div>
  );
}

export function Spinner() {
  return (
    <div
      className="h-6 w-6 animate-spin rounded-full border-2 border-ink-200 border-t-brand-500"
      role="status"
      aria-label="Loading"
    />
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-ink-200 p-10 text-center">
      <p className="text-lg font-semibold text-ink-700">{title}</p>
      {hint && <p className="text-sm text-ink-400">{hint}</p>}
    </div>
  );
}
