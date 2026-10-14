'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, useEffect } from 'react';
import { Users, Plus, ShieldCheck, CreditCard } from 'lucide-react';

import { useAuth } from '@/shared/auth/auth-context';
import { RequireAuth } from '@/shared/auth/require-auth';
import { Alert, Button, Card, EmptyState, SelectField, Spinner, StatusPill, cx } from '@/shared/ui';

import { useEmployeeList } from '@/modules/employees/hooks/use-employees';
import { formatDate, formatPaise, initials } from '@/modules/employees/format';
import { DEPARTMENTS, EMPLOYEE_STATUSES, type EmployeeListQuery } from '@/modules/employees/types';
import { UserForm } from '@/modules/users/components/user-form';
import { TeamManagementView } from '@/modules/employees/components/team-management-view';

const PAGE_SIZE = 10;
type EmployeeTab = 'employees' | 'user-creation' | 'team-management';

function EmployeesMasterView() {
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
  const canViewSalary = hasPermission('salary.view');
  const showsMoney = hasPermission('employees.sensitive');
  const hasFilters = search.trim() !== '' || department !== '' || status !== '';

  function updateFilter(apply: () => void) {
    apply();
    setPage(1);
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
          <p className="text-sm font-medium text-slate-500">
            {data ? `${data.total} record${data.total === 1 ? '' : 's'} registered in employee master` : 'Employee master'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {canViewSalary && (
            <Link href="/hr/salary">
              <Button
                variant="secondary"
                className="border-slate-300 text-slate-700 hover:text-[#6E1D1D] hover:bg-[#F8E6E6]/40 flex items-center gap-1.5"
              >
                <CreditCard className="h-4 w-4 text-[#6E1D1D]" />
                Salary Management
              </Button>
            </Link>
          )}

          {canManage && (
            <Link href="/employees/new">
              <Button className="bg-[#6E1D1D] hover:bg-[#882424] text-white">Add employee</Button>
            </Link>
          )}
        </div>
      </div>

      <Card className="border border-[#E6E8EC]">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label
              htmlFor="employee-search"
              className="block text-sm font-medium text-slate-700"
            >
              Search
            </label>
            <input
              id="employee-search"
              type="search"
              placeholder="Name, code, email or mobile"
              value={search}
              onChange={(e) => updateFilter(() => setSearch(e.target.value))}
              className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#6E1D1D]"
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
        <Card className="border border-[#E6E8EC]">
          <div className="flex justify-center py-10">
            <Spinner label="Loading employees…" />
          </div>
        </Card>
      )}

      {/* --- Empty states --- */}
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
                <Button className="bg-[#6E1D1D] text-white">Add employee</Button>
              </Link>
            ) : undefined
          }
        />
      )}

      {/* --- Results --- */}
      {data && data.employees.length > 0 && (
        <>
          {/* Desktop: table */}
          <Card className="hidden overflow-x-auto p-0 sm:block border border-[#E6E8EC]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#E6E8EC] bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="px-4 py-3 font-medium">Department</th>
                  <th className="px-4 py-3 font-medium">Reports to</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                  {showsMoney && <th className="px-4 py-3 text-right font-medium">Annual CTC</th>}
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.employees.map((employee) => (
                  <tr
                    key={employee.id}
                    className="transition-colors hover:bg-[#F8E6E6]/30"
                  >
                    <td className="px-4 py-3">
                      <Link href={`/employees/${employee.id}`} className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F8E6E6] text-xs font-semibold text-[#6E1D1D]">
                          {initials(employee.fullName)}
                        </span>
                        <span>
                          <span className="block font-medium text-slate-900">
                            {employee.fullName}
                          </span>
                          <span className="block text-xs text-slate-500">
                            {employee.employeeCode}
                            {employee.designation ? ` · ${employee.designation}` : ' · Profile Incomplete'}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {employee.department || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {employee.reportingManager?.fullName ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDate(employee.dateOfJoining)}
                    </td>
                    {showsMoney && (
                      <td className="px-4 py-3 text-right font-mono text-xs text-slate-600">
                        {formatPaise(employee.annualCtc)}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <StatusPill status={employee.status} />
                        {employee.isProfileComplete === false && (
                          <span className="inline-flex items-center rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 border border-amber-200">
                            Incomplete
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Mobile: cards */}
          <div className="space-y-3 sm:hidden">
            {data.employees.map((employee) => (
              <Link key={employee.id} href={`/employees/${employee.id}`} className="block">
                <Card className="p-4 border border-[#E6E8EC]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">
                        {employee.fullName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {employee.employeeCode}
                        {employee.designation ? ` · ${employee.designation}` : ' · Profile Incomplete'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <StatusPill status={employee.status} />
                      {employee.isProfileComplete === false && (
                        <span className="inline-flex items-center rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 border border-amber-200">
                          Incomplete
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    {employee.department || 'No department'} · {employee.workLocation || 'No location'} · joined{' '}
                    {formatDate(employee.dateOfJoining)}
                  </p>
                </Card>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
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

function EmployeesTabsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as EmployeeTab | null;

  const { user, hasPermission } = useAuth();
  const canCreateUsers = hasPermission('users.create') || user?.role === 'admin' || user?.role === 'hr';
  const canViewSalary = hasPermission('salary.view');

  const [activeTab, setActiveTab] = useState<EmployeeTab>(() => {
    if (tabParam && ['employees', 'user-creation', 'team-management'].includes(tabParam)) {
      if (tabParam === 'user-creation' && !canCreateUsers) return 'employees';
      return tabParam;
    }
    return 'employees';
  });

  useEffect(() => {
    if (tabParam && ['employees', 'user-creation', 'team-management'].includes(tabParam)) {
      if (tabParam === 'user-creation' && !canCreateUsers) {
        setActiveTab('employees');
      } else {
        setActiveTab(tabParam);
      }
    }
  }, [tabParam, canCreateUsers]);

  const handleTabChange = (tab: EmployeeTab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(window.location.search);
    if (tab === 'employees') {
      params.delete('tab');
    } else {
      params.set('tab', tab);
    }
    const query = params.toString();
    router.replace(`/employees${query ? `?${query}` : ''}`, { scroll: false });
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Internal Tab Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-[#E6E8EC]">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Employees
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage organization directory, user registration, and team reporting structure
          </p>
        </div>

        {/* Module Sub-Tabs */}
        <div className="inline-flex rounded-lg border border-[#E6E8EC] bg-slate-50/80 p-1 shadow-sm">
          <button
            type="button"
            onClick={() => handleTabChange('employees')}
            className={cx(
              'inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all',
              activeTab === 'employees'
                ? 'bg-[#6E1D1D] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white'
            )}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Employees</span>
          </button>

          {canCreateUsers && (
            <button
              type="button"
              onClick={() => handleTabChange('user-creation')}
              className={cx(
                'inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all',
                activeTab === 'user-creation'
                  ? 'bg-[#6E1D1D] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              )}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>User Creation</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleTabChange('team-management')}
            className={cx(
              'inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all',
              activeTab === 'team-management'
                ? 'bg-[#6E1D1D] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white'
            )}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Team Management</span>
          </button>
        </div>
      </div>

      {/* Tab Content Display */}
      {activeTab === 'employees' && <EmployeesMasterView />}

      {activeTab === 'user-creation' && canCreateUsers && (
        <div className="space-y-4">
          <UserForm
            onSuccess={() => {
              // Switch back to employees list on successful creation
              handleTabChange('employees');
            }}
            onCancel={() => handleTabChange('employees')}
          />
        </div>
      )}

      {activeTab === 'team-management' && (
        <TeamManagementView
          onNavigateToUserCreation={() => handleTabChange('user-creation')}
        />
      )}
    </div>
  );
}

export default function EmployeesPage() {
  return (
    <RequireAuth permission="employees.view">
      <Suspense
        fallback={
          <div className="flex min-h-[40vh] items-center justify-center">
            <Spinner label="Loading HR Employees…" />
          </div>
        }
      >
        <EmployeesTabsContent />
      </Suspense>
    </RequireAuth>
  );
}
