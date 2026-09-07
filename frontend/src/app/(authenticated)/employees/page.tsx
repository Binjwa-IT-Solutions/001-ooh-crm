'use client';

import Link from 'next/link';
import { useState } from 'react';

import { useAuth } from '@/shared/auth/auth-context';
import { RequireAuth } from '@/shared/auth/require-auth';
import { AppShell } from '@/shared/layout/app-shell';
import { Alert, Button, Card, EmptyState, SelectField, Spinner, StatusPill } from '@/shared/ui';

import { useEmployeeList } from '@/modules/employees/hooks/use-employees';
import { formatDate, formatPaise, initials } from '@/modules/employees/format';
import { DEPARTMENTS, EMPLOYEE_STATUSES, type EmployeeListQuery } from '@/modules/employees/types';

/**
 * REFERENCE MODULE — the list screen.
 *
 * Copy the shape of this, not just the markup:
 *   · filtering, sorting and paging happen on the server — never fetch
 *     everything and filter in the browser
 *   · loading, error and two distinct empty states are all handled
 *   · the layout works on a phone (cards) and a desktop (table)
 */

const PAGE_SIZE = 10;

function EmployeesContent() {
  const { hasPermission } = useAuth();

  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState<EmployeeListQuery['department']>('');
  const [status, setStatus] = useState<EmployeeListQuery['status']>('');
  const [page, setPage] = useState(1);

  const { data, isLoading, error, reload } = useEmployeeList({
    search: search.trim() || undefined,
    department,
    status,
    page,
    pageSize: PAGE_SIZE,
    sortBy: 'fullName',
  });

  const canManage = hasPermission('employees.manage');
  const showsMoney = hasPermission('employees.sensitive');
  const hasFilters = search.trim() !== '' || department !== '' || status !== '';

  function updateFilter(apply: () => void) {
    apply();
    setPage(1); // a new filter always starts at page one
  }

  function clearFilters() {
    setSearch('');
    setDepartment('');
    setStatus('');
    setPage(1);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Employees
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {data ? `${data.total} record${data.total === 1 ? '' : 's'}` : 'Employee master'}
          </p>
        </div>

        {canManage && (
          <Link href="/employees/new">
            <Button>Add employee</Button>
          </Link>
        )}
      </div>

      <Card>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label
              htmlFor="employee-search"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Search
            </label>
            <input
              id="employee-search"
              type="search"
              placeholder="Name, code, email or mobile"
              value={search}
              onChange={(e) => updateFilter(() => setSearch(e.target.value))}
              className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-300"
            />
          </div>

          <SelectField
            label="Department"
            placeholder="All departments"
            options={DEPARTMENTS.map((d) => ({ value: d, label: d }))}
            value={department}
            onChange={(e) =>
              updateFilter(() => setDepartment(e.target.value as EmployeeListQuery['department']))
            }
          />

          <SelectField
            label="Status"
            placeholder="All statuses"
            options={EMPLOYEE_STATUSES.map((s) => ({ value: s, label: s }))}
            value={status}
            onChange={(e) =>
              updateFilter(() => setStatus(e.target.value as EmployeeListQuery['status']))
            }
          />
        </div>
      </Card>

      {/* --- Error state --- */}
      {error && (
        <Alert tone="error" title="Could not load employees">
          <p>{error}</p>
          <div className="mt-3">
            <Button variant="secondary" onClick={reload} className="h-9 px-3">
              Try again
            </Button>
          </div>
        </Alert>
      )}

      {/* --- Loading state --- */}
      {isLoading && !data && (
        <Card>
          <div className="flex justify-center py-10">
            <Spinner label="Loading employees…" />
          </div>
        </Card>
      )}

      {/* --- Empty states: no records at all vs no search results --- */}
      {!isLoading && !error && data?.employees.length === 0 && (
        <EmptyState
          title={hasFilters ? 'No employees match those filters' : 'No employees yet'}
          description={
            hasFilters
              ? 'Try a different search term, or clear the filters to see everyone.'
              : canManage
                ? 'Add your first employee, or run `npm run seed` in the backend for demo data.'
                : 'Nothing has been added to the employee master yet.'
          }
          action={
            hasFilters ? (
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : canManage ? (
              <Link href="/employees/new">
                <Button>Add employee</Button>
              </Link>
            ) : undefined
          }
        />
      )}

      {/* --- Results --- */}
      {data && data.employees.length > 0 && (
        <>
          {/* Desktop: table */}
          <Card className="hidden overflow-x-auto p-0 sm:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="px-4 py-3 font-medium">Department</th>
                  <th className="px-4 py-3 font-medium">Reports to</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                  {showsMoney && <th className="px-4 py-3 text-right font-medium">Annual CTC</th>}
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.employees.map((employee) => (
                  <tr
                    key={employee.id}
                    className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <td className="px-4 py-3">
                      <Link href={`/employees/${employee.id}`} className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {initials(employee.fullName)}
                        </span>
                        <span>
                          <span className="block font-medium text-slate-900 dark:text-slate-100">
                            {employee.fullName}
                          </span>
                          <span className="block text-xs text-slate-500 dark:text-slate-400">
                            {employee.employeeCode} · {employee.designation}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {employee.department}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {employee.reportingManager?.fullName ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {formatDate(employee.dateOfJoining)}
                    </td>
                    {showsMoney && (
                      <td className="px-4 py-3 text-right font-mono text-xs text-slate-600 dark:text-slate-400">
                        {formatPaise(employee.annualCtc)}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <StatusPill status={employee.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Mobile: cards. Field staff are on phones — this is not optional. */}
          <div className="space-y-3 sm:hidden">
            {data.employees.map((employee) => (
              <Link key={employee.id} href={`/employees/${employee.id}`} className="block">
                <Card className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {employee.fullName}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {employee.employeeCode} · {employee.designation}
                      </p>
                    </div>
                    <StatusPill status={employee.status} />
                  </div>
                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                    {employee.department} · {employee.workLocation} · joined{' '}
                    {formatDate(employee.dateOfJoining)}
                  </p>
                </Card>
              </Link>
            ))}
          </div>

          {/* Pagination — server-side, always */}
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Page {data.page} of {data.totalPages} · {data.total} total
              {isLoading && ' · updating…'}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="h-9 px-3"
                disabled={data.page <= 1 || isLoading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                className="h-9 px-3"
                disabled={data.page >= data.totalPages || isLoading}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function EmployeesPage() {
  return (
    <RequireAuth permission="employees.view">
      <EmployeesContent />
    </RequireAuth>
  );
}
