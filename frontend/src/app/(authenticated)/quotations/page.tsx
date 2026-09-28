'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import { useAuth } from '@/shared/auth/auth-context';
import { leadsApi } from '@/modules/leads/api';
import { quotationsApi } from '@/modules/quotations/api';
import type { Quotation } from '@/modules/quotations/types';

const STATUS_STYLES: Record<string, string> = {
  Draft: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  Sent: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300',
  Accepted: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
  Rejected: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300',
  Expired: 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

function formatDate(dateStr?: string | null) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatRupees(paise: number, decimals: number = 2): string {
  const rupees = (paise || 0) / 100;
  return `₹${rupees.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export default function QuotationsPage() {
  const { user } = useAuth();
  const isManagerOrAdmin = ['admin', 'manager'].includes(user?.role?.toLowerCase() || '');

  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [agentFilter, setAgentFilter] = useState<string>('');
  const [agentOptions, setAgentOptions] = useState<{ _id: string; name: string; email: string; role: string }[]>([]);

  // Load agent options for managers/admins
  useEffect(() => {
    if (isManagerOrAdmin) {
      leadsApi.listAgents()
        .then((res) => {
          if (res.agents) setAgentOptions(res.agents);
        })
        .catch(() => {});
    }
  }, [isManagerOrAdmin]);

  // Fetch quotations on filter changes
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchQuotations();
    }, 200);
    return () => clearTimeout(timer);
  }, [search, statusFilter, agentFilter]);

  async function fetchQuotations() {
    try {
      setLoading(true);
      setError(null);
      const res = await quotationsApi.list({
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        agentId: agentFilter || undefined,
      });
      setQuotations(res.quotations || []);
      setTotal(res.meta?.total || 0);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load quotations');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Quotations & Proposals</h1>
          <p className="text-sm text-slate-500">Track proposal status, generate PDFs, and monitor client acceptance.</p>
        </div>
        <Link
          href="/quotations/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#8B2424] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#721c1c] transition"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span>New Quotation</span>
        </Link>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center max-w-3xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by quote #, client name, or contact..."
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          >
            <option value="">All Statuses</option>
            <option value="Draft">Draft</option>
            <option value="Sent">Sent</option>
            <option value="Accepted">Accepted</option>
            <option value="Rejected">Rejected</option>
            <option value="Expired">Expired</option>
          </select>
          {isManagerOrAdmin && agentOptions.length > 0 && (
            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            >
              <option value="">All Sales Agents</option>
              {agentOptions.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
          Showing {quotations.length} of {total} quotations
        </span>
      </div>

      {error && (
        <div className="rounded-md bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* Table */}
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
                <th className="px-4 py-3 font-medium">Agent</th>
                <th className="px-4 py-3 font-medium">Valid Until</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                    Loading quotations...
                  </td>
                </tr>
              ) : quotations.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                    No quotations found.
                  </td>
                </tr>
              ) : (
                quotations.map((q) => {
                  const leadObj = typeof q.leadId === 'object' ? q.leadId : null;
                  const leadName = q.clientName || leadObj?.companyName || 'Valued Client';
                  const contactPerson = leadObj?.contactPerson || null;
                  const agentName =
                    typeof q.createdBy === 'object' && q.createdBy?.name
                      ? q.createdBy.name
                      : 'System';
                  const statusClass = STATUS_STYLES[q.status] || 'border-slate-200 bg-slate-100 text-slate-700';
                  const rowId = q.id || q._id || '';

                  return (
                    <tr key={rowId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                        <Link href={`/quotations/${rowId}`} className="hover:underline">
                          {q.quoteNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900 dark:text-white">
                          {leadName}
                        </div>
                        {contactPerson && (
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block shrink-0" />
                            <span>{contactPerson}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">{formatRupees(q.subtotal)}</td>
                      <td className="px-4 py-3 text-slate-500">{formatRupees(q.taxAmount)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                        {formatRupees(q.total)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusClass}`}>
                          {q.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-medium">
                          {agentName}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        <div>{formatDate(q.validUntil)}</div>
                        {(() => {
                          if (q.status !== 'Sent' || !q.validUntil) return null;
                          const validDate = new Date(q.validUntil);
                          const now = new Date();
                          const d1 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                          const d2 = new Date(validDate.getFullYear(), validDate.getMonth(), validDate.getDate());
                          const diffDays = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));

                          if (diffDays < 0) {
                            return (
                              <span className="mt-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900">
                                Expired
                              </span>
                            );
                          }
                          if (diffDays <= 3) {
                            return (
                              <span className="mt-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900">
                                {diffDays === 0 ? 'Expires today' : `Expires in ${diffDays}d`}
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/quotations/${rowId}`}
                          className="inline-flex items-center justify-center rounded-md border border-blue-200/60 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-900/50 transition"
                        >
                          View
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
