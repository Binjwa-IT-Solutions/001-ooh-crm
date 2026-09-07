'use client';

import Link from 'next/link';

import { RequireAuth } from '@/shared/auth/require-auth';
import { AppShell } from '@/shared/layout/app-shell';

import { EmployeeForm } from '@/modules/employees/components/employee-form';

/** REFERENCE MODULE — create screen. Guarded by the same permission as the API. */
export default function NewEmployeePage() {
  return (
    <RequireAuth permission="employees.manage">
      <div className="space-y-5">
          <div>
            <Link
              href="/employees"
              className="text-sm text-slate-500 underline-offset-2 hover:underline dark:text-slate-400"
            >
              ← All employees
            </Link>
            <h1 className="mt-2 text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              Add employee
            </h1>
          </div>

          <EmployeeForm />
        </div>
    </RequireAuth>
  );
}
