'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ShieldAlert, LogOut, CheckCircle2, ShieldCheck } from 'lucide-react';

import { useAuth } from '@/shared/auth/auth-context';
import { Alert, Spinner } from '@/shared/ui';
import { employeesApi } from '../api';
import { EmployeeForm } from './employee-form';
import type { Employee } from '../types';

/**
 * Mandatory Profile Completion Guard.
 *
 * Ensures newly created or incomplete users must fill out their employee profile
 * before accessing the CRM dashboard and authenticated modules.
 *
 * Authoritative: Driven by the user's linked Employee record completion status
 * from the backend, not by fragile client flags.
 */
export function ProfileCompletionGuard({ children }: { children: ReactNode }) {
  const { user, refreshUser, signOut } = useAuth();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isLoadingEmployee, setIsLoadingEmployee] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const isIncomplete = Boolean(user && user.isProfileComplete === false);

  useEffect(() => {
    let cancelled = false;

    if (!isIncomplete) {
      return;
    }

    setIsLoadingEmployee(true);
    setLoadError(null);

    employeesApi
      .getMine()
      .then((record) => {
        if (!cancelled) {
          setEmployee(record);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn('[ProfileCompletionGuard] Could not load linked employee record:', err);
          setLoadError(err instanceof Error ? err.message : 'Could not load existing profile');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingEmployee(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isIncomplete, user?.id]);

  // If user profile is complete or not loaded yet, render normally
  if (!isIncomplete) {
    return <>{children}</>;
  }

  // Fallback employee object pre-filled with user info if getMine fails or returns null
  const fallbackEmployee: Partial<Employee> = employee ?? {
    fullName: user?.name || '',
    workEmail: user?.email || '',
    status: 'Active',
  };

  return (
    <>
      {/* Background content rendered underneath */}
      <div className="pointer-events-none select-none opacity-20 filter blur-[1px]">
        {children}
      </div>

      {/* Mandatory Modal Overlay */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-completion-title"
        className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/75 p-4 backdrop-blur-sm sm:p-6"
      >
        <div className="relative my-8 w-full max-w-3xl overflow-hidden rounded-2xl border border-[#E6E8EC] bg-white shadow-2xl transition-all">
          {/* Maroon Branded Header */}
          <div className="bg-gradient-to-r from-[#6E1D1D] to-[#882424] px-6 py-5 text-white">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur-sm">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <h2 id="profile-completion-title" className="text-lg font-bold tracking-tight text-white">
                    Complete Your Profile
                  </h2>
                  <p className="text-xs text-white/80">
                    Please complete your employee profile before continuing to the CRM dashboard.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => signOut()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white/90 hover:bg-white/20 transition-colors"
                title="Sign out of current account"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="max-h-[calc(85vh-140px)] overflow-y-auto p-6 sm:p-8 no-scrollbar">
            <div className="space-y-6">
              <Alert tone="warning" title="Mandatory First-Time Setup">
                <p className="text-xs text-amber-900 leading-relaxed">
                  Your account was created by HR / Admin. To activate your access to all modules, please verify and fill in your essential employee details (Department, Designation, Mobile, Work Location, and Date of Joining).
                </p>
              </Alert>

              {loadError && (
                <Alert tone="warning" title="Note">
                  <p className="text-xs text-amber-800">
                    Could not fetch previous draft details ({loadError}). You can fill in your details below to activate your account.
                  </p>
                </Alert>
              )}

              {isLoadingEmployee ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                  <Spinner className="h-8 w-8 text-[#6E1D1D]" />
                  <p className="mt-3 text-sm font-medium text-slate-700">Loading your employee profile...</p>
                </div>
              ) : (
                <EmployeeForm
                  employee={(employee ?? fallbackEmployee) as Employee}
                  isSelfCompletion={true}
                  hideCancel={true}
                  submitLabel="Complete Profile & Continue"
                  onSuccess={async () => {
                    await refreshUser();
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
