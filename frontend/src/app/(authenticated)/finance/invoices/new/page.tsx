'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { InvoiceForm } from '@/modules/finance/components/InvoiceForm';

function NewInvoiceContent() {
  const searchParams = useSearchParams();
  const typeParam = searchParams.get('type');
  const defaultType = typeParam === 'proforma' ? 'proforma' : 'sales_invoice';

  return <InvoiceForm defaultType={defaultType} isEdit={false} />;
}

export default function NewInvoicePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500">Loading invoice form...</div>}>
      <NewInvoiceContent />
    </Suspense>
  );
}
