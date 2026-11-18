'use client';

import { useState, useEffect } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Users,
  RefreshCw,
  ExternalLink,
  Target,
  BarChart3,
  CheckCircle2,
  CreditCard,
  Pencil,
} from 'lucide-react';
import { marketingApi } from '../api';
import type { MarketingDashboardData } from '../types';

function formatINR(val: number) {
  return '₹' + (val || 0).toLocaleString('en-IN');
}

export default function MarketingOverviewTab() {
  const [data, setData] = useState<MarketingDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  // Budget Set modal state
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgetSubmitting, setBudgetSubmitting] = useState(false);
  const [plannedBudgetInput, setPlannedBudgetInput] = useState<number>(150000);

  const loadData = async (m?: string) => {
    try {
      setLoading(true);
      const res = await marketingApi.getOverview(m || selectedMonth);
      setData(res);
      if (res?.budget?.planned) {
        setPlannedBudgetInput(res.budget.planned);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(selectedMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth]);

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setBudgetSubmitting(true);
      await marketingApi.setBudget({
        month: selectedMonth,
        period: 'Monthly',
        plannedAmount: plannedBudgetInput,
      });
      setShowBudgetModal(false);
      await loadData();
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        (err.response?.data?.errors ? Object.values(err.response.data.errors).join(', ') : err.message);
      alert(msg || 'Failed to update planned budget');
    } finally {
      setBudgetSubmitting(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-500">
        <RefreshCw className="mr-2 h-4 w-4 animate-spin text-[#8B2424]" />
        Loading Marketing ROI metrics...
      </div>
    );
  }

  const budget = data?.budget;
  const metrics = data?.metrics;

  return (
    <div className="space-y-6">
      {/* Month Selector Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Marketing ROI &amp; Performance Overview</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Internal Marketing Team spend, inbound leads attribution, and executive ROI metrics
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-[#8B2424] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          />
          <button
            type="button"
            onClick={() => {
              if (data?.budget?.planned) setPlannedBudgetInput(data.budget.planned);
              setShowBudgetModal(true);
            }}
            className="flex items-center gap-1.5 rounded-xl border border-[#8B2424]/30 bg-[#F8E6E6] px-3.5 py-1.5 text-xs font-semibold text-[#8B2424] hover:bg-[#F8E6E6]/80 transition cursor-pointer shadow-2xs"
          >
            <CreditCard className="h-3.5 w-3.5" />
            <span>Set Budget</span>
          </button>
          <button
            type="button"
            onClick={() => loadData()}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 4 Executive KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Card 1: Budget vs Spend */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Marketing Budget
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                budget?.isAlert
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
              }`}
            >
              {budget?.utilizationPct}% Spent
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {formatINR(budget?.spent || 0)}
            </div>
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>Planned: {formatINR(budget?.planned || 0)} ({formatINR(budget?.remaining || 0)} left)</span>
              <button
                type="button"
                onClick={() => {
                  if (data?.budget?.planned) setPlannedBudgetInput(data.budget.planned);
                  setShowBudgetModal(true);
                }}
                className="text-[11px] font-bold text-[#8B2424] hover:underline inline-flex items-center gap-0.5 cursor-pointer ml-1"
                title="Edit planned budget"
              >
                <Pencil className="w-2.5 h-2.5" />
                <span>Edit</span>
              </button>
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className={`h-full transition-all duration-500 ${
                budget?.isAlert ? 'bg-rose-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, budget?.utilizationPct || 0)}%` }}
            />
          </div>
        </div>

        {/* Card 2: Inbound Leads */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Inbound Leads
            </span>
            <Users className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {metrics?.totalLeads || 0}
            </div>
            <div className="text-xs text-slate-400">
              {metrics?.wonDealsCount || 0} Deals Won &bull; CPL: {formatINR(metrics?.cpl || 0)}
            </div>
          </div>
          <div className="mt-3 text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            <span>High conversion quality pipeline</span>
          </div>
        </div>

        {/* Card 3: Revenue Attributed */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Attributed Revenue
            </span>
            <Target className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {formatINR(metrics?.totalRevenue || 0)}
            </div>
            <div className="text-xs text-slate-400">
              {metrics?.verifiedInvoicedRevenue ? (
                <span>
                  Invoiced: <strong className="text-slate-700 dark:text-slate-200">{formatINR(metrics.verifiedInvoicedRevenue)}</strong>
                  {metrics.verifiedCollectedCash ? (
                    <> &bull; Collected: <strong className="text-emerald-600">{formatINR(metrics.verifiedCollectedCash)}</strong></>
                  ) : null}
                </span>
              ) : (
                'From closed marketing deals'
              )}
            </div>
          </div>
          <div className="mt-3 text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center justify-between">
            <span>{metrics?.wonDealsCount || 0} clients converted</span>
            {metrics?.linkedInvoicesCount ? (
              <span className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 font-semibold px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                📄 {metrics.linkedInvoicesCount} Verified Invoices
              </span>
            ) : null}
          </div>
        </div>

        {/* Card 4: Net ROI & ROAS */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Marketing ROI
            </span>
            <TrendingUp className="h-4 w-4 text-[#8B2424]" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-[#8B2424]">
              {metrics?.roas || 0}x ROAS
            </div>
            <div className="text-xs text-slate-400">
              Net ROI: <span className="font-bold text-emerald-600">+{metrics?.netRoiPct || 0}%</span>
            </div>
          </div>
          <div className="mt-3 text-[11px] text-slate-500 flex items-center gap-1">
            <BarChart3 className="h-3 w-3 text-[#8B2424]" />
            <span>(Revenue - Spend) &divide; Spend</span>
          </div>
        </div>
      </div>

      {/* Two Matrix Tables: City Breakdown & Platform Breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Table 1: Platform-wise Performance */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Platform Performance Matrix
              </h3>
              <p className="text-[11px] text-slate-400">Spend, Leads, and ROAS by channel</p>
            </div>
            <span className="text-xs font-bold text-[#8B2424]">Channel ROI</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 dark:border-slate-800">
                  <th className="pb-2 font-semibold">Platform</th>
                  <th className="pb-2 font-semibold">Spend</th>
                  <th className="pb-2 font-semibold">Leads</th>
                  <th className="pb-2 font-semibold">Won</th>
                  <th className="pb-2 font-semibold">Revenue</th>
                  <th className="pb-2 font-semibold text-right">ROAS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {(data?.platformMatrix || []).map((row) => (
                  <tr key={row.platform} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 font-bold text-slate-800 dark:text-slate-200">{row.platform}</td>
                    <td className="py-2.5 text-slate-600 dark:text-slate-400">{formatINR(row.spend)}</td>
                    <td className="py-2.5 font-semibold text-slate-900 dark:text-white">{row.leadsCount}</td>
                    <td className="py-2.5 text-emerald-600 font-bold">{row.wonCount}</td>
                    <td className="py-2.5 text-slate-700 dark:text-slate-300 font-semibold">{formatINR(row.revenue)}</td>
                    <td className="py-2.5 text-right font-extrabold text-[#8B2424]">
                      {row.roasMultiplier > 0 ? `${row.roasMultiplier}x` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Table 2: City-wise Performance */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                City / Geography Matrix
              </h3>
              <p className="text-[11px] text-slate-400">Where marketing budget goes and revenue comes from</p>
            </div>
            <span className="text-xs font-bold text-[#8B2424]">Geo Impact</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 dark:border-slate-800">
                  <th className="pb-2 font-semibold">City</th>
                  <th className="pb-2 font-semibold">Spend</th>
                  <th className="pb-2 font-semibold">Leads</th>
                  <th className="pb-2 font-semibold">Won Deals</th>
                  <th className="pb-2 font-semibold text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {(data?.cityMatrix || []).map((row) => (
                  <tr key={row.city} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 font-bold text-slate-800 dark:text-slate-200">{row.city}</td>
                    <td className="py-2.5 text-slate-600 dark:text-slate-400">{formatINR(row.spend)}</td>
                    <td className="py-2.5 font-semibold text-slate-900 dark:text-white">{row.leadsCount}</td>
                    <td className="py-2.5 text-emerald-600 font-bold">{row.wonCount}</td>
                    <td className="py-2.5 text-right font-extrabold text-slate-900 dark:text-white">
                      {formatINR(row.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Set Monthly Budget Modal */}
      {showBudgetModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-xl border border-slate-200">
            <h3 className="font-bold text-base text-slate-900 mb-3 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#8B2424]" />
              Set Monthly Budget
            </h3>
            <form onSubmit={handleSaveBudget} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Month</label>
                <input
                  type="month"
                  value={selectedMonth}
                  disabled
                  className="w-full px-3 py-2 text-sm bg-slate-100 border border-slate-300 rounded-lg text-slate-700 font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Planned Amount (₹) *
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={plannedBudgetInput}
                  onChange={(e) => setPlannedBudgetInput(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B2424] font-bold text-slate-900"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowBudgetModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={budgetSubmitting}
                  className="px-3.5 py-1.5 text-xs bg-[#8B2424] hover:bg-[#721c1c] text-white rounded-lg font-semibold cursor-pointer disabled:opacity-50"
                >
                  {budgetSubmitting ? 'Saving...' : 'Save Budget'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
