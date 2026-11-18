'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { FileText, Trash2, Upload, ExternalLink } from 'lucide-react';

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
  type EmployeeDocument,
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
  personalMobile: '',
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
    personalMobile: employee.personalMobile ?? '',
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

export interface EmployeeFormProps {
  employee?: Employee;
  isSelfCompletion?: boolean;
  onSuccess?: (employee: Employee) => void;
  hideCancel?: boolean;
  submitLabel?: string;
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function EmployeeForm({
  employee,
  isSelfCompletion = false,
  onSuccess,
  hideCancel = false,
  submitLabel,
}: EmployeeFormProps) {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const isEdit = Boolean(employee);

  const [values, setValues] = useState<EmployeeFormValues>(
    employee ? fromEmployee(employee) : EMPTY,
  );

  useEffect(() => {
    if (employee) {
      setValues(fromEmployee(employee));
    }
  }, [employee]);

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { options: managers } = useManagerOptions();

  const [documents, setDocuments] = useState<EmployeeDocument[]>(employee?.documents ?? []);
  const [docTitle, setDocTitle] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [docSuccess, setDocSuccess] = useState<string | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (employee?.documents) {
      setDocuments(employee.documents);
    }
  }, [employee]);

  async function handleUploadDocument(e: React.FormEvent) {
    e.preventDefault();
    if (!employee?.id) return;
    if (!docFile) {
      setDocError('Please select a file to upload');
      return;
    }

    const MAX_10MB = 10 * 1024 * 1024;
    if (docFile.size > MAX_10MB) {
      setDocError('File size exceeds the 10 MB limit. Please select a smaller file.');
      return;
    }

    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/jpg',
    ];
    if (!allowedTypes.includes(docFile.type)) {
      setDocError('Only PDF and image files (JPG, PNG, WEBP) are allowed.');
      return;
    }

    setDocError(null);
    setDocSuccess(null);
    setIsUploadingDoc(true);

    try {
      const updated = await employeesApi.uploadDocument(employee.id, docFile, docTitle.trim() || undefined);
      setDocuments(updated.documents ?? []);
      setDocFile(null);
      setDocTitle('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setDocSuccess('Document uploaded successfully.');
      setTimeout(() => setDocSuccess(null), 4000);
    } catch (err) {
      setDocError(toErrorMessage(err));
    } finally {
      setIsUploadingDoc(false);
    }
  }

  async function handleDeleteDocument(docId: string) {
    if (!employee?.id) return;
    if (!window.confirm('Are you sure you want to delete this document?')) return;

    setDocError(null);
    setDeletingDocId(docId);
    try {
      const updated = await employeesApi.deleteDocument(employee.id, docId);
      setDocuments(updated.documents ?? []);
    } catch (err) {
      setDocError(toErrorMessage(err));
    } finally {
      setDeletingDocId(null);
    }
  }

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
      let saved: Employee;
      if (isSelfCompletion) {
        saved = await employeesApi.updateMine(values);
      } else if (employee) {
        saved = await employeesApi.update(employee.id, values);
      } else {
        saved = await employeesApi.create(values);
      }

      if (onSuccess) {
        onSuccess(saved);
      } else {
        router.push(`/employees/${saved.id}`);
        router.refresh();
      }
    } catch (err) {
      setError(toErrorMessage(err));
      setFieldErrors(err instanceof ApiError ? err.fieldErrors() : {});
      if (!isSelfCompletion) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
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
          label="Work location"
          placeholder="Mumbai"
          value={values.workLocation}
          error={fieldErrors.workLocation}
          onChange={(e) => set('workLocation', e.target.value)}
          required
        />
        <Field
          label="Office mobile"
          inputMode="numeric"
          placeholder="9876543210"
          value={values.mobile}
          error={fieldErrors.mobile}
          onChange={(e) => set('mobile', e.target.value.replace(/\D/g, '').slice(0, 10))}
          required
        />
        <Field
          label="Personal mobile"
          inputMode="numeric"
          placeholder="9876543210"
          value={values.personalMobile}
          error={fieldErrors.personalMobile}
          onChange={(e) => set('personalMobile', e.target.value.replace(/\D/g, '').slice(0, 10))}
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
          // Local YYYY-MM-DD; a date of birth can't be in the future.
          max={new Date().toLocaleDateString('en-CA')}
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
        />
        <Field
          label="Designation"
          placeholder="Account Executive"
          value={values.designation}
          error={fieldErrors.designation}
          onChange={(e) => set('designation', e.target.value)}
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

      <Section
        title="Documents"
        description="Upload employee documents such as ID proofs, certificates, or contracts. (PDF or image, max 10 MB per file)"
      >
        <div className="sm:col-span-2 space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-900/50 text-xs text-slate-600 dark:text-slate-400">
            <span className="font-semibold text-slate-800 dark:text-slate-200">Note: </span>
            Supported formats: PDF and images (PNG, JPG, JPEG, WEBP) of less than 10 MB (&lt; 10 MB per file).
          </div>

          {docError && <Alert tone="error">{docError}</Alert>}
          {docSuccess && <Alert tone="success">{docSuccess}</Alert>}

          {documents.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs dark:divide-slate-800">
                <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Document Name</th>
                    <th className="px-4 py-2.5 font-semibold">Size</th>
                    <th className="px-4 py-2.5 font-semibold">Uploaded</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800/60 dark:bg-slate-900">
                  {documents.map((doc) => (
                    <tr key={doc.id || doc.fileKey} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-[#6E1D1D] shrink-0" />
                          <span className="truncate max-w-[220px] sm:max-w-xs">{doc.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                        {formatFileSize(doc.fileSize)}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                        {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {doc.fileUrl && (
                            <a
                              href={doc.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[#6E1D1D] hover:underline font-medium"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              View
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteDocument(doc.id)}
                            disabled={deletingDocId === doc.id}
                            className="text-rose-600 hover:text-rose-800 p-1 disabled:opacity-50"
                            title="Delete document"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : isEdit ? (
            <p className="text-xs text-slate-500 italic">No documents uploaded yet for this employee.</p>
          ) : null}

          {isEdit && employee?.id ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-4 dark:border-slate-700 bg-white dark:bg-slate-950">
              <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2">Upload a new document</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Document Title / Description (optional)"
                  placeholder="e.g. Aadhaar Card, Offer Letter, Degree"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                />
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Select File (PDF or Image &lt; 10 MB) <span className="text-red-500">*</span>
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,image/png,image/jpeg,image/webp,image/jpg"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 10 * 1024 * 1024) {
                          setDocError('File size exceeds the 10 MB limit.');
                          setDocFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        } else {
                          setDocError(null);
                          setDocFile(file);
                        }
                      }
                    }}
                    className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#6E1D1D]/10 file:text-[#6E1D1D] hover:file:bg-[#6E1D1D]/20 cursor-pointer"
                  />
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!docFile || isUploadingDoc}
                  onClick={handleUploadDocument}
                  className="text-xs flex items-center gap-1.5"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {isUploadingDoc ? 'Uploading...' : 'Upload Document'}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Please save the employee record first. Once created, you will be able to upload documents here.
            </p>
          )}
        </div>
      </Section>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          isLoading={isSubmitting}
          className="bg-[#6E1D1D] hover:bg-[#882424] text-white"
        >
          {submitLabel || (isSelfCompletion ? 'Complete Profile & Continue' : isEdit ? 'Save changes' : 'Create employee')}
        </Button>
        {!hideCancel && (
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Cancel
          </Button>
        )}
        {!isEdit && !isSelfCompletion && (
          <p className="w-full text-xs text-slate-500 dark:text-slate-400">
            The employee code is generated by the server on save.
          </p>
        )}
      </div>
    </form>
  );
}
