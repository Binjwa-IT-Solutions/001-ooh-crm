'use client';

import { useAuth } from '@/shared/auth/auth-context';
import { Alert } from '@/shared/ui';
import { DocumentSignatureSettings } from '@/modules/settings/components/document-signature-settings';
import { OfficeAddressSettings } from '@/modules/settings/components/office-address-settings';

/** Company settings (Admin only): office addresses + document signature. */
export default function CompanySettingsPage() {
  const { user } = useAuth();

  if (user?.role !== 'admin') {
    return (
      <Alert tone="error" title="Admins only">
        Only an administrator can change company details printed on documents.
      </Alert>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">Company settings</h1>
        <p className="text-sm text-slate-500">
          What appears on quotations, invoices, purchase orders and payslips. Only admins can change this.
        </p>
      </div>
      <OfficeAddressSettings />
      <hr className="border-slate-200" />
      <DocumentSignatureSettings />
    </div>
  );
}
