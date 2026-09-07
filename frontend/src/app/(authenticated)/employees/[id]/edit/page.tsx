'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';

import { toErrorMessage } from '@/shared/api/errors';
import { RequireAuth } from '@/shared/auth/require-auth';
import { AppShell } from '@/shared/layout/app-shell';
import { Alert, Button, Spinner } from '@/shared/ui';

import { employeesApi } from '@/modules/employees/api';
import { EmployeeForm } from '@/modules/employees/components/employee-form';
import type { Employee } from '@/modules/employees/types';

/**
 * REFERENCE MODULE — edit screen.
 *
 * Same form component as the create screen; passing `employee` switches it to
 * edit mode. Duplicating the form for edit is how the two drift apart.
 */
function EditEmployee({ id }: { id: string }) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    employeesApi
      .getById(id)
      .then((record) => {
        if (!cancelled) setEmployee(record);
      })
      .catch((err) => {
        if (!cancelled) setError(toErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner label="Loading employee…" />
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="space-y-4">
        <Alert tone="error" title="Could not load this employee">
          {error ?? 'Not found'}
        </Alert>
        <Link href="/employees">
          <Button variant="secondary">Back to employees</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <Link
          href={`/employees/${employee.id}`}
          className="text-sm text-slate-500 underline-offset-2 hover:underline dark:text-slate-400"
        >
          ← Back to {employee.fullName}
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          Edit {employee.fullName}
        </h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          {employee.employeeCode} — the employee code cannot be changed.
        </p>
      </div>

      <EmployeeForm employee={employee} />
    </div>
  );
}

export default function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <RequireAuth permission="employees.manage">
      <EditEmployee id={id} />
    </RequireAuth>
  );
}
