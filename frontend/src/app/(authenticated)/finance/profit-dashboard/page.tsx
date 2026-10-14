'use client';

import React, { useState } from 'react';
import { useProfitDashboard, type TimeRange } from '@/modules/finance/hooks/use-profit-dashboard';
import { ProfitSummaryCards } from '@/modules/finance/components/ProfitSummaryCards';
import { ProfitTrendChart } from '@/modules/finance/components/ProfitTrendChart';
import { ExpenseBreakdownChart } from '@/modules/finance/components/ExpenseBreakdownChart';
import { ProfitByCampaignChart } from '@/modules/finance/components/ProfitByCampaignChart';
import { RevenueVsExpenseChart } from '@/modules/finance/components/RevenueVsExpenseChart';
import { AlertsPanel } from '@/modules/finance/components/AlertsPanel';
import { CampaignPerformanceMatrix } from '@/modules/finance/components/CampaignPerformanceMatrix';
import { CampaignDetailModal } from '@/modules/finance/components/CampaignDetailModal';
import { RefreshCw, TrendingUp, FileText, Download, ArrowUpRight } from 'lucide-react';
import { formatPaise, formatPercent } from '@/modules/finance/utils/formatters';
import { financeApi } from '@/modules/finance/api';
import { RequireAuth } from '@/shared/auth/require-auth';

export default function ProfitDashboardPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const { data, loading, error, refresh } = useProfitDashboard(timeRange);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [runningRollup, setRunningRollup] = useState(false);

  const handleRunRollup = async () => {
    setRunningRollup(true);
    try {
      const res = await financeApi.runRollupJob();
      alert(`Nightly rollup job completed! Processed ${res.processed} campaigns with total profit ${formatPaise(res.totalProfit)}`);
      refresh();
    } catch (err: any) {
      alert(err?.message || 'Failed to execute profit calculation rollup');
    } finally {
      setRunningRollup(false);
    }
  };

  const handleExportCSV = () => {
    const list = [...data.topCampaigns, ...data.bottomCampaigns];
    if (list.length === 0) return;

    const headers = ['Campaign', 'CampaignCode', 'Contract Value (Paise)', 'Revenue', 'Expenses', 'Profit', 'Margin %', 'Payment Status'];
    const rows = list.map((c) => [
      `"${c.campaignName || ''}"`,
      c.campaignCode || '',
      c.contractedValue || 0,
      c.revenue || 0,
      c.expenses || 0,
      c.profit || 0,
      c.margin || 0,
      c.paymentStatus || '',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `profit_leadership_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <RequireAuth permission="finance.view_leadership_reports">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Profit & Financial Dashboard</h1>
            {/* <span className="px-2.5 py-0.5 text-xs font-bold bg-emerald-100 text-emerald-800 rounded-full">
              F5 Leadership View
            </span> */}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Executive profitability audit, daily profit trends, expense centers, and risk alert monitoring
          </p>
        </div>

        {/* Timeframe & Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="bg-gray-100 p-1 rounded-lg flex items-center gap-1 border border-gray-200">
            <button
              onClick={() => setTimeRange('today')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${timeRange === 'today' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              Today
            </button>
            <button
              onClick={() => setTimeRange('month')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${timeRange === 'month' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              Month (30d)
            </button>
            <button
              onClick={() => setTimeRange('quarter')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${timeRange === 'quarter' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              Quarter (90d)
            </button>
          </div>

          <button
            onClick={() => refresh()}
            disabled={loading}
            className="p-2 text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg shadow-xs transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleRunRollup}
            disabled={runningRollup}
            className="px-3.5 py-2 text-xs font-semibold bg-gray-900 hover:bg-black text-white rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
            title="Run nightly rollup calculation job now"
          >
            <TrendingUp className={`w-3.5 h-3.5 ${runningRollup ? 'animate-spin' : ''}`} />
            <span>{runningRollup ? 'Calculating...' : 'Run F3 Rollup'}</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 text-xs font-semibold bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
          >
            <FileText className="w-4 h-4 text-emerald-600" />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-medium">
          {error}
        </div>
      )}

      {/* 1. Profit Summary Cards */}
      <ProfitSummaryCards
        totalProfit={data.totalProfit}
        margin={data.margin}
        revenue={data.revenue}
        expenses={data.expenses}
        activeCount={data.activeCount}
      />

      {/* 2. Executive Alerts Panel */}
      <AlertsPanel
        alerts={data.alerts}
        onSelectCampaign={(id) => setSelectedCampaignId(id)}
      />

      {/* 3. Charts Grid 1: Profit Trend (30d) & Expense Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProfitTrendChart trends={data.trends} />
        <ExpenseBreakdownChart breakdown={data.breakdown} />
      </div>

      {/* 4. Charts Grid 2: Profit by Campaign & Revenue vs Expenses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProfitByCampaignChart
          campaigns={data.topCampaigns}
          onSelectCampaign={(c) => setSelectedCampaignId(c.campaignId)}
        />
        <RevenueVsExpenseChart trends={data.trends} />
      </div>

      {/* 5. Campaign Performance Matrix */}
      <CampaignPerformanceMatrix
        campaigns={[...data.topCampaigns, ...data.bottomCampaigns]}
        onSelectCampaign={(c) => {
          if (c.campaignId && c.campaignId !== 'undefined' && c.campaignId !== 'null') {
            setSelectedCampaignId(c.campaignId);
          }
        }}
      />

      {/* 6. Top 5 Profitable vs Bottom 5 / Risk Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Profitable */}
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-xs">
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 text-emerald-800 flex items-center justify-between">
            <span>Top 5 Profitable Campaigns</span>
            <span className="text-xs font-normal text-gray-500">Highest Net Margins</span>
          </h3>
          <div className="divide-y divide-gray-100">
            {data.topCampaigns.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center italic">No campaigns recorded</p>
            ) : (
              data.topCampaigns.map((c) => (
                <div
                  key={c.id || c._id || c.campaignId}
                  onClick={() => {
                    if (c.campaignId && c.campaignId !== 'undefined' && c.campaignId !== 'null') {
                      setSelectedCampaignId(c.campaignId);
                    }
                  }}
                  className="py-3 flex items-center justify-between hover:bg-emerald-50/40 px-2 rounded-lg cursor-pointer transition-colors"
                >
                  <div>
                    <span className="text-xs font-bold text-gray-900">{c.campaignName}</span>
                    <span className="text-[11px] text-gray-400 block font-mono">{c.campaignCode}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-emerald-700 block">
                      +{formatPaise(c.profit)}
                    </span>
                    <span className="text-[11px] font-semibold text-emerald-600">
                      {formatPercent(c.margin)} margin
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Bottom 5 / Losses */}
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-xs">
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 text-red-800 flex items-center justify-between">
            <span>Bottom 5 / Margin Review List</span>
            <span className="text-xs font-normal text-gray-500">Margin &lt; 10% or Loss</span>
          </h3>
          <div className="divide-y divide-gray-100">
            {data.bottomCampaigns.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center italic">No low-margin campaigns found</p>
            ) : (
              data.bottomCampaigns.map((c) => (
                <div
                  key={c.id || c._id || c.campaignId}
                  onClick={() => {
                    if (c.campaignId && c.campaignId !== 'undefined' && c.campaignId !== 'null') {
                      setSelectedCampaignId(c.campaignId);
                    }
                  }}
                  className="py-3 flex items-center justify-between hover:bg-red-50/40 px-2 rounded-lg cursor-pointer transition-colors"
                >
                  <div>
                    <span className="text-xs font-bold text-gray-900">{c.campaignName}</span>
                    <span className="text-[11px] text-gray-400 block font-mono">{c.campaignCode}</span>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-mono font-bold block ${c.profit < 0 ? 'text-red-600' : 'text-amber-600'}`}>
                      {formatPaise(c.profit)}
                    </span>
                    <span className="text-[11px] font-semibold text-red-500">
                      {formatPercent(c.margin)} margin
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Drilldown Modal */}
      <CampaignDetailModal
        campaignId={selectedCampaignId}
        onClose={() => setSelectedCampaignId(null)}
      />
    </div>
    </RequireAuth>
  );
}
