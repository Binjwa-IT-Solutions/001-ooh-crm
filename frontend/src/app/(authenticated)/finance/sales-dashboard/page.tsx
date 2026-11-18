'use client';

import React, { useState } from 'react';
import { useSalesDashboard } from '@/modules/finance/hooks/use-sales-dashboard';
import { RevenueSummaryCards } from '@/modules/finance/components/RevenueSummaryCards';
import { RevenueByAgentChart } from '@/modules/finance/components/RevenueByAgentChart';
import { RevenueGrowthChart } from '@/modules/finance/components/RevenueGrowthChart';
import { PaymentStatusPie } from '@/modules/finance/components/PaymentStatusPie';
import { PaymentMethodsChart } from '@/modules/finance/components/PaymentMethodsChart';
import { RecentPaymentsTable } from '@/modules/finance/components/RecentPaymentsTable';
import { PaymentInModal } from '@/modules/finance/components/PaymentInModal';
import { CampaignDetailModal } from '@/modules/finance/components/CampaignDetailModal';
import { RefreshCw, Download, FileText, Plus } from 'lucide-react';
import { formatPaise } from '@/modules/finance/utils/formatters';
import type { PaymentIn } from '@/modules/finance/types';
import { financeApi } from '@/modules/finance/api';
import { RequireAuth } from '@/shared/auth/require-auth';

export default function SalesDashboardPage() {
  const { data, loading, error, refresh } = useSalesDashboard();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  const handleExportCSV = () => {
    if (!data.recentPayments || data.recentPayments.length === 0) return;

    const headers = ['Date', 'Campaign', 'CampaignCode', 'Amount (Paise)', 'Amount (Rupees)', 'Method', 'TransactionId', 'Status', 'RecordedBy'];
    const rows = data.recentPayments.map((p) => [
      p.receivedAt,
      `"${p.campaignName || ''}"`,
      p.campaignCode || '',
      p.amount,
      p.amount / 100,
      p.method,
      p.transactionId || '',
      p.reconciled ? 'Reconciled' : 'Pending',
      `"${p.recordedBy?.name || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `sales_revenue_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleReconcile = async (paymentId: string) => {
    try {
      await financeApi.reconcilePaymentIn(paymentId);
      refresh();
    } catch (err: any) {
      alert(err?.message || 'Failed to reconcile payment');
    }
  };

  return (
    <RequireAuth permission="finance.view_reports">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header & Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Sales Revenue Dashboard</h1>
            {/* <span className="px-2.5 py-0.5 text-xs font-bold bg-red-100 text-[#A4161A] rounded-full">
              F4 Module
            </span> */}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Track campaign pipeline value, customer payment collections, and sales agent attributions
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => refresh()}
            disabled={loading}
            className="p-2 text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg shadow-xs transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 text-xs font-semibold bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
          >
            <FileText className="w-4 h-4 text-emerald-600" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setShowPaymentModal(true)}
            className="px-4 py-2 text-xs font-bold bg-[#E63946] hover:bg-[#A4161A] text-white rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Record Payment</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-medium">
          {error}
        </div>
      )}

      {/* 1. Summary Cards */}
      <RevenueSummaryCards
        pipelineValue={data.pipelineValue}
        receivedValue={data.receivedValue}
        gap={data.gap}
        collectionRate={data.collectionRate}
      />

      {/* 2. Charts Grid 1: Revenue by Agent & Payment Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueByAgentChart data={data.byAgent} />
        <PaymentStatusPie
          statusData={data.byStatus}
          onSelectStatus={(status) => {
            console.log('Selected status:', status);
          }}
        />
      </div>

      {/* 3. Charts Grid 2: Revenue Growth Trajectory & Payment Methods */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueGrowthChart />
        <PaymentMethodsChart methodData={data.byMethod} />
      </div>

      {/* 4. Recent Payments Table */}
      <RecentPaymentsTable
        payments={data.recentPayments}
        onNewPayment={() => setShowPaymentModal(true)}
        onViewDetails={(payment: PaymentIn) => {
          if (payment.campaignId && payment.campaignId !== 'undefined' && payment.campaignId !== 'null') {
            setSelectedCampaignId(payment.campaignId);
          }
        }}
        onReconcile={handleReconcile}
        isFinanceOrAdmin={true}
      />

      {/* Modals */}
      <PaymentInModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onSuccess={() => refresh()}
      />

      <CampaignDetailModal
        campaignId={selectedCampaignId}
        onClose={() => setSelectedCampaignId(null)}
      />
    </div>
    </RequireAuth>
  );
}
