'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { RequireAuth } from '@/shared/auth/require-auth';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Download,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  DollarSign,
  Copy,
  History,
  ChevronDown,
  ArrowRight,
} from 'lucide-react';
import { invoicesApi } from '@/modules/finance/api';
import type { Invoice, InvoiceEditLog } from '@/modules/finance/types';
import { formatCurrency, formatDate } from '@/modules/finance/utils/formatters';
import { InvoiceEditHistoryModal } from '@/modules/finance/components/InvoiceEditHistoryModal';

type InvoiceTab = 'sales' | 'proforma';

function InvoicesManagementContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'proforma' ? 'proforma' : 'sales';

  const [activeTab, setActiveTab] = useState<InvoiceTab>(initialTab);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [totalStats, setTotalStats] = useState({
    totalAmount: 0,
    totalReceived: 0,
    totalBalance: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Dropdown create menu state
  const [createDropdownOpen, setCreateDropdownOpen] = useState(false);

  // History modal state
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState<InvoiceEditLog[]>([]);
  const [historyInvoiceNum, setHistoryInvoiceNum] = useState('');

  // Synchronize tab state with URL parameter
  const handleTabChange = (tab: InvoiceTab) => {
    setActiveTab(tab);
    setPage(1);
    setStatusFilter('all');
    setSearch('');
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.replace(`/finance/invoices?${params.toString()}`);
  };

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const type = activeTab === 'proforma' ? 'proforma' : 'sales_invoice';
      const res = await invoicesApi.getInvoices({
        type,
        status: statusFilter,
        search: search.trim() || undefined,
        page,
        pageSize: 20,
      });

      setInvoices(res.invoices || []);
      setTotalStats({
        totalAmount: res.totalAmount || 0,
        totalReceived: res.totalReceived || 0,
        totalBalance: res.totalBalance || 0,
        total: res.total || 0,
      });
      setTotalPages(res.totalPages || 1);
    } catch (err) {
      console.error('Failed to load invoices:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, statusFilter, search, page]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const handleDuplicate = async (id: string) => {
    try {
      await invoicesApi.duplicateInvoice(id);
      fetchInvoices();
    } catch (err) {
      console.error('Failed to duplicate invoice:', err);
    }
  };

  const handleConvertToSalesInvoice = async (id: string) => {
    try {
      const res = await invoicesApi.convertToSalesInvoice(id);
      if (res.invoice?.id) {
        handleTabChange('sales');
        fetchInvoices();
      }
    } catch (err: any) {
      console.error('Failed to convert proforma:', err);
      alert(err?.message || 'Failed to convert proforma invoice');
    }
  };

  const handleDelete = async (id: string, invoiceNumber: string) => {
    if (confirm(`Are you sure you want to soft-delete invoice ${invoiceNumber}?`)) {
      try {
        await invoicesApi.deleteInvoice(id);
        fetchInvoices();
      } catch (err: any) {
        alert(err?.message || 'Failed to delete invoice');
      }
    }
  };

  const openHistory = (invoice: Invoice) => {
    setHistoryInvoiceNum(invoice.invoiceNumber);
    setHistoryItems(invoice.editHistory || []);
    setHistoryModalOpen(true);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header with Title and Create Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Invoices</h1>
          <p className="text-xs text-slate-500 mt-1">
            Unified billing management for Tax Invoices and Proforma Invoices with GST calculation and live tracking.
          </p>
        </div>

        {/* Create Invoice Split/Dropdown Button */}
        <div className="relative">
          <div className="inline-flex rounded-lg shadow-sm">
            <Link
              href={activeTab === 'proforma' ? '/finance/invoices/new?type=proforma' : '/finance/invoices/new'}
              className="inline-flex items-center gap-2 rounded-l-lg bg-[#6E1D1D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#581717] transition-all"
            >
              <Plus className="h-4 w-4" />
              {activeTab === 'proforma' ? 'Create Proforma Invoice' : 'Create Sales Invoice'}
            </Link>
            <button
              type="button"
              onClick={() => setCreateDropdownOpen((prev) => !prev)}
              className="inline-flex items-center rounded-r-lg bg-[#581717] px-2.5 py-2 text-xs font-semibold text-white hover:bg-[#481212] transition-colors border-l border-white/20"
              title="More invoice creation options"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>

          {createDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => setCreateDropdownOpen(false)}
              />
              <div className="absolute right-0 mt-1 z-30 w-56 rounded-xl bg-white p-1.5 shadow-xl border border-slate-200 text-xs">
                <Link
                  href="/finance/invoices/new"
                  onClick={() => setCreateDropdownOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-slate-700 hover:bg-[#F8E6E6] hover:text-[#6E1D1D] transition-colors"
                >
                  <FileText className="h-4 w-4 text-[#6E1D1D]" />
                  <div>
                    <p className="font-semibold">Create Sales Invoice</p>
                    <p className="text-[10px] text-slate-500">Tax Invoice for client billing</p>
                  </div>
                </Link>
                <Link
                  href="/finance/invoices/new?type=proforma"
                  onClick={() => setCreateDropdownOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-slate-700 hover:bg-[#F8E6E6] hover:text-[#6E1D1D] transition-colors"
                >
                  <FileText className="h-4 w-4 text-slate-500" />
                  <div>
                    <p className="font-semibold">Create Proforma Invoice</p>
                    <p className="text-[10px] text-slate-500">Estimate / Quote for approval</p>
                  </div>
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => handleTabChange('sales')}
          className={`flex items-center gap-2 px-6 py-3 text-xs font-bold transition-all border-b-2 -mb-px ${
            activeTab === 'sales'
              ? 'border-[#6E1D1D] text-[#6E1D1D] bg-[#F8E6E6]/40'
              : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <FileText className="h-4 w-4" />
          Sales Invoices
          {activeTab === 'sales' && (
            <span className="ml-1.5 rounded-full bg-[#6E1D1D] px-2 py-0.5 text-[10px] text-white">
              {totalStats.total}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('proforma')}
          className={`flex items-center gap-2 px-6 py-3 text-xs font-bold transition-all border-b-2 -mb-px ${
            activeTab === 'proforma'
              ? 'border-[#6E1D1D] text-[#6E1D1D] bg-[#F8E6E6]/40'
              : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <FileText className="h-4 w-4" />
          Proforma Invoices
          {activeTab === 'proforma' && (
            <span className="ml-1.5 rounded-full bg-[#6E1D1D] px-2 py-0.5 text-[10px] text-white">
              {totalStats.total}
            </span>
          )}
        </button>
      </div>

      {/* Dynamic Summary Cards */}
      {activeTab === 'sales' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Total Billed</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                <FileText className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 text-xl font-bold text-slate-900">{formatCurrency(totalStats.totalAmount)}</p>
            <p className="mt-1 text-[11px] text-slate-400">across {totalStats.total} sales invoices</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Received In</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <CheckCircle className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 text-xl font-bold text-emerald-600">{formatCurrency(totalStats.totalReceived)}</p>
            <p className="mt-1 text-[11px] text-emerald-600 font-medium">collected & settled</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Outstanding Balance</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <Clock className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 text-xl font-bold text-[#6E1D1D]">{formatCurrency(totalStats.totalBalance)}</p>
            <p className="mt-1 text-[11px] text-amber-600 font-medium">pending receivable</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Recovery Rate</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                <TrendingUp className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 text-xl font-bold text-slate-900">
              {totalStats.totalAmount > 0
                ? `${Math.round((totalStats.totalReceived / totalStats.totalAmount) * 100)}%`
                : '100%'}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">settlement ratio</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Total Proforma Value</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                <FileText className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 text-xl font-bold text-slate-900">{formatCurrency(totalStats.totalAmount)}</p>
            <p className="mt-1 text-[11px] text-slate-400">{totalStats.total} proforma estimates</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Active Proposals</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                <Clock className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 text-xl font-bold text-blue-600">{totalStats.total}</p>
            <p className="mt-1 text-[11px] text-slate-400">ready for conversion</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Quick Workflow</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
                <ArrowRight className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-700 font-medium">1-Click Convert to Tax Invoice</p>
            <p className="mt-1 text-[11px] text-slate-400">converts proforma to live invoice</p>
          </div>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder={
              activeTab === 'sales'
                ? 'Search by invoice #, party, or GSTIN...'
                : 'Search by proforma #, party...'
            }
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-1.5 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#6E1D1D] focus:bg-white focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-[#6E1D1D] focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="Draft">Draft</option>
            <option value="Sent">Sent</option>
            {activeTab === 'sales' ? (
              <>
                <option value="Partially Paid">Partially Paid</option>
                <option value="Paid">Paid</option>
                <option value="Overdue">Overdue</option>
              </>
            ) : (
              <>
                <option value="Accepted">Accepted</option>
                <option value="Rejected">Rejected</option>
              </>
            )}
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-500">Loading invoice ledger...</div>
        ) : invoices.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <FileText className="h-8 w-8 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">
              No {activeTab === 'proforma' ? 'proforma' : 'sales'} invoices found
            </p>
            <p className="text-xs text-slate-400">
              {search || statusFilter !== 'all'
                ? 'Try adjusting your search terms or filter.'
                : 'Create your first invoice to get started.'}
            </p>
            <Link
              href={activeTab === 'proforma' ? '/finance/invoices/new?type=proforma' : '/finance/invoices/new'}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#6E1D1D] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#581717]"
            >
              <Plus className="h-4 w-4" />
              {activeTab === 'proforma' ? 'Create Proforma Invoice' : 'Create Sales Invoice'}
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                  <th className="py-3 px-3 w-10 text-center">#</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Invoice Number</th>
                  <th className="py-3 px-3">Party Name</th>
                  <th className="py-3 px-3">Due Date</th>
                  <th className="py-3 px-3 text-right">Total Amount</th>
                  {activeTab === 'sales' && (
                    <>
                      <th className="py-3 px-3 text-right">Received</th>
                      <th className="py-3 px-3 text-right">Balance</th>
                    </>
                  )}
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv, idx) => (
                  <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-3 text-center text-slate-400">
                      {(page - 1) * 20 + idx + 1}
                    </td>
                    <td className="py-3 px-3 text-slate-600 font-medium">
                      {formatDate(inv.invoiceDate)}
                    </td>
                    <td className="py-3 px-3">
                      <Link
                        href={`/finance/invoices/${inv.id}`}
                        className="font-bold text-[#6E1D1D] hover:underline font-mono"
                      >
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="py-3 px-3">
                      <p className="font-semibold text-slate-900">{inv.partyName}</p>
                      {inv.gstin && <p className="text-[10px] text-slate-400 font-mono">GST: {inv.gstin}</p>}
                    </td>
                    <td className="py-3 px-3 text-slate-500">{formatDate(inv.dueDate)}</td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900">
                      {formatCurrency(inv.totalAmount)}
                    </td>
                    {activeTab === 'sales' && (
                      <>
                        <td className="py-3 px-3 text-right font-semibold text-emerald-600">
                          {formatCurrency(inv.amountReceived)}
                        </td>
                        <td className="py-3 px-3 text-right font-bold">
                          <span className={inv.balanceAmount > 0 ? 'text-[#6E1D1D]' : 'text-slate-400'}>
                            {formatCurrency(inv.balanceAmount)}
                          </span>
                        </td>
                      </>
                    )}
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          inv.status === 'Paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : inv.status === 'Partially Paid'
                            ? 'bg-amber-100 text-amber-800'
                            : inv.status === 'Overdue'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* View */}
                        <Link
                          href={`/finance/invoices/${inv.id}`}
                          className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
                          title="View Invoice"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>

                        {/* Convert to Sales Invoice (for proforma) */}
                        {activeTab === 'proforma' && (
                          <button
                            type="button"
                            onClick={() => handleConvertToSalesInvoice(inv.id)}
                            className="p-1 text-[#6E1D1D] hover:bg-[#F8E6E6] rounded"
                            title="Convert to Sales Tax Invoice"
                          >
                            <ArrowRight className="h-4 w-4" />
                          </button>
                        )}

                        {/* Edit */}
                        <Link
                          href={`/finance/invoices/${inv.id}/edit`}
                          className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </Link>

                        {/* History */}
                        <button
                          type="button"
                          onClick={() => openHistory(inv)}
                          className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
                          title="Audit Trail"
                        >
                          <History className="h-4 w-4" />
                        </button>

                        {/* Duplicate */}
                        <button
                          type="button"
                          onClick={() => handleDuplicate(inv.id)}
                          className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
                          title="Duplicate"
                        >
                          <Copy className="h-4 w-4" />
                        </button>

                        {/* Download PDF */}
                        <a
                          href={invoicesApi.getPdfDownloadUrl(inv.id)}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
                          title="Download PDF"
                        >
                          <Download className="h-4 w-4" />
                        </a>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => handleDelete(inv.id, inv.invoiceNumber)}
                          className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-slate-100"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 bg-slate-50 text-xs">
            <span className="text-slate-500">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded border border-slate-200 bg-white text-slate-700 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded border border-slate-200 bg-white text-slate-700 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit History Modal */}
      <InvoiceEditHistoryModal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        invoiceNumber={historyInvoiceNum}
        history={historyItems}
      />
    </div>
  );
}

export default function InvoicesPage() {
  return (
    <RequireAuth permission="finance.view_payments">
      <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500">Loading invoices...</div>}>
        <InvoicesManagementContent />
      </Suspense>
    </RequireAuth>
  );
}
