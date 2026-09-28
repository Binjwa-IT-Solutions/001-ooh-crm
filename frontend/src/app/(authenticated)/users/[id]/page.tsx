'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  Pencil,
  ShieldCheck,
  Calendar,
  Clock,
  Mail,
} from 'lucide-react';

import { useAuth } from '@/shared/auth/auth-context';
import { RequireAuth } from '@/shared/auth/require-auth';
import { Alert, Button, Card, Field, Modal, SelectField, Spinner, StatusPill } from '@/shared/ui';
import { toErrorMessage } from '@/shared/api/errors';

import { usersApi } from '@/modules/users/api';
import {
  ROLES,
  ROLE_LABELS,
  USER_STATUSES,
  type Role,
  type User,
  type UserStatus,
} from '@/modules/users/types';
import { useManagerOptions } from '@/modules/employees/hooks/use-employees';

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

function UserDetailsContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const { options: managerOptionsList, isLoading: managersLoading } = useManagerOptions();

  const userId = params.id;
  const canUpdate = hasPermission('users.update');

  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<Role>('employee');
  const [editStatus, setEditStatus] = useState<UserStatus>('Active');
  const [editManagerId, setEditManagerId] = useState<string>('');
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Notification banners
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(
    null,
  );

  // Reset Password Modal state
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  // Status Confirmation Modal state
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<UserStatus>('Inactive');
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    usersApi
      .getById(userId)
      .then((res) => {
        if (!cancelled) {
          setUser(res);
          setEditName(res.name);
          setEditRole(res.role);
          setEditStatus(res.status);
          setEditManagerId(res.reportingManagerId || '');
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(toErrorMessage(err));
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const roleOptions = ROLES.map((role) => ({
    value: role,
    label: ROLE_LABELS[role],
  }));

  const statusOptions = USER_STATUSES.map((status) => ({
    value: status,
    label: status,
  }));

  const managerOptions = [
    { value: '', label: managersLoading ? 'Loading managers...' : 'None (No reporting manager)' },
    ...managerOptionsList.map((m) => ({
      value: m.id,
      label: `${m.fullName} — ${m.designation || 'Manager'} (${m.employeeCode})`,
    })),
  ];

  function handleStartEdit() {
    if (!user) return;
    setEditName(user.name);
    setEditRole(user.role);
    setEditStatus(user.status);
    setEditManagerId(user.reportingManagerId || '');
    setEditErrors({});
    setIsEditing(true);
  }

  function handleCancelEdit() {
    if (!user) return;
    setEditName(user.name);
    setEditRole(user.role);
    setEditStatus(user.status);
    setEditManagerId(user.reportingManagerId || '');
    setEditErrors({});
    setIsEditing(false);
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;

    const errors: Record<string, string> = {};
    if (!editName.trim()) {
      errors.name = 'Full name is required';
    } else if (editName.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters';
    }

    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    try {
      const updated = await usersApi.update(user.id, {
        name: editName.trim(),
        role: editRole,
        status: editStatus,
        reportingManagerId: editManagerId || null,
      });

      setUser(updated);
      setIsEditing(false);
      setFeedback({ tone: 'success', message: 'User account details updated successfully.' });
    } catch (err) {
      setFeedback({ tone: 'error', message: toErrorMessage(err) });
    } finally {
      setIsSaving(false);
    }
  }

  function openStatusModal(newStatus: UserStatus) {
    setTargetStatus(newStatus);
    setIsStatusModalOpen(true);
  }

  async function handleConfirmStatusChange() {
    if (!user) return;

    setIsTogglingStatus(true);
    setFeedback(null);

    try {
      const updated = await usersApi.setStatus(user.id, targetStatus);
      setUser(updated);
      setEditStatus(updated.status);
      setIsStatusModalOpen(false);
      setFeedback({
        tone: 'success',
        message:
          targetStatus === 'Active'
            ? `User "${updated.name}" has been activated.`
            : `User "${updated.name}" has been deactivated. Active login sessions have been revoked.`,
      });
    } catch (err) {
      setFeedback({ tone: 'error', message: toErrorMessage(err) });
    } finally {
      setIsTogglingStatus(false);
    }
  }

  function openResetModal() {
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError(null);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setIsResetOpen(true);
  }

  async function handleResetPasswordSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;

    if (!newPassword) {
      setPasswordError('Password is required');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setIsResetting(true);
    setPasswordError(null);

    try {
      await usersApi.resetPassword(user.id, newPassword);
      setIsResetOpen(false);
      setFeedback({
        tone: 'success',
        message: `Password for "${user.name}" has been reset successfully. Existing sessions have been revoked.`,
      });
    } catch (err) {
      setPasswordError(toErrorMessage(err));
    } finally {
      setIsResetting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner label="Loading user details…" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto py-6">
        <Link
          href="/users"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Users</span>
        </Link>
        <Alert tone="error" title="User not found">
          {error ?? 'Could not find the requested user account.'}
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-2">
      {/* Top Breadcrumb / Back button */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/users"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E6E8EC] bg-white text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
            title="Back to Users"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">{user.name}</h1>
              <StatusPill status={user.status} />
            </div>
            <p className="mt-0.5 text-xs text-slate-500">{user.email}</p>
          </div>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-2.5">
          {canUpdate && (
            <>
              {user.status === 'Active' ? (
                <Button
                  variant="secondary"
                  onClick={() => openStatusModal('Inactive')}
                  className="h-9 px-3 text-xs text-amber-700 hover:bg-amber-50 border-amber-200"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="w-3.5 h-3.5 mr-1 text-amber-600">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M22 10.5h-6m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM4 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 10.374 21c-2.331 0-4.512-.645-6.374-1.765Z" />
                  </svg>
                  <span>Deactivate</span>
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => openStatusModal('Active')}
                  className="h-9 px-3 text-xs text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="w-3.5 h-3.5 mr-1 text-emerald-600">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                  <span>Activate</span>
                </Button>
              )}

              <Button
                variant="secondary"
                onClick={openResetModal}
                className="h-9 px-3 text-xs text-slate-700 hover:bg-slate-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="w-3.5 h-3.5 mr-1 text-[#6E1D1D]">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
                </svg>
                <span>Reset Password</span>
              </Button>

              {!isEditing && (
                <Button
                  onClick={handleStartEdit}
                  className="h-9 px-3.5 text-xs bg-[#6E1D1D] hover:bg-[#882424] text-white"
                >
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  <span>Edit Details</span>
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Notification Banner */}
      {feedback && (
        <Alert tone={feedback.tone} title={feedback.tone === 'success' ? 'Success' : 'Error'}>
          {feedback.message}
        </Alert>
      )}

      {/* Main Details Card / Edit Form */}
      <Card className="p-6 sm:p-8 space-y-6 border border-[#E6E8EC]">
        <div className="flex items-center justify-between pb-4 border-b border-[#E6E8EC]">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#F8E6E6] text-base font-bold text-[#6E1D1D]">
              {initials(user.name)}
            </span>
            <div>
              <h2 className="text-base font-semibold text-slate-900">User Account Information</h2>
              <p className="text-xs text-slate-500">Overview of CRM profile and security status</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            <ShieldCheck className="h-4 w-4 text-[#6E1D1D]" />
            {ROLE_LABELS[user.role] ?? user.role}
          </span>
        </div>

        {isEditing ? (
          /* Editable Form */
          <form onSubmit={handleSaveEdit} className="space-y-5" noValidate>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Field
                  label="Full Name *"
                  value={editName}
                  error={editErrors.name}
                  onChange={(e) => setEditName(e.target.value)}
                  autoComplete="name"
                  required
                />
              </div>

              <div>
                <Field
                  label="Email / User ID (Locked)"
                  value={user.email}
                  disabled
                  hint="Email cannot be changed after registration"
                />
              </div>

              <div>
                <SelectField
                  label="Role *"
                  options={roleOptions}
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as Role)}
                  required
                />
              </div>

              <div>
                <SelectField
                  label="Reporting Manager / Team Manager"
                  options={managerOptions}
                  value={editManagerId}
                  onChange={(e) => setEditManagerId(e.target.value)}
                  hint="Select the manager who oversees this user"
                />
              </div>

              <div>
                <SelectField
                  label="Account Status *"
                  options={statusOptions}
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as UserStatus)}
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E6E8EC]">
              <Button
                type="button"
                variant="secondary"
                onClick={handleCancelEdit}
                disabled={isSaving}
                className="h-10 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                isLoading={isSaving}
                className="h-10 text-xs bg-[#6E1D1D] hover:bg-[#882424] text-white px-5"
              >
                Save Changes
              </Button>
            </div>
          </form>
        ) : (
          /* Read-only View */
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-1">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Full Name
              </span>
              <p className="text-sm font-semibold text-slate-900">{user.name}</p>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Email / User ID
              </span>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-slate-400" />
                <p className="text-sm font-semibold text-slate-900">{user.email}</p>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Assigned Role
              </span>
              <p className="text-sm font-semibold text-slate-900">
                {ROLE_LABELS[user.role] ?? user.role}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Reporting Manager
              </span>
              <p className="text-sm font-semibold text-slate-900">
                {user.reportingManager?.fullName
                  ? `${user.reportingManager.fullName} (${user.reportingManager.designation || 'Manager'})`
                  : 'None (Direct / Unassigned)'}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Account Status
              </span>
              <div>
                <StatusPill status={user.status} />
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Last Login Timestamp
              </span>
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <Clock className="h-4 w-4 text-slate-400" />
                <span>{formatDate(user.lastLoginAt)}</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Account Registered
              </span>
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <Calendar className="h-4 w-4 text-slate-400" />
                <span>{formatDate(user.createdAt)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Role Permissions Preview */}
        <div className="pt-5 border-t border-[#E6E8EC] space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
            <ShieldCheck className="h-4 w-4 text-[#6E1D1D]" />
            <span>
              Role Privileges:{' '}
              <span className="text-[#6E1D1D] font-bold">
                {ROLE_LABELS[isEditing ? editRole : user.role]}
              </span>
            </span>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            {(isEditing ? editRole : user.role) === 'admin' &&
              'Full administrative privileges across all CRM modules, employee master, user creation, role assignment, financials, and configurations.'}
            {(isEditing ? editRole : user.role) === 'manager' &&
              'Access to team leads, quotations, manager approvals, campaign management, and reporting.'}
            {(isEditing ? editRole : user.role) === 'sales_agent' &&
              'Access to create, update, and follow up on leads, quotations, and active campaigns.'}
            {(isEditing ? editRole : user.role) === 'ops' &&
              'Access to sites inventory, vendor operations, purchase orders, tasks, and proof uploads.'}
            {(isEditing ? editRole : user.role) === 'finance' &&
              'Access to payment tracking, invoices, purchase orders, financial reports, and sensitive employee details.'}
            {(isEditing ? editRole : user.role) === 'hr' &&
              'Access to employee directory, leave management, attendance records, and candidate recruitment.'}
            {(isEditing ? editRole : user.role) === 'employee' &&
              'Access to self attendance check-in, personal leave requests, employee profile, and assigned tasks.'}
          </p>
        </div>
      </Card>

      {/* Modal: Reset Password */}
      <Modal
        open={isResetOpen}
        onClose={() => !isResetting && setIsResetOpen(false)}
        title="Reset User Password"
      >
        <form onSubmit={handleResetPasswordSubmit} className="space-y-4" noValidate>
          <p className="text-xs text-slate-600">
            Set a new password for <span className="font-semibold text-slate-900">{user.name}</span>{' '}
            (<span className="font-mono text-slate-700">{user.email}</span>).
          </p>

          {passwordError && <Alert tone="error">{passwordError}</Alert>}

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">New Password *</label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                placeholder="Min. 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 pr-10 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#6E1D1D]"
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showNewPassword ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-4 h-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
                    />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-4 h-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">Confirm Password *</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 pr-10 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#6E1D1D]"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showConfirmPassword ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-4 h-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
                    />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-4 h-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsResetOpen(false)}
              disabled={isResetting}
              className="h-10 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={isResetting}
              className="h-10 text-xs bg-[#6E1D1D] hover:bg-[#882424] text-white"
            >
              Save New Password
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Activate/Deactivate Confirmation */}
      <Modal
        open={isStatusModalOpen}
        onClose={() => !isTogglingStatus && setIsStatusModalOpen(false)}
        title={targetStatus === 'Active' ? 'Activate User Account' : 'Deactivate User Account'}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            {targetStatus === 'Inactive' ? (
              <>
                Are you sure you want to deactivate{' '}
                <span className="font-semibold text-slate-900">{user.name}</span>? They will
                immediately lose access to the CRM, and any active login sessions will be terminated.
              </>
            ) : (
              <>
                Are you sure you want to reactivate{' '}
                <span className="font-semibold text-slate-900">{user.name}</span>? They will be able
                to sign in again with their registered credentials.
              </>
            )}
          </p>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsStatusModalOpen(false)}
              disabled={isTogglingStatus}
              className="h-10 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              isLoading={isTogglingStatus}
              onClick={handleConfirmStatusChange}
              className={`h-10 text-xs text-white ${
                targetStatus === 'Inactive'
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {targetStatus === 'Inactive' ? 'Yes, Deactivate' : 'Yes, Activate'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function UserDetailPage() {
  return (
    <RequireAuth permission="users.view">
      <UserDetailsContent />
    </RequireAuth>
  );
}
