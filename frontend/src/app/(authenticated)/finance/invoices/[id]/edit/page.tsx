'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { invoicesApi } from '@/modules/finance/api';
import type { Invoice } from '@/modules/finance/types';
import { InvoiceForm } from '@/modules/finance/components/InvoiceForm';

interface EditInvoicePageProps {
  params: Promise<{ id: string }>;
}

export default function EditInvoicePage({ params }: EditInvoicePageProps) {
  const { id } = use(params);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    invoicesApi
      .getInvoiceById(id)
      .then((res) => {
        setInvoice(res.invoice || res.data);
      })
      .catch((err) => {
        setError(err?.message || 'Failed to load invoice for editing');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-[#6E1D1D]" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 mx-auto">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Unable to Edit Invoice</h2>
        <p className="text-xs text-slate-500">{error || 'Invoice record could not be loaded.'}</p>
        <Link
          href="/finance/invoices"
          className="inline-flex items-center gap-2 rounded-lg bg-[#6E1D1D] px-4 py-2 text-xs font-semibold text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Invoices
        </Link>
      </div>
    );
  }

  return <InvoiceForm initialInvoice={invoice} defaultType={invoice.type} isEdit={true} />;
}
