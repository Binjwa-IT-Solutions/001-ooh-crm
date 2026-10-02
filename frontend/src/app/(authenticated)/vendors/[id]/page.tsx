'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useVendor } from '@/modules/vendors/hooks/useVendors';
import { Card, Badge, Spinner, Button } from '@/shared/ui';
import { useAuth } from '@/shared/auth/auth-context';

export default function VendorDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { vendor, isLoading, error } = useVendor(id);
  const { hasPermission } = useAuth();

  if (isLoading) return <div className="p-8 flex justify-center"><Spinner /></div>;
  if (error || !vendor) return <div className="p-8 text-red-500">{error || 'Vendor not found'}</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white flex items-center gap-3">
            {vendor.name}
            <Badge>{vendor.status}</Badge>
          </h1>
          <p className="text-sm text-slate-500 mt-1">{vendor.city}</p>
        </div>
        <div className="flex gap-2">
          {hasPermission('vendors.manage') && (
            <Link href={`/vendors/${vendor._id}/edit`}>
              <Button variant="secondary">Edit Vendor</Button>
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-4">Contact Information</h3>
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="text-slate-500">Contact Person</dt>
              <dd className="font-medium text-slate-900 dark:text-white">{vendor.contactPerson}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Site Owner Name</dt>
              <dd className="font-medium text-slate-900 dark:text-white">{vendor.siteOwnerName}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Mobile</dt>
              <dd className="font-medium text-slate-900 dark:text-white">{vendor.mobile}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Email</dt>
              <dd className="font-medium text-slate-900 dark:text-white">{vendor.email || '-'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Address</dt>
              <dd className="font-medium text-slate-900 dark:text-white">{vendor.address}</dd>
            </div>
          </dl>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-4">Business & Finance</h3>
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="text-slate-500">GST Number</dt>
              <dd className="font-medium text-slate-900 dark:text-white">{vendor.gstNumber || '-'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Payment Terms</dt>
              <dd className="font-medium text-slate-900 dark:text-white">{vendor.paymentTerms || '-'}</dd>
            </div>
            {hasPermission('finance.bank_details') && (
              <>
                <div>
                  <dt className="text-slate-500">Bank Account</dt>
                  <dd className="font-medium text-slate-900 dark:text-white">{vendor.bankAccount || vendor.bankAccountNumber || '-'}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">IFSC Code</dt>
                  <dd className="font-medium text-slate-900 dark:text-white">{vendor.ifscCode || vendor.ifsc || '-'}</dd>
                </div>
              </>
            )}
          </dl>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-4">Linked Sites</h3>
        {/* Placeholder for Sites List */}
        <p className="text-sm text-slate-500">Sites linked to this vendor will appear here.</p>
      </Card>
    </div>
  );
}
