'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { financeApi } from '@/modules/finance/api';
import type { PaymentIn } from '@/modules/finance/types';
import { RecentPaymentsTable } from '@/modules/finance/components/RecentPaymentsTable';
import { PaymentInModal } from '@/modules/finance/components/PaymentInModal';
import { CampaignDetailModal } from '@/modules/finance/components/CampaignDetailModal';
import { formatPaise } from '@/modules/finance/utils/formatters';
import { RequireAuth } from '@/shared/auth/require-auth';
import { RefreshCw, Plus, CheckCircle, Clock } from 'lucide-react';

export default function PaymentsInPage() {
  const [payments, setPayments] = useState<PaymentIn[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await financeApi.getPaymentsIn({ limit: 100 });
      setPayments(res.payments || []);
      setTotalAmount(res.totalAmount || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const handleReconcile = async (id: string) => {
    try {
      await financeApi.reconcilePaymentIn(id);
      fetchPayments();
    } catch (err: any) {
      alert(err?.message || 'Failed to reconcile payment');
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
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Client Payments</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Complete transaction record of all client collections, bank transfers, and reconciliations
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchPayments}
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
            <span>Record Payment</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 border-l-4 border-l-[#6E1D1D] shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Received</span>
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
          <p className="text-xs text-slate-400 mt-1">Verified against bank statements</p>
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
      <RecentPaymentsTable
        payments={payments}
        onNewPayment={() => setShowModal(true)}
        onViewDetails={(p) => {
          if (p.campaignId && p.campaignId !== 'undefined' && p.campaignId !== 'null') {
            setSelectedCampaignId(p.campaignId);
          }
        }}
        onReconcile={handleReconcile}
        isFinanceOrAdmin={true}
      />

      <PaymentInModal
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
