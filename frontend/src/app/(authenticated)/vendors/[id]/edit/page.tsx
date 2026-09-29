'use client';

import { useParams } from 'next/navigation';
import { useVendor } from '@/modules/vendors/hooks/useVendors';
import VendorForm from '@/modules/vendors/components/VendorForm';
import { Spinner } from '@/shared/ui';

export default function EditVendorPage() {
  const params = useParams();
  const id = params.id as string;
  const { vendor, isLoading, error } = useVendor(id);

  if (isLoading) {
    return <div className="p-8 flex justify-center"><Spinner /></div>;
  }

  if (error || !vendor) {
    return <div className="p-8 text-red-500">{error || 'Vendor not found'}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Edit Vendor</h1>
        <p className="text-sm text-slate-500">Update vendor details.</p>
      </div>
      <VendorForm vendor={vendor} saving={false} onClose={() => {}} onSubmit={async () => true} />
    </div>
  );
}
