'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';
import { invoicesApi } from '@/modules/finance/api';
import type { Invoice } from '@/modules/finance/types';
import { InvoiceDetailView } from '@/modules/finance/components/InvoiceDetailView';

interface ProformaDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function ProformaDetailPage({ params }: ProformaDetailPageProps) {
  const { id } = use(params);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoice = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await invoicesApi.getInvoiceById(id);
      setInvoice(res.invoice || res.data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load proforma invoice details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoice();
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
        <h2 className="text-lg font-bold text-slate-900">Proforma Invoice Not Found</h2>
        <p className="text-xs text-slate-500">{error || 'The requested proforma invoice could not be located.'}</p>
        <Link
          href="/finance/proforma-invoices"
          className="inline-flex items-center gap-2 rounded-lg bg-[#6E1D1D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#581717]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Proforma Invoices
        </Link>
      </div>
    );
  }

  return <InvoiceDetailView invoice={invoice} onRefresh={fetchInvoice} />;
}
