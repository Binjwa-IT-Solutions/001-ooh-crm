'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Users as UsersIcon, Plus, Search, ShieldCheck, ChevronRight } from 'lucide-react';

import { useAuth } from '@/shared/auth/auth-context';
import { RequireAuth } from '@/shared/auth/require-auth';
import { Alert, Button, Card, EmptyState, SelectField, Spinner, StatusPill } from '@/shared/ui';

import { useUserList } from '@/modules/users/hooks/use-users';
import { ROLES, ROLE_LABELS, USER_STATUSES, type Role, type UserListQuery, type UserStatus } from '@/modules/users/types';

const PAGE_SIZE = 10;

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Never';
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function UsersContent() {
  const router = useRouter();
  const { hasPermission } = useAuth();

  const [search, setSearch] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  const [status, setStatus] = useState<UserStatus | ''>('');
  const [page, setPage] = useState(1);

  const { data, isLoading, error, reload } = useUserList({
    search: search.trim() || undefined,
    role: role || undefined,
    status: status || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const canCreate = hasPermission('users.create');
  const hasFilters = search.trim() !== '' || role !== '' || status !== '';

  function updateFilter(apply: () => void) {
    apply();
    setPage(1);
  }

  function clearFilters() {
    setSearch('');
    setRole('');
    setStatus('');
    setPage(1);
  }

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <UsersIcon className="h-6 w-6 text-[#6E1D1D]" />
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              User Management
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {data ? `${data.total} user account${data.total === 1 ? '' : 's'} registered in the CRM` : 'Manage system users and access roles'}
          </p>
        </div>

        {canCreate && (
          <Link href="/users/new">
            <Button className="bg-[#6E1D1D] hover:bg-[#882424] text-white flex items-center gap-2 shadow-sm">
              <Plus className="h-4 w-4" />
              <span>Create User</span>
            </Button>
          </Link>
        )}
      </div>

      {/* Filters */}
      <Card className="border border-[#E6E8EC]">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label
              htmlFor="user-search"
              className="block text-sm font-medium text-slate-700"
            >
              Search Users
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id="user-search"
                type="search"
                placeholder="Name or email address"
                value={search}
                onChange={(e) => updateFilter(() => setSearch(e.target.value))}
                className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#6E1D1D]"
              />
            </div>
          </div>

          <SelectField
            label="Role"
            placeholder="All roles"
            options={ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
            value={role}
            onChange={(e) => updateFilter(() => setRole(e.target.value as Role))}
          />

          <SelectField
            label="Status"
            placeholder="All statuses"
            options={USER_STATUSES.map((s) => ({ value: s, label: s }))}
            value={status}
            onChange={(e) => updateFilter(() => setStatus(e.target.value as UserStatus))}
          />
        </div>
      </Card>

      {/* Error state */}
      {error && (
        <Alert tone="error" title="Could not load users">
          <p>{error}</p>
          <div className="mt-3">
            <Button variant="secondary" onClick={reload} className="h-9 px-3">
              Try again
            </Button>
          </div>
        </Alert>
      )}

      {/* Loading state */}
      {isLoading && !data && (
        <Card className="border border-[#E6E8EC]">
          <div className="flex justify-center py-12">
            <Spinner label="Loading users…" />
          </div>
        </Card>
      )}

      {/* Empty states */}
      {!isLoading && !error && data?.users.length === 0 && (
        <EmptyState
          title={hasFilters ? 'No users match those filters' : 'No users registered yet'}
          description={
            hasFilters
              ? 'Try a different search term, or clear the filters to view all users.'
              : canCreate
                ? 'Create the first CRM user account.'
                : 'No CRM users found.'
          }
          action={
            hasFilters ? (
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : canCreate ? (
              <Link href="/users/new">
                <Button className="bg-[#6E1D1D] text-white">Create user</Button>
              </Link>
            ) : undefined
          }
        />
      )}

      {/* Results table */}
      {data && data.users.length > 0 && (
        <>
          {/* Desktop Table */}
          <Card className="hidden overflow-x-auto p-0 sm:block border border-[#E6E8EC]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#E6E8EC] bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">User</th>
                  <th className="px-5 py-3.5 font-semibold">Role</th>
                  <th className="px-5 py-3.5 font-semibold">Status</th>
                  <th className="px-5 py-3.5 font-semibold">Last Login</th>
                  <th className="px-5 py-3.5 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.users.map((user) => (
                  <tr
                    key={user.id}
                    onClick={() => router.push(`/users/${user.id}`)}
                    className="transition-colors hover:bg-[#F8E6E6]/30 cursor-pointer group"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F8E6E6] text-xs font-bold text-[#6E1D1D] group-hover:scale-105 transition-transform">
                          {initials(user.name)}
                        </span>
                        <div>
                          <span className="block font-semibold text-slate-900 group-hover:text-[#6E1D1D] transition-colors">
                            {user.name}
                          </span>
                          <span className="block text-xs text-slate-500">
                            {user.email}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        <ShieldCheck className="h-3.5 w-3.5 text-slate-500" />
                        {ROLE_LABELS[user.role] ?? user.role}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusPill status={user.status} />
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500">
                      {formatDate(user.lastLoginAt)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/users/${user.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold text-[#6E1D1D] hover:bg-[#F8E6E6] transition-colors"
                      >
                        <span>Manage</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Mobile Cards */}
          <div className="space-y-3 sm:hidden">
            {data.users.map((user) => (
              <Link
                key={user.id}
                href={`/users/${user.id}`}
                className="block transition-transform active:scale-[0.99]"
              >
                <Card className="p-4 border border-[#E6E8EC] hover:border-[#6E1D1D]/40 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F8E6E6] text-xs font-bold text-[#6E1D1D]">
                        {initials(user.name)}
                      </span>
                      <div>
                        <p className="font-semibold text-slate-900">{user.name}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </div>
                    </div>
                    <StatusPill status={user.status} />
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs text-slate-500">
                    <span className="font-medium text-slate-700">{ROLE_LABELS[user.role]}</span>
                    <span className="flex items-center gap-1 text-[#6E1D1D] font-semibold">
                      <span>View</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-xs text-slate-500">
              Page {data.page} of {data.totalPages} · {data.total} total
              {isLoading && ' · updating…'}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="h-9 px-3 text-xs"
                disabled={data.page <= 1 || isLoading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                className="h-9 px-3 text-xs"
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

export default function UsersPage() {
  return (
    <RequireAuth permission="users.view">
      <UsersContent />
    </RequireAuth>
  );
}
