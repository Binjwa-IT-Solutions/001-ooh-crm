'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RequireAuth } from '@/shared/auth/require-auth';

export default function ProformaInvoicesRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/finance/invoices?tab=proforma');
  }, [router]);

  return (
    <RequireAuth permission="finance.view_payments">
      <div className="p-8 text-center text-xs text-slate-500">
        Loading Proforma Invoices...
      </div>
    </RequireAuth>
  );
}
