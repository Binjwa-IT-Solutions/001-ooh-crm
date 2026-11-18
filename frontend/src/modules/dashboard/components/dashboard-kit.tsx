import Link from 'next/link';
import type { ComponentType, ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';

import { cx } from '@/shared/ui';

/** Small building blocks shared by the role dashboards so they all look the same. */

type Tone = 'brand' | 'emerald' | 'amber' | 'rose' | 'blue' | 'slate' | 'violet';

const TONE: Record<Tone, { icon: string; value: string }> = {
  brand: { icon: 'bg-[#F8E6E6] text-[#6E1D1D]', value: 'text-slate-900' },
  emerald: { icon: 'bg-emerald-50 text-emerald-600', value: 'text-slate-900' },
  amber: { icon: 'bg-amber-50 text-amber-600', value: 'text-slate-900' },
  rose: { icon: 'bg-rose-50 text-rose-600', value: 'text-slate-900' },
  blue: { icon: 'bg-blue-50 text-blue-600', value: 'text-slate-900' },
  slate: { icon: 'bg-slate-100 text-slate-600', value: 'text-slate-900' },
  violet: { icon: 'bg-violet-50 text-violet-600', value: 'text-slate-900' },
};

export function Panel({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: { href: string; label: string };
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx('bg-white rounded-2xl border border-gray-200/80 shadow-xs p-5 flex flex-col', className)}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {action && (
          <Link
            href={action.href}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#6E1D1D] hover:underline shrink-0"
          >
            {action.label} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      <div className="flex-1">{children}</div>
    </section>
  );
}

export function Stat({
  icon: Icon,
  tone = 'slate',
  label,
  value,
  hint,
  href,
}: {
  icon: ComponentType<{ className?: string }>;
  tone?: Tone;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  href?: string;
}) {
  const t = TONE[tone];
  const body = (
    <div
      className={cx(
        'h-full bg-white rounded-2xl border border-gray-200/80 shadow-xs p-4 flex gap-3',
        href && 'hover:border-gray-300 hover:shadow-sm transition-all'
      )}
    >
      <div className={cx('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', t.icon)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <p className={cx('text-2xl font-bold leading-tight mt-0.5', t.value)}>{value}</p>
        {hint && <div className="text-[11px] text-slate-500 mt-1 leading-snug">{hint}</div>}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

export function Row({ left, sub, right, tone }: { left: ReactNode; sub?: ReactNode; right?: ReactNode; tone?: 'rose' | 'amber' }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 last:border-0">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-800 truncate">{left}</p>
        {sub && <p className="text-[11px] text-slate-500 truncate">{sub}</p>}
      </div>
      {right && (
        <span
          className={cx(
            'text-[11px] font-semibold shrink-0',
            tone === 'rose' ? 'text-rose-700' : tone === 'amber' ? 'text-amber-700' : 'text-slate-600'
          )}
        >
          {right}
        </span>
      )}
    </li>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-xs text-slate-400 py-4 text-center">{children}</p>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">{children}</h2>;
}

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center justify-between">
      <span>{message}</span>
      <button onClick={onRetry} className="px-2.5 py-1 bg-red-100 hover:bg-red-200 rounded-md font-semibold">
        Retry
      </button>
    </div>
  );
}

export function Skeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="space-y-4 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-28 bg-gray-100 rounded-2xl" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function fmtDay(value: string | Date, withWeekday = true): string {
  return new Date(value).toLocaleDateString('en-GB', {
    ...(withWeekday ? { weekday: 'short' } : {}),
    day: 'numeric',
    month: 'short',
  });
}

/** "Today", "Tomorrow", "Fri 21 Nov" */
export function relDay(value: string | Date): string {
  const d = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const that = new Date(d);
  that.setHours(0, 0, 0, 0);
  const diff = Math.round((that.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return fmtDay(d);
}

export function fmtRange(from: string, to: string): string {
  const a = fmtDay(from, false);
  const b = fmtDay(to, false);
  return a === b ? a : `${a} – ${b}`;
}

export function fmtTime(value?: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function fmtClock(minutesOfDay: number | null | undefined): string {
  if (minutesOfDay == null) return '—';
  const d = new Date();
  d.setHours(Math.floor(minutesOfDay / 60), Math.round(minutesOfDay % 60), 0, 0);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function fmtMins(mins: number | null | undefined): string {
  if (mins == null) return '—';
  const m = Math.round(mins);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

export function plural(n: number, word: string, pluralWord = `${word}s`) {
  return `${n} ${n === 1 ? word : pluralWord}`;
}
