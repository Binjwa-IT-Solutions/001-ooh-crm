'use client';

import { useState, type FormEvent, type ReactNode } from 'react';

import { ApiError, toErrorMessage } from '@/shared/api/errors';
import { Alert, Button, Card, DatePicker, Field, TextAreaField } from '@/shared/ui';

import { employeesApi, type SelfProfileValues } from '../api';
import { toDateInput } from '../format';
import type { Employee } from '../types';

/**
 * The employee's own part of their profile. Department, designation, dates,
 * manager, status and CTC belong to HR and are edited on the Employees screen.
 */

function fromEmployee(employee: Partial<Employee>): SelfProfileValues {
  return {
    fullName: employee.fullName ?? '',
    mobile: employee.mobile ?? '',
    personalEmail: employee.personalEmail ?? '',
    dateOfBirth: toDateInput(employee.dateOfBirth),
    workLocation: employee.workLocation ?? '',
    panNumber: employee.panNumber ?? '',
    aadhaarNumber: employee.aadhaarNumber ?? '',
    bankAccountNumber: employee.bankAccountNumber ?? '',
    ifsc: employee.ifsc ?? '',
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
  children: ReactNode;
}) {
  return (
    <Card>
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </Card>
  );
}

export interface SelfProfileFormProps {
  employee: Partial<Employee>;
  onSaved: (employee: Employee) => void | Promise<void>;
  /** Rendered next to the save button, e.g. "Skip for now". */
  secondaryAction?: ReactNode;
}

export function SelfProfileForm({ employee, onSaved, secondaryAction }: SelfProfileFormProps) {
  const [values, setValues] = useState<SelfProfileValues>(() => fromEmployee(employee));
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function set<K extends keyof SelfProfileValues>(key: K, value: SelfProfileValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setIsSubmitting(true);
    try {
      const saved = await employeesApi.updateMine(values);
      await onSaved(saved);
    } catch (err) {
      setError(toErrorMessage(err));
      setFieldErrors(err instanceof ApiError ? err.fieldErrors() : {});
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {error && <Alert tone="error">{error}</Alert>}

      <Section title="Personal details">
        <Field
          label="Full name"
          value={values.fullName}
          error={fieldErrors.fullName}
          onChange={(e) => set('fullName', e.target.value)}
        />
        <Field
          label="Mobile"
          inputMode="numeric"
          placeholder="9876543210"
          value={values.mobile}
          error={fieldErrors.mobile}
          onChange={(e) => set('mobile', e.target.value.replace(/\D/g, '').slice(0, 10))}
        />
        <Field
          label="Work email"
          type="email"
          value={employee.workEmail ?? ''}
          hint="Linked to your login. Ask HR to change it."
          disabled
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
          max={new Date().toLocaleDateString('en-CA')}
        />
        <Field
          label="Work location"
          placeholder="Mumbai"
          value={values.workLocation}
          error={fieldErrors.workLocation}
          onChange={(e) => set('workLocation', e.target.value)}
        />
      </Section>

      <Section title="Emergency contact and address" description="Optional.">
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

      <Section
        title="Statutory and payroll"
        description="Only you, HR, Finance and Admin can see these. Salary details are set by HR."
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
      </Section>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          isLoading={isSubmitting}
          className="bg-[#6E1D1D] text-white hover:bg-[#882424]"
        >
          Save profile
        </Button>
        {secondaryAction}
      </div>
    </form>
  );
}
