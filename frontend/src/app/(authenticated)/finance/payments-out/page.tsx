'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { financeApi } from '@/modules/finance/api';
import type { PaymentOut } from '@/modules/finance/types';
import { PaymentOutModal } from '@/modules/finance/components/PaymentOutModal';
import { CampaignDetailModal } from '@/modules/finance/components/CampaignDetailModal';
import { formatPaise, formatDate } from '@/modules/finance/utils/formatters';
import { RequireAuth } from '@/shared/auth/require-auth';
import { RefreshCw, Plus, CheckCircle, Clock, Search, ArrowUpRight } from 'lucide-react';

export default function PaymentsOutPage() {
  const [payments, setPayments] = useState<PaymentOut[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchPayments = useCallback(async () => {
    try {
      const res = await financeApi.getPaymentsOut({ limit: 100 });
      setPayments(res.payments || []);
      setTotalAmount(res.totalAmount || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPayments();
  }, [fetchPayments]);

  const handleRefresh = async () => {
    setLoading(true);
    await fetchPayments();
  };

  const handleReconcile = async (id: string) => {
    try {
      await financeApi.reconcilePaymentOut(id);
      fetchPayments();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message || 'Failed to reconcile expense';
      alert(msg);
    }
  };

  const filtered = payments.filter((p) => {
    const matchesSearch =
      !search ||
      p.clientName?.toLowerCase().includes(search.toLowerCase()) ||
      p.client?.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.vendorName?.toLowerCase().includes(search.toLowerCase()) ||
      p.campaignName?.toLowerCase().includes(search.toLowerCase()) ||
      p.campaignCode?.toLowerCase().includes(search.toLowerCase()) ||
      p.vendorInvoice?.toLowerCase().includes(search.toLowerCase()) ||
      p.transactionId?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
    const matchesMethod = methodFilter === 'all' || p.method === methodFilter;
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'reconciled' && p.reconciled) ||
      (statusFilter === 'pending' && !p.reconciled);
    return matchesSearch && matchesCategory && matchesMethod && matchesStatus;
  });

  const getMethodBadge = (method: string) => {
    switch (method) {
      case 'bank_transfer':
        return <span className="px-2 py-0.5 text-[11px] font-semibold bg-blue-50 text-blue-700 rounded-md border border-blue-200">Bank Transfer</span>;
      case 'upi':
        return <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200">UPI</span>;
      case 'cheque':
        return <span className="px-2 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-700 rounded-md border border-amber-200">Cheque</span>;
      case 'credit_card':
        return <span className="px-2 py-0.5 text-[11px] font-semibold bg-purple-50 text-purple-700 rounded-md border border-purple-200">Credit Card</span>;
      default:
        return <span className="px-2 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-700 rounded-md border border-slate-200">{method}</span>;
    }
  };

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'media_cost':
        return <span className="px-2 py-0.5 text-[11px] font-semibold bg-red-50 text-[#6E1D1D] rounded-md border border-red-200">Media Cost</span>;
      case 'production_cost':
        return <span className="px-2 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-700 rounded-md border border-amber-200">Production</span>;
      case 'logistics':
        return <span className="px-2 py-0.5 text-[11px] font-semibold bg-blue-50 text-blue-700 rounded-md border border-blue-200">Logistics</span>;
      default:
        return <span className="px-2 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-700 rounded-md border border-slate-200">{cat || 'Other'}</span>;
    }
  };

  const reconciledCount = payments.filter((p) => p.reconciled).length;
  const pendingCount = payments.length - reconciledCount;

  return (
    <RequireAuth permission="finance.view_payments">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Vendor Payments</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Complete disbursement ledger of media costs, printing, flex production, and vendor reconciliations
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-2 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 text-xs font-semibold bg-[#6E1D1D] hover:bg-[#581717] text-white rounded-lg shadow-2xs transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Record Expense</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 border-l-4 border-l-[#6E1D1D] shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Disbursed</span>
            <span className="font-bold text-[#6E1D1D] text-xs">₹</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">{formatPaise(totalAmount)}</div>
          <p className="text-xs text-slate-400 mt-1">{payments.length} total transactions</p>
        </div>

        <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 border-l-4 border-l-emerald-500 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Reconciled</span>
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700">{reconciledCount}</div>
          <p className="text-xs text-slate-400 mt-1">Verified with vendor invoice</p>
        </div>

        <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 border-l-4 border-l-amber-500 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Pending Audit</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-700">{pendingCount}</div>
          <p className="text-xs text-slate-400 mt-1">Awaiting finance manager signoff</p>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Table Header Controls */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900">Recent Vendor Payments (Payment-Out)</h3>
            <p className="text-xs text-slate-500 mt-0.5">Real-time ledger of recorded vendor disbursements and expenses</p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search */}
            <div className="relative flex-1 sm:w-60">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search vendor, txn..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6E1D1D]/20 focus:border-[#6E1D1D] text-slate-900 transition-colors"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6E1D1D]/20 focus:border-[#6E1D1D] text-slate-700 font-medium transition-colors"
            >
              <option value="all">All Statuses</option>
              <option value="reconciled">Reconciled</option>
              <option value="pending">Pending Audit</option>
            </select>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6E1D1D]/20 focus:border-[#6E1D1D] text-slate-700 font-medium transition-colors"
            >
              <option value="all">All Categories</option>
              <option value="media_cost">Media Cost</option>
              <option value="production_cost">Production</option>
              <option value="logistics">Logistics</option>
              <option value="other">Other</option>
            </select>

            {/* Method Filter */}
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6E1D1D]/20 focus:border-[#6E1D1D] text-slate-700 font-medium transition-colors"
            >
              <option value="all">All Methods</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="upi">UPI</option>
              <option value="cheque">Cheque</option>
              <option value="credit_card">Credit Card</option>
              <option value="cash">Cash</option>
            </select>

            <button
              onClick={() => setShowModal(true)}
              className="px-3.5 py-1.5 text-xs font-semibold bg-[#6E1D1D] hover:bg-[#581717] text-white rounded-lg shadow-2xs transition-colors whitespace-nowrap flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Expense</span>
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
              <tr>
                <th className="px-4 sm:px-5 py-3">Payment Date</th>
                <th className="px-4 sm:px-5 py-3">Client Name</th>
                <th className="px-4 sm:px-5 py-3">Campaign</th>
                <th className="px-4 sm:px-5 py-3">Vendor</th>
                <th className="px-4 sm:px-5 py-3 text-right">Amount (₹)</th>
                <th className="px-4 sm:px-5 py-3">Category</th>
                <th className="px-4 sm:px-5 py-3">Method</th>
                <th className="px-4 sm:px-5 py-3">Txn Reference</th>
                <th className="px-4 sm:px-5 py-3">Status</th>
                <th className="px-4 sm:px-5 py-3">Recorded By</th>
                <th className="px-4 sm:px-5 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-5 py-8 text-center text-slate-400">
                    No payment records found
                  </td>
                </tr>
              ) : (
                filtered.map((payment) => (
                  <tr
                    key={payment.id || payment._id}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    onClick={() => {
                      if (payment.campaignId && payment.campaignId !== 'undefined' && payment.campaignId !== 'null') {
                        setSelectedCampaignId(payment.campaignId);
                      }
                    }}
                  >
                    <td className="px-4 sm:px-5 py-3.5 whitespace-nowrap font-medium text-slate-900">
                      {formatDate(payment.paidAt)}
                    </td>
                    <td className="px-4 sm:px-5 py-3.5">
                      <div className="font-semibold text-slate-900 line-clamp-1">
                        {payment.clientName || payment.client?.name || '—'}
                      </div>
                    </td>
                    <td className="px-4 sm:px-5 py-3.5">
                      <div className="font-semibold text-slate-900 group-hover:text-[#6E1D1D] transition-colors line-clamp-1">
                        {payment.campaignName || 'Campaign'}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {payment.campaignCode || payment.campaignId}
                      </div>
                    </td>
                    <td className="px-4 sm:px-5 py-3.5">
                      <div className="font-semibold text-slate-900 line-clamp-1">
                        {payment.vendorName || 'Vendor'}
                      </div>
                      {payment.vendorInvoice && (
                        <div className="text-[11px] text-slate-400 font-mono">
                          Inv: {payment.vendorInvoice}
                        </div>
                      )}
                    </td>
                    <td className="px-4 sm:px-5 py-3.5 text-right whitespace-nowrap font-mono font-bold text-slate-900">
                      {formatPaise(payment.amount)}
                    </td>
                    <td className="px-4 sm:px-5 py-3.5 whitespace-nowrap">
                      {getCategoryBadge(payment.category)}
                    </td>
                    <td className="px-4 sm:px-5 py-3.5 whitespace-nowrap">
                      {getMethodBadge(payment.method)}
                    </td>
                    <td className="px-4 sm:px-5 py-3.5 font-mono text-[11px] text-slate-500">
                      {payment.transactionId || '—'}
                    </td>
                    <td className="px-4 sm:px-5 py-3.5 whitespace-nowrap">
                      {payment.reconciled ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
                          <CheckCircle className="w-3 h-3" /> Reconciled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-semibold bg-amber-50 text-amber-700 rounded-full border border-amber-200">
                          <Clock className="w-3 h-3" /> Pending Audit
                        </span>
                      )}
                    </td>
                    <td className="px-4 sm:px-5 py-3.5 whitespace-nowrap text-slate-600">
                      {payment.recordedBy?.name || 'Staff'}
                    </td>
                    <td className="px-4 sm:px-5 py-3.5 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1.5">
                        {!payment.reconciled && (
                          <button
                            onClick={() => handleReconcile(payment.id || payment._id!)}
                            className="px-2 py-1 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md shadow-2xs transition-colors"
                            title="Verify & Reconcile Payment"
                          >
                            Verify
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (payment.campaignId && payment.campaignId !== 'undefined' && payment.campaignId !== 'null') {
                              setSelectedCampaignId(payment.campaignId);
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                          title="View Details"
                        >
                          <ArrowUpRight className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PaymentOutModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={fetchPayments}
      />

      <CampaignDetailModal
        campaignId={selectedCampaignId}
        onClose={() => setSelectedCampaignId(null)}
      />
    </div>
    </RequireAuth>
  );
}
