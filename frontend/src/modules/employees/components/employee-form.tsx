'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { ApiError, toErrorMessage } from '@/shared/api/errors';
import { useAuth } from '@/shared/auth/auth-context';
import { Alert, Button, Card, Field, SelectField, TextAreaField, DatePicker } from '@/shared/ui';

import { employeesApi } from '../api';
import { useManagerOptions } from '../hooks/use-employees';
import {
  DEPARTMENTS,
  EMPLOYEE_STATUSES,
  EMPLOYMENT_TYPES,
  type Department,
  type Employee,
  type EmployeeFormValues,
  type EmploymentType,
} from '../types';
import { paiseToRupeeInput, toDateInput } from '../format';

/**
 * REFERENCE MODULE — a create/edit form.
 *
 * One component serves both, driven by whether `employee` was passed. Worth
 * copying: field-level errors come from the server's `details` array, so the
 * form and the API never disagree about what is valid.
 */

const EMPTY: EmployeeFormValues = {
  fullName: '',
  workEmail: '',
  personalEmail: '',
  mobile: '',
  dateOfBirth: '',
  department: '',
  designation: '',
  employmentType: 'Full-time',
  dateOfJoining: '',
  dateOfExit: '',
  reportingManagerId: '',
  workLocation: '',
  status: 'Active',
  panNumber: '',
  aadhaarNumber: '',
  bankAccountNumber: '',
  ifsc: '',
  annualCtcRupees: '',
  emergencyContactName: '',
  emergencyContactRelationship: '',
  emergencyContactMobile: '',
  address: '',
};

function fromEmployee(employee: Employee): EmployeeFormValues {
  return {
    fullName: employee.fullName,
    workEmail: employee.workEmail,
    personalEmail: employee.personalEmail ?? '',
    mobile: employee.mobile,
    dateOfBirth: toDateInput(employee.dateOfBirth),
    department: (employee.department as Department) || '',
    designation: employee.designation || '',
    employmentType: (employee.employmentType as EmploymentType) || 'Full-time',
    dateOfJoining: toDateInput(employee.dateOfJoining),
    dateOfExit: toDateInput(employee.dateOfExit),
    reportingManagerId: employee.reportingManager?.id ?? '',
    workLocation: employee.workLocation || '',
    status: employee.status,
    panNumber: employee.panNumber ?? '',
    aadhaarNumber: employee.aadhaarNumber ?? '',
    bankAccountNumber: employee.bankAccountNumber ?? '',
    ifsc: employee.ifsc ?? '',
    annualCtcRupees: paiseToRupeeInput(employee.annualCtc),
    emergencyContactName: employee.emergencyContact?.name ?? '',
    emergencyContactRelationship: employee.emergencyContact?.relationship ?? '',
    emergencyContactMobile: employee.emergencyContact?.mobile ?? '',
    address: employee.address ?? '',
  };
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
        {description && (
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </Card>
  );
}

export function EmployeeForm({ employee }: { employee?: Employee }) {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const isEdit = Boolean(employee);

  const [values, setValues] = useState<EmployeeFormValues>(
    employee ? fromEmployee(employee) : EMPTY,
  );
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { options: managers } = useManagerOptions();

  // Same rule as the server: only Admin, HR and Finance may set these.
  const canEditSensitive = hasPermission('employees.sensitive');

  function set<K extends keyof EmployeeFormValues>(key: K, value: EmployeeFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const saved = employee
        ? await employeesApi.update(employee.id, values)
        : await employeesApi.create(values);

      router.push(`/employees/${saved.id}`);
      router.refresh();
    } catch (err) {
      setError(toErrorMessage(err));
      setFieldErrors(err instanceof ApiError ? err.fieldErrors() : {});
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsSubmitting(false);
    }
  }

  const managerOptions = managers
    // Nobody can be their own manager — the server rejects it, so don't offer it.
    .filter((option) => option.id !== employee?.id)
    .map((option) => ({
      value: option.id,
      label: `${option.fullName} · ${option.designation}`,
    }));

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {error && <Alert tone="error">{error}</Alert>}

      <Section title="Personal details">
        <Field
          label="Full name"
          value={values.fullName}
          error={fieldErrors.fullName}
          onChange={(e) => set('fullName', e.target.value)}
          required
        />
        <Field
          label="Mobile"
          inputMode="numeric"
          placeholder="9876543210"
          value={values.mobile}
          error={fieldErrors.mobile}
          onChange={(e) => set('mobile', e.target.value.replace(/\D/g, '').slice(0, 10))}
          required
        />
        <Field
          label="Work email"
          type="email"
          value={values.workEmail}
          error={fieldErrors.workEmail}
          onChange={(e) => set('workEmail', e.target.value)}
          required
        />
        <Field
          label="Personal email"
          type="email"
          value={values.personalEmail}
          error={fieldErrors.personalEmail}
          onChange={(e) => set('personalEmail', e.target.value)}
        />
        <DatePicker
          label="Date of birth"
          value={values.dateOfBirth}
          error={fieldErrors.dateOfBirth}
          onChange={(val) => set('dateOfBirth', val)}
        />
        <Field
          label="Work location"
          placeholder="Mumbai"
          value={values.workLocation}
          error={fieldErrors.workLocation}
          onChange={(e) => set('workLocation', e.target.value)}
          required
        />
      </Section>

      <Section
        title="Employment"
        description="Reporting manager drives leave approval and task escalation."
      >
        <SelectField
          label="Department"
          placeholder="Select a department"
          options={DEPARTMENTS.map((d) => ({ value: d, label: d }))}
          value={values.department}
          error={fieldErrors.department}
          onChange={(e) => set('department', e.target.value as EmployeeFormValues['department'])}
          required
        />
        <Field
          label="Designation"
          placeholder="Account Executive"
          value={values.designation}
          error={fieldErrors.designation}
          onChange={(e) => set('designation', e.target.value)}
          required
        />
        <SelectField
          label="Employment type"
          options={EMPLOYMENT_TYPES.map((t) => ({ value: t, label: t }))}
          value={values.employmentType}
          error={fieldErrors.employmentType}
          onChange={(e) =>
            set('employmentType', e.target.value as EmployeeFormValues['employmentType'])
          }
        />
        <SelectField
          label="Status"
          options={EMPLOYEE_STATUSES.map((s) => ({ value: s, label: s }))}
          value={values.status}
          error={fieldErrors.status}
          onChange={(e) => set('status', e.target.value as EmployeeFormValues['status'])}
        />
        <DatePicker
          label="Date of joining"
          value={values.dateOfJoining}
          error={fieldErrors.dateOfJoining}
          onChange={(val) => set('dateOfJoining', val)}
          required
        />
        <DatePicker
          label="Date of exit"
          value={values.dateOfExit}
          error={fieldErrors.dateOfExit}
          onChange={(val) => set('dateOfExit', val)}
        />
        <SelectField
          label="Reports to"
          placeholder="No reporting manager"
          options={managerOptions}
          value={values.reportingManagerId}
          error={fieldErrors.reportingManagerId}
          onChange={(e) => set('reportingManagerId', e.target.value)}
        />
      </Section>

      {canEditSensitive && (
        <Section
          title="Statutory and payroll"
          description="Visible only to Admin, HR and Finance. The server enforces this too."
        >
          <Field
            label="PAN"
            placeholder="ABCDE1234F"
            maxLength={10}
            value={values.panNumber}
            error={fieldErrors.panNumber}
            onChange={(e) => set('panNumber', e.target.value.toUpperCase())}
          />
          <Field
            label="Aadhaar"
            inputMode="numeric"
            maxLength={12}
            value={values.aadhaarNumber}
            error={fieldErrors.aadhaarNumber}
            onChange={(e) => set('aadhaarNumber', e.target.value.replace(/\D/g, ''))}
          />
          <Field
            label="Bank account number"
            value={values.bankAccountNumber}
            error={fieldErrors.bankAccountNumber}
            onChange={(e) => set('bankAccountNumber', e.target.value)}
          />
          <Field
            label="IFSC"
            placeholder="HDFC0001234"
            maxLength={11}
            value={values.ifsc}
            error={fieldErrors.ifsc}
            onChange={(e) => set('ifsc', e.target.value.toUpperCase())}
          />
          <Field
            label="Annual CTC (₹)"
            inputMode="decimal"
            placeholder="1250000"
            hint="Entered in rupees. Stored as integer paise."
            value={values.annualCtcRupees}
            error={fieldErrors.annualCtc}
            onChange={(e) => set('annualCtcRupees', e.target.value.replace(/[^\d.]/g, ''))}
          />
        </Section>
      )}

      <Section title="Emergency contact and address">
        <Field
          label="Contact name"
          value={values.emergencyContactName}
          onChange={(e) => set('emergencyContactName', e.target.value)}
        />
        <Field
          label="Relationship"
          placeholder="Spouse"
          value={values.emergencyContactRelationship}
          onChange={(e) => set('emergencyContactRelationship', e.target.value)}
        />
        <Field
          label="Contact mobile"
          inputMode="numeric"
          value={values.emergencyContactMobile}
          error={fieldErrors['emergencyContact.mobile']}
          onChange={(e) =>
            set('emergencyContactMobile', e.target.value.replace(/\D/g, '').slice(0, 10))
          }
        />
        <div className="sm:col-span-2">
          <TextAreaField
            label="Address"
            rows={3}
            value={values.address}
            error={fieldErrors.address}
            onChange={(e) => set('address', e.target.value)}
          />
        </div>
      </Section>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" isLoading={isSubmitting}>
          {isEdit ? 'Save changes' : 'Create employee'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
        {!isEdit && (
          <p className="w-full text-xs text-slate-500 dark:text-slate-400">
            The employee code is generated by the server on save.
          </p>
        )}
      </div>
    </form>
  );
}
