'use client';

import { useRouter } from 'next/navigation';
import PurchaseOrderForm from './PurchaseOrderForm';
import { createPurchaseOrder } from '../api';
import type { PurchaseOrderFormData } from '../types';
import { useState } from 'react';

export function POWizard() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (data: PurchaseOrderFormData) => {
    setSaving(true);
    try {
      await createPurchaseOrder(data);
      router.push('/purchase-orders');
      return true;
    } catch (err: any) {
      alert(err.message || 'Failed to create Purchase Order');
      return false;
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 dark:border-slate-800 dark:bg-slate-900">
      <PurchaseOrderForm
        order={null}
        saving={saving}
        onClose={() => router.push('/purchase-orders')}
        onSuccess={() => router.push('/purchase-orders')}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
