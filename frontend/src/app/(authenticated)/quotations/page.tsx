'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { quotationsApi } from '@/modules/quotations/api';
import type { Quotation } from '@/modules/quotations/types';

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');

  useEffect(() => {
    fetchQuotations();
  }, [statusFilter]);

  async function fetchQuotations() {
    try {
      setLoading(true);
      setError(null);
      const res = await quotationsApi.list({ status: statusFilter });
      setQuotations(res.quotations || []);
      setTotal(res.meta?.total || 0);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load quotations');
    } finally {
      setLoading(false);
    }
  }

  function formatRupees(paise: number): string {
    const rupees = paise / 100;
    return `₹${rupees.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  function statusBadge(status: string) {
    switch (status) {
      case 'Draft':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
      case 'Sent':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'Accepted':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
      case 'Rejected':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300';
      case 'Expired':
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Quotations & Proposals</h1>
          <p className="text-sm text-slate-500">Track proposal status, generate PDFs, and monitor client acceptance.</p>
        </div>
        <Link
          href="/quotations/new"
          className="rounded-md bg-[#8B2424] px-4 py-2 text-sm font-medium text-white transition hover:bg-primary shadow-sm"
        >
          + New Quotation
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        >
          <option value="">All Statuses</option>
          <option value="Draft">Draft</option>
          <option value="Sent">Sent</option>
          <option value="Accepted">Accepted</option>
          <option value="Rejected">Rejected</option>
          <option value="Expired">Expired</option>
        </select>
        <span className="text-xs text-slate-500">Showing {quotations.length} of {total} quotations</span>
      </div>

      {error && (
        <div className="rounded-md bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-700 dark:text-slate-200">
            <thead className="bg-slate-50 text-slate-900 dark:bg-slate-800 dark:text-white">
              <tr>
                <th className="px-4 py-3 font-medium">Quote #</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Subtotal</th>
                <th className="px-4 py-3 font-medium">GST (18%)</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Valid Until</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    Loading quotations...
                  </td>
                </tr>
              ) : quotations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    No quotations found. Create your first quotation using the button above.
                  </td>
                </tr>
              ) : (
                quotations.map((q) => {
                  const leadName = q.clientName || (typeof q.leadId === 'object' ? q.leadId?.companyName : 'Valued Client');
                  return (
                    <tr key={q.id || q._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                        <Link href={`/quotations/${q.id || q._id}`} className="hover:underline">
                          {q.quoteNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{leadName}</td>
                      <td className="px-4 py-3">{formatRupees(q.subtotal)}</td>
                      <td className="px-4 py-3 text-slate-500">{formatRupees(q.taxAmount)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                        {formatRupees(q.total)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadge(q.status)}`}>
                          {q.status === 'Draft' ? 'No Action' : q.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {q.validUntil ? new Date(q.validUntil).toLocaleDateString('en-IN') : '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/quotations/${q.id || q._id}`}
                          className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
