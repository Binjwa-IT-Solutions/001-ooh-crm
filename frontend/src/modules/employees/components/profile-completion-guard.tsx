'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { LogOut, ShieldCheck } from 'lucide-react';

import { useAuth } from '@/shared/auth/auth-context';
import { Alert, Button, Spinner } from '@/shared/ui';
import { employeesApi } from '../api';
import { SelfProfileForm } from './self-profile-form';
import type { Employee } from '../types';

const SKIP_KEY_PREFIX = 'mo.profilePromptSkipped.';

function readSkipped(userId: string | undefined): boolean {
  if (!userId || typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(SKIP_KEY_PREFIX + userId) === '1';
  } catch {
    return false;
  }
}

/**
 * Skippable profile prompt.
 *
 * Shown after sign-in while the employee hasn't filled their own details
 * (`needsSelfProfile`, computed by the server). "Skip for now" hides it until the
 * next sign-in (session storage). The employee only fills personal, emergency
 * contact and statutory/bank details; HR is notified separately to fill the
 * employment fields.
 */
export function ProfileCompletionGuard({ children }: { children: ReactNode }) {
  const { user, refreshUser, signOut } = useAuth();

  const [skippedFor, setSkippedFor] = useState<string | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isLoadingEmployee, setIsLoadingEmployee] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const skipped = skippedFor === user?.id || readSkipped(user?.id);
  const showPrompt = Boolean(user?.needsSelfProfile) && !skipped;

  useEffect(() => {
    if (!showPrompt) return;
    let cancelled = false;

    employeesApi
      .getMine()
      .then((record) => {
        if (!cancelled) setEmployee(record);
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Could not load your profile');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingEmployee(false);
      });

    return () => {
      cancelled = true;
    };
  }, [showPrompt, user?.id]);

  if (!showPrompt || !user) {
    return <>{children}</>;
  }

  function skip() {
    if (!user) return;
    try {
      window.sessionStorage.setItem(SKIP_KEY_PREFIX + user.id, '1');
    } catch {
      // Storage blocked: still hide it for this page view.
    }
    setSkippedFor(user.id);
  }

  const initial: Partial<Employee> = employee ?? {
    fullName: user.name,
    workEmail: user.email,
  };

  return (
    <>
      <div className="pointer-events-none select-none opacity-20 blur-[1px] filter">{children}</div>

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-completion-title"
        className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/75 p-4 backdrop-blur-sm sm:p-6"
      >
        <div className="relative my-8 w-full max-w-3xl overflow-hidden rounded-2xl border border-[#E6E8EC] bg-white shadow-2xl">
          <div className="bg-gradient-to-r from-[#6E1D1D] to-[#882424] px-6 py-5 text-white">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <h2 id="profile-completion-title" className="text-lg font-bold tracking-tight">
                    Complete Your Profile
                  </h2>
                  <p className="text-xs text-white/80">
                    Add your personal and bank details. You can skip this for now.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => signOut()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white/90 transition-colors hover:bg-white/20"
                title="Sign out of current account"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>

          <div className="no-scrollbar max-h-[calc(85vh-140px)] overflow-y-auto p-6 sm:p-8">
            <div className="space-y-6">
              <Alert tone="info" title="Your details">
                <p className="text-xs leading-relaxed">
                  Fill in what you can. Your department, designation, joining date and salary are
                  set by HR, who have been notified. If you skip, you&apos;ll be reminded at your
                  next sign-in.
                </p>
              </Alert>

              {loadError && (
                <Alert tone="warning" title="Note">
                  <p className="text-xs">
                    Could not load your saved details ({loadError}). You can still fill them in.
                  </p>
                </Alert>
              )}

              {isLoadingEmployee ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                  <Spinner className="h-8 w-8 text-[#6E1D1D]" />
                  <p className="mt-3 text-sm font-medium text-slate-700">Loading your profile…</p>
                </div>
              ) : (
                <SelfProfileForm
                  key={employee?.id ?? 'new'}
                  employee={initial}
                  onSaved={async () => {
                    await refreshUser();
                  }}
                  secondaryAction={
                    <Button type="button" variant="secondary" onClick={skip}>
                      Skip for now
                    </Button>
                  }
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
