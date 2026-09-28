'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useEffect, useState, type ReactNode } from 'react';

import { toErrorMessage } from '@/shared/api/errors';
import { useAuth } from '@/shared/auth/auth-context';
import { RequireAuth } from '@/shared/auth/require-auth';
import { AppShell } from '@/shared/layout/app-shell';
import { Alert, Button, Card, Spinner, StatusPill } from '@/shared/ui';

import { employeesApi } from '@/modules/employees/api';
import { formatDate, formatPaise, initials, tenure } from '@/modules/employees/format';
import type { Employee } from '@/modules/employees/types';

/**
 * REFERENCE MODULE — the detail screen.
 *
 * Note how the sensitive block is rendered: it checks whether the field is
 * present in the response, not just what the current role is. The server has
 * already stripped it, so absence is the source of truth.
 */

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4 sm:py-1.5">
      <dt className="w-56 shrink-0 text-xs text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-900 dark:text-slate-100">{children || '—'}</dd>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
      <dl className="divide-y divide-slate-100 dark:divide-slate-800">{children}</dl>
    </Card>
  );
}

function EmployeeDetail({ id }: { id: string }) {
  const router = useRouter();
  const { hasPermission } = useAuth();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [reports, setReports] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);

  const canManage = hasPermission('employees.manage');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        // Direct reports are supplementary — a failure there must not blank the page.
        const [record, directReports] = await Promise.all([
          employeesApi.getById(id),
          employeesApi.directReports(id).catch(() => []),
        ]);
        if (cancelled) return;
        setEmployee(record);
        setReports(directReports);
      } catch (err) {
        if (!cancelled) setError(toErrorMessage(err));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleDeactivate() {
    if (!employee) return;
    const confirmed = window.confirm(
      `Deactivate ${employee.fullName}? The record is kept — attendance, leave and audit history reference it.`,
    );
    if (!confirmed) return;

    setActionError(null);
    setIsDeactivating(true);

    try {
      await employeesApi.deactivate(employee.id);
      router.push('/employees');
      router.refresh();
    } catch (err) {
      setActionError(toErrorMessage(err));
    } finally {
      setIsDeactivating(false);
    }
  }

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

  // Absence, not role, is the signal — the server already decided.
  const showsSensitive =
    employee.panNumber !== undefined ||
    employee.aadhaarNumber !== undefined ||
    employee.bankAccountNumber !== undefined ||
    employee.annualCtc !== undefined;

  return (
    <div className="space-y-5">
      <Link
        href="/employees"
        className="text-sm text-slate-500 underline-offset-2 hover:underline dark:text-slate-400"
      >
        ← All employees
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F8E6E6] text-lg font-bold text-[#6E1D1D]">
            {initials(employee.fullName)}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                {employee.fullName}
              </h1>
              <StatusPill status={employee.status} />
              {employee.isProfileComplete === false && (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 border border-amber-300">
                  Profile Incomplete
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              {employee.employeeCode} · {employee.designation || 'No designation'} · {employee.department || 'No department'}
            </p>
          </div>
        </div>

        {canManage && (
          <div className="flex gap-2">
            <Link href={`/employees/${employee.id}/edit`}>
              <Button className="bg-[#6E1D1D] hover:bg-[#882424] text-white">
                {employee.isProfileComplete === false ? 'Complete Profile' : 'Edit Profile'}
              </Button>
            </Link>
            <Button variant="secondary" isLoading={isDeactivating} onClick={handleDeactivate}>
              Deactivate
            </Button>
          </div>
        )}
      </div>

      {employee.isProfileComplete === false && canManage && (
        <Alert tone="warning" title="Employee Profile Incomplete">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-xs text-amber-900">
              This employee account was created without complete HR business details. Please enter their Department, Designation, Joining Date, Employment Type, and Mobile.
            </p>
            <Link href={`/employees/${employee.id}/edit`}>
              <Button className="h-8 text-xs bg-[#6E1D1D] hover:bg-[#882424] text-white shrink-0">
                Complete Profile Now
              </Button>
            </Link>
          </div>
        </Alert>
      )}

      {actionError && <Alert tone="error">{actionError}</Alert>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Contact">
          <Row label="Work email">{employee.workEmail}</Row>
          <Row label="Personal email">{employee.personalEmail}</Row>
          <Row label="Mobile">{employee.mobile || '—'}</Row>
          <Row label="Work location">{employee.workLocation || '—'}</Row>
          <Row label="Date of birth">{formatDate(employee.dateOfBirth)}</Row>
          <Row label="Address">{employee.address || '—'}</Row>
        </Panel>

        <Panel title="Employment">
          <Row label="Department">{employee.department || '—'}</Row>
          <Row label="Designation">{employee.designation || '—'}</Row>
          <Row label="Employment type">{employee.employmentType || '—'}</Row>
          <Row label="Date of joining">{formatDate(employee.dateOfJoining)}</Row>
          <Row label="Tenure">{employee.dateOfJoining ? tenure(employee.dateOfJoining) : '—'}</Row>
          <Row label="Date of exit">{formatDate(employee.dateOfExit)}</Row>
          <Row label="Reports to">
            {employee.reportingManager ? (
              <Link
                href={`/employees/${employee.reportingManager.id}`}
                className="underline-offset-2 hover:underline text-[#6E1D1D] font-medium"
              >
                {employee.reportingManager.fullName} · {employee.reportingManager.designation || 'Manager'}
              </Link>
            ) : null}
          </Row>
        </Panel>

        {showsSensitive && (
          <Panel title="Statutory and payroll">
            <Row label="PAN">{employee.panNumber}</Row>
            <Row label="Aadhaar">{employee.aadhaarNumber}</Row>
            <Row label="Bank account">{employee.bankAccountNumber}</Row>
            <Row label="IFSC">{employee.ifsc}</Row>
            <Row label="Annual CTC">
              <span className="font-mono">{formatPaise(employee.annualCtc)}</span>
              <span className="ml-2 text-xs text-slate-400">
                stored as {employee.annualCtc ?? 0} paise
              </span>
            </Row>
          </Panel>
        )}

        <Panel title="Emergency contact">
          <Row label="Name">{employee.emergencyContact?.name}</Row>
          <Row label="Relationship">{employee.emergencyContact?.relationship}</Row>
          <Row label="Mobile">{employee.emergencyContact?.mobile}</Row>
        </Panel>
      </div>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
          Direct reports ({reports.length})
        </h2>
        {reports.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Nobody reports to {employee.fullName.split(' ')[0]}.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {reports.map((report) => (
              <li key={report.id} className="py-2">
                <Link
                  href={`/employees/${report.id}`}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="text-slate-900 dark:text-slate-100">{report.fullName}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {report.designation} · {report.employeeCode}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export default function ViewEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  // Next 16: params is a Promise. In a client component, unwrap it with use().
  const { id } = use(params);

  return (
    <RequireAuth permission="employees.view">
      <EmployeeDetail id={id} />
    </RequireAuth>
  );
}
