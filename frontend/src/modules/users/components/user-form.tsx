'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ShieldCheck, User as UserIcon } from 'lucide-react';

import { ApiError, toErrorMessage } from '@/shared/api/errors';
import { Alert, Button, Card, Field, SelectField } from '@/shared/ui';

import { usersApi } from '../api';
import {
  USER_ASSIGNABLE_ROLES,
  ROLE_LABELS,
  USER_STATUSES,
  type Role,
  type User,
  type UserFormValues,
  type UserStatus,
} from '../types';
import { useManagerOptions } from '@/modules/employees/hooks/use-employees';

interface UserFormProps {
  initialValues?: Partial<UserFormValues>;
  onSuccess?: (user: User) => void;
  onCancel?: () => void;
  mode?: 'create' | 'edit';
}

const INITIAL_FORM_VALUES: UserFormValues = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  role: 'sales_agent',
  status: 'Active',
  reportingManagerId: '',
};

export function UserForm({
  initialValues,
  onSuccess,
  onCancel,
  mode = 'create',
}: UserFormProps) {
  const router = useRouter();
  const { options: managerOptionsList, isLoading: managersLoading } = useManagerOptions();
  const [values, setValues] = useState<UserFormValues>({
    ...INITIAL_FORM_VALUES,
    ...initialValues,
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const roleOptions = USER_ASSIGNABLE_ROLES.map((role) => ({
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

  function updateField<K extends keyof UserFormValues>(key: K, val: UserFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: val }));
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};

    if (!values.name.trim()) {
      errors.name = 'Full name is required';
    } else if (values.name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters';
    }

    if (!values.email.trim()) {
      errors.email = 'Email / User ID is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
      errors.email = 'Enter a valid email address';
    }

    if (!values.role) {
      errors.role = 'Role is required';
    }

    if (!values.status) {
      errors.status = 'Status is required';
    }

    if (mode === 'create' || values.password) {
      if (!values.password) {
        errors.password = 'Password is required';
      } else if (values.password.length < 8) {
        errors.password = 'Password must be at least 8 characters';
      }

      if (!values.confirmPassword) {
        errors.confirmPassword = 'Confirm password is required';
      } else if (values.password !== values.confirmPassword) {
        errors.confirmPassword = 'Passwords do not match';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setGeneralError(null);
    setSuccessMessage(null);

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === 'create') {
        const created = await usersApi.create({
          name: values.name.trim(),
          email: values.email.trim().toLowerCase(),
          password: values.password,
          role: values.role,
          status: values.status,
          reportingManagerId: values.reportingManagerId || undefined,
        });

        setSuccessMessage(`User "${created.name}" created successfully!`);
        if (onSuccess) {
          onSuccess(created);
        } else {
          setTimeout(() => {
            router.push('/users');
          }, 1000);
        }
      }
    } catch (err) {
      setGeneralError(toErrorMessage(err));
      if (err instanceof ApiError) {
        setFieldErrors((prev) => ({ ...prev, ...err.fieldErrors() }));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCancel() {
    if (onCancel) {
      onCancel();
    } else {
      router.push('/users');
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {generalError && (
        <Alert tone="error" title="User creation failed">
          {generalError}
        </Alert>
      )}

      {successMessage && (
        <Alert tone="success" title="Success">
          {successMessage}
        </Alert>
      )}

      <Card className="p-6 sm:p-8 space-y-6 border border-[#E6E8EC]">
        {/* Section header */}
        <div className="flex items-center gap-3 pb-4 border-b border-[#E6E8EC]">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F8E6E6] text-[#6E1D1D]">
            <UserIcon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">User Account Information</h2>
            <p className="text-xs text-slate-500">Enter personal details, credentials, and access role</p>
          </div>
        </div>

        {/* Basic Fields */}
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Field
              label="Full Name *"
              placeholder="e.g. Rahul Sharma"
              value={values.name}
              error={fieldErrors.name}
              onChange={(e) => updateField('name', e.target.value)}
              autoComplete="name"
              required
            />
          </div>

          <div>
            <Field
              label="Email / User ID *"
              type="email"
              placeholder="e.g. rahul.sharma@mediaoctus.com"
              value={values.email}
              error={fieldErrors.email}
              onChange={(e) => updateField('email', e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div>
            <SelectField
              label="Role *"
              options={roleOptions}
              value={values.role}
              error={fieldErrors.role}
              onChange={(e) => updateField('role', e.target.value as Role)}
              required
            />
          </div>

          <div>
            <SelectField
              label="Status *"
              options={statusOptions}
              value={values.status}
              error={fieldErrors.status}
              onChange={(e) => updateField('status', e.target.value as UserStatus)}
              required
            />
          </div>

          <div className="sm:col-span-2">
            <SelectField
              label="Reporting Manager / Team Manager"
              options={managerOptions}
              value={values.reportingManagerId || ''}
              error={fieldErrors.reportingManagerId}
              onChange={(e) => updateField('reportingManagerId', e.target.value)}
              hint="Select the manager who oversees this user / team member"
            />
          </div>
        </div>

        {/* Password Section */}
        <div className="pt-4 border-t border-[#E6E8EC] space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="w-4 h-4 text-[#6E1D1D]">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
            <span>Security & Authentication</span>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">
                Password *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min. 8 characters"
                  value={values.password}
                  onChange={(e) => updateField('password', e.target.value)}
                  autoComplete="new-password"
                  className={`h-11 w-full rounded-lg border bg-white px-3 pr-10 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#6E1D1D] ${fieldErrors.password ? 'border-red-400 focus:border-red-500' : 'border-slate-300'
                    }`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                  )}
                </button>
              </div>
              {fieldErrors.password ? (
                <p className="text-xs text-red-600">{fieldErrors.password}</p>
              ) : (
                <p className="text-xs text-slate-500">Must be at least 8 characters long</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">
                Confirm Password *
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Re-enter password"
                  value={values.confirmPassword}
                  onChange={(e) => updateField('confirmPassword', e.target.value)}
                  autoComplete="new-password"
                  className={`h-11 w-full rounded-lg border bg-white px-3 pr-10 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#6E1D1D] ${fieldErrors.confirmPassword ? 'border-red-400 focus:border-red-500' : 'border-slate-300'
                    }`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                  )}
                </button>
              </div>
              {fieldErrors.confirmPassword && (
                <p className="text-xs text-red-600">{fieldErrors.confirmPassword}</p>
              )}
            </div>
          </div>
        </div>

        {/* Selected Role Permissions Preview */}
        <div className="pt-4 border-t border-[#E6E8EC]">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-2">
            <ShieldCheck className="h-4 w-4 text-[#6E1D1D]" />
            <span>Assigned Role: <span className="text-[#6E1D1D] font-bold">{ROLE_LABELS[values.role]}</span></span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            {values.role === 'admin' && 'Full administrative access across all CRM modules, user management, financials, and configurations.'}
            {values.role === 'manager' && 'Access to sales pipeline, quotations, team approvals, campaign operations, and reports.'}
            {values.role === 'sales_agent' && 'Access to create and manage assigned leads, proposals, quotations, and campaign tracking.'}
            {values.role === 'ops' && 'Access to inventory, site operations, vendors, purchase orders, tasks, and proof uploads.'}
            {values.role === 'finance' && 'Access to invoices, payment collections, vendor payouts, financial reporting, and sensitive employee data.'}
            {values.role === 'hr' && 'Access to employee master, attendance tracking, leave requests, candidate interviews, and user viewing.'}
            {/* {values.role === 'employee' && 'Access to self employee portal, attendance check-in, personal leave requests, and assigned tasks.'} */}
          </p>
        </div>
      </Card>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="secondary"
          onClick={handleCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          isLoading={isSubmitting}
          className="min-w-[140px] bg-[#6E1D1D] hover:bg-[#882424] text-white"
        >
          {mode === 'create' ? 'Create User' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}
