'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, X } from 'lucide-react';

import { useAuth, JUST_SIGNED_IN_KEY } from '@/shared/auth/auth-context';
import { cx } from '@/shared/ui';
import { useMyAttendance } from '../hooks/use-attendance';
import { AttendanceWidget } from './attendance-widget';

/**
 * Always-visible punch button in the top bar.
 *
 *   Not checked in  → "Check in"            (pulsing, brand colour)
 *   Working         → "Check out · 6h 24m"  (green dot)
 *   Done for today  → "Done · 8h 10m"
 *   On leave        → "On leave"
 *
 * Clicking it opens the full punch panel (check in/out, breaks) as a dropdown.
 * Right after sign-in — and once a day — if the user hasn't checked in yet,
 * the same panel opens on its own as a reminder.
 */

const REMINDER_DAY_KEY = 'mo.checkInReminderShown';

function localDay(d = new Date()) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function hoursLabel(ms: number) {
  const mins = Math.max(0, Math.floor(ms / 60000));
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
}

function readStorage(storage: 'local' | 'session', key: string): string | null {
  try {
    return (storage === 'local' ? window.localStorage : window.sessionStorage).getItem(key);
  } catch {
    return null;
  }
}

export function AttendanceNavButton() {
  const { user, hasPermission } = useAuth();
  const canPunch = hasPermission('attendance.self');

  const { data, isLoading, mutate } = useMyAttendance();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Should the reminder pop up once data arrives? (fresh sign-in, or first visit today)
  const [reminderPending, setReminderPending] = useState(() => {
    if (typeof window === 'undefined') return false;
    const userKey = `${REMINDER_DAY_KEY}.${user?.id ?? 'anon'}`;
    return readStorage('session', JUST_SIGNED_IN_KEY) === '1' || readStorage('local', userKey) !== localDay();
  });

  const todayRecord = useMemo(() => {
    const today = new Date();
    return (data ?? []).find((r) => {
      const d = new Date(r.date);
      return (
        d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()
      );
    });
  }, [data]);

  const state: 'loading' | 'in' | 'working' | 'done' | 'leave' = isLoading
    ? 'loading'
    : todayRecord?.status === 'Leave'
      ? 'leave'
      : todayRecord?.checkOutTime
        ? 'done'
        : todayRecord?.checkInTime
          ? 'working'
          : 'in';

  // Keep the "6h 24m" label fresh while working
  useEffect(() => {
    if (state !== 'working') return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [state]);

  // Close the dropdown on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const isSunday = new Date().getDay() === 0;
  const showReminder = reminderPending && state === 'in' && !isSunday && !open;

  const dismissReminder = () => {
    setReminderPending(false);
    try {
      window.sessionStorage.removeItem(JUST_SIGNED_IN_KEY);
      window.localStorage.setItem(`${REMINDER_DAY_KEY}.${user?.id ?? 'anon'}`, localDay());
    } catch {
      /* ignore */
    }
  };

  if (!canPunch || !user) return null;

  const worked =
    todayRecord?.checkInTime != null
      ? todayRecord.checkOutTime
        ? new Date(todayRecord.checkOutTime).getTime() - new Date(todayRecord.checkInTime).getTime()
        : now - new Date(todayRecord.checkInTime).getTime()
      : 0;

  const button = {
    loading: { label: '…', sub: null, tone: 'border-[#E6E8EC] text-slate-400 bg-white', dot: null },
    in: {
      label: 'Check in',
      sub: null,
      tone: 'border-[#6E1D1D] bg-[#6E1D1D] text-white hover:bg-[#5a1717]',
      dot: 'bg-white animate-pulse',
    },
    working: {
      label: 'Check out',
      sub: hoursLabel(worked),
      tone: 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
      dot: 'bg-emerald-500 animate-pulse',
    },
    done: {
      label: 'Done',
      sub: todayRecord?.actualHours != null ? hoursLabel(todayRecord.actualHours * 3_600_000) : hoursLabel(worked),
      tone: 'border-[#E6E8EC] bg-white text-slate-600 hover:bg-slate-50',
      dot: 'bg-slate-400',
    },
    leave: { label: 'On leave', sub: null, tone: 'border-blue-200 bg-blue-50 text-blue-700', dot: 'bg-blue-400' },
  }[state];

  const firstName = user.name?.split(' ')[0] ?? '';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <div ref={wrapperRef} className="relative">
        <button
          type="button"
          onClick={() => {
            if (state === 'loading') return;
            setOpen((o) => !o);
            if (reminderPending) dismissReminder();
          }}
          aria-expanded={open}
          title={state === 'in' ? "You haven't checked in today" : 'Attendance'}
          className={cx(
            'h-10 inline-flex items-center gap-2 rounded-full border px-3.5 text-sm font-semibold shadow-sm transition-colors cursor-pointer whitespace-nowrap',
            button.tone
          )}
        >
          {button.dot ? <span className={cx('h-2 w-2 rounded-full', button.dot)} /> : <Clock className="h-4 w-4" />}
          <span className="hidden sm:inline">{button.label}</span>
          {button.sub && <span className="hidden md:inline font-medium opacity-75">· {button.sub}</span>}
          <span className="sm:hidden">
            <Clock className="h-4 w-4" />
          </span>
        </button>

        {open && (
          <div className="absolute right-0 top-12 z-50 w-[min(92vw,380px)] animate-in fade-in zoom-in-95 duration-150 shadow-2xl rounded-xl">
            {/* No overflow clipping here — the break-type dropdown must be able to overlay outside the panel */}
            <AttendanceWidget onChange={() => void mutate()} className="overflow-visible" />
          </div>
        )}
      </div>

      {/* Reminder right after sign-in */}
      {showReminder && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={dismissReminder}
        >
          <div
            role="dialog"
            aria-label="Check in reminder"
            className="w-full max-w-sm animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white rounded-t-2xl px-6 pt-5 pb-3 flex items-start justify-between gap-3 border-b border-slate-100">
              <div>
                <p className="text-base font-bold text-slate-900">
                  {greeting}
                  {firstName ? `, ${firstName}` : ''}! 👋
                </p>
                <p className="text-sm text-slate-600 mt-0.5">You haven&apos;t checked in yet today.</p>
              </div>
              <button
                type="button"
                aria-label="Remind me later"
                onClick={dismissReminder}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <AttendanceWidget
              className="!rounded-t-none !shadow-none"
              onChange={() => {
                void mutate();
                dismissReminder();
              }}
            />
            <button
              type="button"
              onClick={dismissReminder}
              className="mt-3 w-full text-center text-sm font-semibold text-white/90 hover:text-white cursor-pointer"
            >
              Remind me later — the Check in button stays in the top bar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
