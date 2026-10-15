'use client';

import { useState, useEffect } from 'react';
import {
  CreditCard,
  Plus,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Users,
  Target,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { marketingApi } from '../api';
import type { MarketingSpendItem, MarketingLeadItem } from '../types';

function formatSpendTableDate(dateStr?: string) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function BudgetLeadsTab() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [budget, setBudget] = useState<{ plannedAmount: number; month: string } | null>(null);
  const [spends, setSpends] = useState<MarketingSpendItem[]>([]);
  const [leads, setLeads] = useState<MarketingLeadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<'spend' | 'leads'>('spend');

  // Spend modal
  const [showSpendModal, setShowSpendModal] = useState(false);
  const [spendSubmitting, setSpendSubmitting] = useState(false);
  const [spDate, setSpDate] = useState(new Date().toISOString().slice(0, 10));
  const [spCampaign, setSpCampaign] = useState('');
  const [spPlatform, setSpPlatform] = useState('Instagram Ads');
  const [spCity, setSpCity] = useState('Jaipur');
  const [spAmount, setSpAmount] = useState<number>(5000);
  const [spType, setSpType] = useState('Ad Spend');
  const [spReceipt, setSpReceipt] = useState('');
  const [spStatus, setSpStatus] = useState('Paid');

  // Budget Set modal
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgetSubmitting, setBudgetSubmitting] = useState(false);
  const [plannedBudgetInput, setPlannedBudgetInput] = useState<number>(150000);

  // Lead modal
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [ldCompany, setLdCompany] = useState('');
  const [ldContact, setLdContact] = useState('');
  const [ldPhone, setLdPhone] = useState('');
  const [ldEmail, setLdEmail] = useState('');
  const [ldCity, setLdCity] = useState('Jaipur');
  const [ldPlatform, setLdPlatform] = useState('Instagram');
  const [ldService, setLdService] = useState('Billboards');

  // Lead Won prompt modal
  const [winningLeadId, setWinningLeadId] = useState<string | null>(null);
  const [dealValueInput, setDealValueInput] = useState<number>(100000);
  const [stageSubmitting, setStageSubmitting] = useState(false);

  // Filters & Pagination for Leads
  const [claimFilter, setClaimFilter] = useState<'all' | 'unclaimed' | 'claimed' | 'won' | 'lost'>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('All');
  const [leadCounts, setLeadCounts] = useState<{ total: number; unclaimed: number; claimed: number; won: number; lost: number }>({
    total: 0,
    unclaimed: 0,
    claimed: 0,
    won: 0,
    lost: 0,
  });
  const [leadPage, setLeadPage] = useState<number>(1);
  const [leadLimit] = useState<number>(15);
  const [leadPagination, setLeadPagination] = useState<{ page: number; limit: number; total: number; totalPages: number }>({
    page: 1,
    limit: 15,
    total: 0,
    totalPages: 1,
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [budgetRes, spendsRes, leadsRes] = await Promise.all([
        marketingApi.getBudget(selectedMonth).catch(() => null),
        marketingApi.getSpends(selectedMonth).catch(() => ({ data: [] })),
        marketingApi.getLeads({
          claimFilter: claimFilter === 'all' ? undefined : claimFilter,
          platform: platformFilter === 'All' ? undefined : platformFilter,
          page: leadPage,
          limit: leadLimit,
        }).catch(() => ({ data: [], counts: undefined, pagination: undefined })),
      ]);

      const bData = (budgetRes as any)?.data || budgetRes;
      if (bData && (bData.plannedAmount !== undefined || bData.month)) {
        setBudget(bData);
        setPlannedBudgetInput(bData.plannedAmount || 150000);
      } else {
        setBudget({ plannedAmount: 150000, month: selectedMonth });
        setPlannedBudgetInput(150000);
      }

      setSpends(spendsRes?.data || []);
      setLeads(leadsRes?.data || []);
      if (leadsRes?.counts) {
        setLeadCounts(leadsRes.counts);
      }
      if (leadsRes?.pagination) {
        setLeadPagination(leadsRes.pagination);
      }
    } catch (err) {
      console.error('Failed to load marketing budget & leads:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadFilteredLeads = async (cFilter: string, pFilter: string, pageNum: number) => {
    try {
      const leadsRes = await marketingApi.getLeads({
        claimFilter: cFilter === 'all' ? undefined : cFilter,
        platform: pFilter === 'All' ? undefined : pFilter,
        page: pageNum,
        limit: leadLimit,
      });
      setLeads(leadsRes?.data || []);
      if (leadsRes?.counts) {
        setLeadCounts(leadsRes.counts);
      }
      if (leadsRes?.pagination) {
        setLeadPagination(leadsRes.pagination);
      }
    } catch (err) {
      console.error('Failed to load filtered leads:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedMonth]);

  useEffect(() => {
    loadFilteredLeads(claimFilter, platformFilter, leadPage);
  }, [claimFilter, platformFilter, leadPage]);

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
      const msg = err.response?.data?.message || (err.response?.data?.errors ? Object.values(err.response.data.errors).join(', ') : err.message);
      alert(msg || 'Failed to update planned budget');
    } finally {
      setBudgetSubmitting(false);
    }
  };

  const handleRecordSpend = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSpendSubmitting(true);
      await marketingApi.recordSpend({
        date: spDate,
        campaignName: spCampaign,
        platform: spPlatform,
        city: spCity,
        amount: Number(spAmount),
        type: spType,
        receiptUrl: spReceipt || undefined,
        paymentStatus: spStatus,
      });
      setShowSpendModal(false);
      setSpCampaign('');
      setSpReceipt('');
      await loadData();
    } catch (err: any) {
      const msg = err.response?.data?.message || (err.response?.data?.errors ? Object.values(err.response.data.errors).join(', ') : err.message);
      alert(msg || 'Failed to record marketing spend');
    } finally {
      setSpendSubmitting(false);
    }
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLeadSubmitting(true);
      await marketingApi.createLead({
        companyName: ldCompany,
        contactPerson: ldContact,
        phone: ldPhone,
        email: ldEmail || undefined,
        city: ldCity,
        sourcePlatform: ldPlatform,
        serviceInterested: ldService || undefined,
      });
      setShowLeadModal(false);
      setLdCompany('');
      setLdContact('');
      setLdPhone('');
      await loadData();
    } catch (err: any) {
      const msg = err.response?.data?.message || (err.response?.data?.errors ? Object.values(err.response.data.errors).join(', ') : err.message);
      alert(msg || 'Failed to create marketing lead');
    } finally {
      setLeadSubmitting(false);
    }
  };

  const handleStageSelect = async (leadId: string, newStage: string) => {
    if (newStage === 'Won') {
      setWinningLeadId(leadId);
      return;
    }

    try {
      await marketingApi.updateLeadStage(leadId, { stage: newStage });
      await loadData();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message;
      alert(msg || 'Failed to update stage');
    }
  };

  const handleConfirmWon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!winningLeadId) return;

    try {
      setStageSubmitting(true);
      await marketingApi.updateLeadStage(winningLeadId, {
        stage: 'Won',
        dealValue: Number(dealValueInput),
      });
      setWinningLeadId(null);
      await loadData();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message;
      alert(msg || 'Failed to close deal as Won');
    } finally {
      setStageSubmitting(false);
    }
  };

  // Accurate budget & spend calculations
  const planned = budget?.plannedAmount ?? 150000;
  const actualSpent = spends.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  const remaining = planned - actualSpent;
  const utilizationPct = planned > 0 ? Math.min(Math.round((actualSpent / planned) * 100), 100) : 0;
  const isOverBudget = actualSpent > planned && planned > 0;

  return (
    <div className="space-y-6">
      {/* Month & Budget KPI Bar */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#8B2424]" />
              Budget, Spend Ledger &amp; Leads
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Strict accounting of ad spend &amp; direct deal attribution for ROI calculation.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="text-xs font-semibold px-3 py-1.5 border border-slate-300 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#8B2424]"
            />
            <button
              onClick={() => setShowBudgetModal(true)}
              className="px-3 py-1.5 text-xs font-semibold border border-[#8B2424]/30 bg-[#F8E6E6] text-[#8B2424] hover:bg-[#F8E6E6]/80 rounded-lg transition cursor-pointer"
            >
              Set Budget
            </button>
            <button
              onClick={loadData}
              disabled={loading}
              className="p-1.5 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600 cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Budget Progress Indicator */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-3 border-t border-slate-100">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Planned Budget
            </p>
            <p className="text-lg font-bold text-slate-900 mt-1">₹{planned.toLocaleString()}</p>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Actual Spent
            </p>
            <p className="text-lg font-bold text-[#8B2424] mt-1">₹{actualSpent.toLocaleString()}</p>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Remaining Balance
            </p>
            <p
              className={`text-lg font-bold mt-1 ${
                remaining < 0 ? 'text-rose-600' : 'text-emerald-700'
              }`}
            >
              ₹{remaining.toLocaleString()}
            </p>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex flex-col justify-center">
            <div className="flex justify-between text-xs font-semibold mb-1">
              <span className="text-slate-600">Utilization</span>
              <span className={isOverBudget ? 'text-rose-600' : 'text-slate-900 font-bold'}>
                {utilizationPct}%
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  isOverBudget ? 'bg-rose-500' : utilizationPct > 85 ? 'bg-amber-500' : 'bg-[#8B2424]'
                }`}
                style={{ width: `${Math.min(utilizationPct, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Toggle Subtabs */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSubTab('spend')}
            className={`pb-3 text-sm font-semibold transition border-b-2 flex items-center gap-2 cursor-pointer ${
              subTab === 'spend'
                ? 'border-[#8B2424] text-[#8B2424]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Spend Ledger ({spends.length})
          </button>

          <button
            onClick={() => setSubTab('leads')}
            className={`pb-3 text-sm font-semibold transition border-b-2 flex items-center gap-2 cursor-pointer ${
              subTab === 'leads'
                ? 'border-[#8B2424] text-[#8B2424]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Users className="w-4 h-4" />
            Marketing Leads &amp; Deals ({leads.length})
          </button>
        </div>

        <div>
          {subTab === 'spend' ? (
            <button
              onClick={() => setShowSpendModal(true)}
              className="mb-2 px-3 py-1.5 bg-[#8B2424] hover:bg-[#721c1c] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Record Spend
            </button>
          ) : (
            <button
              onClick={() => setShowLeadModal(true)}
              className="mb-2 px-3 py-1.5 bg-[#8B2424] hover:bg-[#721c1c] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Marketing Lead
            </button>
          )}
        </div>
      </div>

      {/* Subtab Content: Spend Ledger */}
      {subTab === 'spend' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Marketing Initiative</th>
                  <th className="px-4 py-3">Platform</th>
                  <th className="px-4 py-3">City</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">Amount (₹)</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {spends.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-slate-400">
                      No marketing spends logged for {selectedMonth}. Click &quot;Record Spend&quot; to add.
                    </td>
                  </tr>
                ) : (
                  spends.map((sp) => (
                    <tr key={sp._id} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                        {formatSpendTableDate(sp.date)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {sp.campaignName}
                        {sp.notes && <p className="text-[10px] text-slate-400">{sp.notes}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
                          {sp.platform}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium">{sp.city}</td>
                      <td className="px-4 py-3 text-slate-500">{sp.type}</td>
                      <td className="px-4 py-3 font-bold text-slate-900 text-right whitespace-nowrap">
                        ₹{sp.amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            sp.paymentStatus === 'Paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {sp.paymentStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {sp.receiptUrl ? (
                          <a
                            href={sp.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#8B2424] hover:text-[#721c1c] font-medium"
                          >
                            <ExternalLink className="w-3 h-3" />
                            View
                          </a>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subtab Content: Leads Pipeline */}
      {subTab === 'leads' && (
        <div className="space-y-3">
          {/* Quick Filter Status Bar with Real-time Counts */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-1">Status:</span>

              <button
                type="button"
                onClick={() => {
                  setClaimFilter('all');
                  setLeadPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  claimFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                All Leads
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    claimFilter === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {leadCounts.total}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setClaimFilter('unclaimed');
                  setLeadPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  claimFilter === 'unclaimed'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                Unclaimed
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    claimFilter === 'unclaimed' ? 'bg-white/25 text-white' : 'bg-amber-200/70 text-amber-900'
                  }`}
                >
                  {leadCounts.unclaimed}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setClaimFilter('claimed');
                  setLeadPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  claimFilter === 'claimed'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                Claimed / In-Progress
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    claimFilter === 'claimed' ? 'bg-white/25 text-white' : 'bg-blue-200/70 text-blue-900'
                  }`}
                >
                  {leadCounts.claimed}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setClaimFilter('won');
                  setLeadPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  claimFilter === 'won'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                Won Deals
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    claimFilter === 'won' ? 'bg-white/25 text-white' : 'bg-emerald-200/70 text-emerald-900'
                  }`}
                >
                  {leadCounts.won}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setClaimFilter('lost');
                  setLeadPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  claimFilter === 'lost'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                Lost
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    claimFilter === 'lost' ? 'bg-white/25 text-white' : 'bg-rose-200/70 text-rose-900'
                  }`}
                >
                  {leadCounts.lost}
                </span>
              </button>
            </div>

            {/* Platform Dropdown */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Channel:</label>
              <select
                value={platformFilter}
                onChange={(e) => {
                  setPlatformFilter(e.target.value);
                  setLeadPage(1);
                }}
                className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#8B2424]"
              >
                <option value="All">All Channels</option>
                <option value="Instagram">Instagram</option>
                <option value="Facebook">Facebook</option>
                <option value="JustDial">Justdial</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Website">Website</option>
                <option value="Google">Google Ads</option>
              </select>
            </div>
          </div>

          {/* Leads Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-4 py-3">Company &amp; Contact</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">City</th>
                    <th className="px-4 py-3">Source Channel</th>
                    <th className="px-4 py-3 text-center">Sales Ownership</th>
                    <th className="px-4 py-3 text-center">Stage</th>
                    <th className="px-4 py-3 text-right">Deal Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leads.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-400">
                        No marketing leads found matching current filter.
                      </td>
                    </tr>
                  ) : (
                    leads.map((ld) => (
                      <tr key={ld._id} className="hover:bg-slate-50/80 transition">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-900">{ld.companyName}</p>
                            {ld.isLiveCrmLead && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] bg-slate-100 text-slate-500 font-semibold border border-slate-200 whitespace-nowrap">
                                Webhook Sync
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500">
                            {ld.contactPerson} {ld.email ? `• ${ld.email}` : ''}
                          </p>
                        </td>
                        <td className="px-4 py-3 font-mono">{ld.phone}</td>
                        <td className="px-4 py-3 font-medium">{ld.city}</td>
                        <td className="px-4 py-3">
                          <span className="bg-[#F8E6E6] text-[#8B2424] px-2 py-0.5 rounded font-medium border border-[#8B2424]/20 whitespace-nowrap">
                            {ld.sourcePlatform}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {ld.claimedStatus === 'unclaimed' ? (
                            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded font-medium text-[11px] whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                              Unclaimed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded font-medium text-[11px] whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                              {ld.claimedByName || 'Claimed'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {ld.stage === 'Won' ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full text-[11px] border border-emerald-200 shadow-2xs">
                              🏆 Won (Closed)
                            </span>
                          ) : ld.stage === 'Lost' ? (
                            <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 font-semibold px-2.5 py-0.5 rounded-full text-[11px] border border-rose-200">
                              Lost
                            </span>
                          ) : ld.stage === 'Proposal Sent' || ld.stage === 'Negotiation' ? (
                            <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 font-semibold px-2.5 py-0.5 rounded-full text-[11px] border border-purple-200">
                              {ld.stage}
                            </span>
                          ) : ld.stage === 'Meeting Done' || ld.stage === 'Contacted' ? (
                            <span className="inline-flex items-center gap-1 bg-sky-50 text-sky-700 font-semibold px-2.5 py-0.5 rounded-full text-[11px] border border-sky-200">
                              {ld.stage}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 font-semibold px-2.5 py-0.5 rounded-full text-[11px] border border-slate-200">
                              {ld.stage}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {ld.invoiceNumber ? (
                            <div>
                              <span className="font-bold text-slate-900 block">
                                ₹{(ld.invoiceAmount || ld.dealValue || 0).toLocaleString()}
                              </span>
                              <div className="mt-0.5 inline-flex items-center gap-1">
                                <span
                                  className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded border ${
                                    ld.invoiceStatus === 'Paid'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : ld.invoiceStatus === 'Partially Paid'
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : 'bg-blue-50 text-blue-700 border-blue-200'
                                  }`}
                                  title={`GST Tax Invoice: ${ld.invoiceNumber} (${ld.invoiceStatus || 'Issued'})`}
                                >
                                  📄 {ld.invoiceNumber}
                                  {ld.invoiceStatus ? ` • ${ld.invoiceStatus}` : ''}
                                </span>
                              </div>
                            </div>
                          ) : ld.dealValue ? (
                            <span className="font-bold text-slate-900">
                              ₹{ld.dealValue.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {leadPagination.totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-50 border-t border-slate-200">
                <p className="text-xs text-slate-500">
                  Showing <span className="font-semibold text-slate-800">{(leadPagination.page - 1) * leadPagination.limit + 1}</span> to{' '}
                  <span className="font-semibold text-slate-800">
                    {Math.min(leadPagination.page * leadPagination.limit, leadPagination.total)}
                  </span>{' '}
                  of <span className="font-semibold text-slate-800">{leadPagination.total}</span> leads
                </p>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setLeadPage((p) => Math.max(1, p - 1))}
                    disabled={leadPagination.page <= 1}
                    className="px-2.5 py-1 text-xs font-semibold rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Previous
                  </button>

                  <span className="px-2.5 py-1 text-xs font-semibold text-slate-600 bg-slate-200/60 rounded-md">
                    Page {leadPagination.page} of {leadPagination.totalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() => setLeadPage((p) => Math.min(leadPagination.totalPages, p + 1))}
                    disabled={leadPagination.page >= leadPagination.totalPages}
                    className="px-2.5 py-1 text-xs font-semibold rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition cursor-pointer"
                  >
                    Next
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Set Budget Modal */}
      {showBudgetModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-xl border border-slate-200">
            <h3 className="font-bold text-base text-slate-900 mb-3">Set Monthly Budget</h3>
            <form onSubmit={handleSaveBudget} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Month</label>
                <input
                  type="month"
                  value={selectedMonth}
                  disabled
                  className="w-full px-3 py-2 text-sm bg-slate-100 border border-slate-300 rounded-lg"
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
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B2424] font-bold"
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
                  className="px-3 py-1.5 text-xs bg-[#8B2424] hover:bg-[#721c1c] text-white rounded-lg font-semibold cursor-pointer"
                >
                  {budgetSubmitting ? 'Saving...' : 'Save Budget'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Spend Modal */}
      {showSpendModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-xl border border-slate-200">
            <h3 className="font-bold text-base text-slate-900 mb-3 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#8B2424]" />
              Record Marketing Spend
            </h3>
            <form onSubmit={handleRecordSpend} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={spDate}
                    onChange={(e) => setSpDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B2424]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Amount (₹) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={spAmount}
                    onChange={(e) => setSpAmount(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg font-bold focus:outline-none focus:ring-2 focus:ring-[#8B2424]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Marketing Initiative / Purpose *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Media Octus Brand Promotion, Diwali Agency Ads"
                  value={spCampaign}
                  onChange={(e) => setSpCampaign(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B2424]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Platform *
                  </label>
                  <select
                    value={spPlatform}
                    onChange={(e) => setSpPlatform(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B2424]"
                  >
                    <option value="Instagram Ads">Instagram Ads</option>
                    <option value="Facebook Ads">Facebook Ads</option>
                    <option value="Google Ads">Google Ads</option>
                    <option value="Justdial">Justdial</option>
                    <option value="WhatsApp Business">WhatsApp Business</option>
                    <option value="LinkedIn Ads">LinkedIn Ads</option>
                    <option value="Print/Hoardings">Print / Hoardings</option>
                    <option value="Influencer">Influencer</option>
                    <option value="Tools/Software">Tools / Software</option>
                    <option value="Agency/Freelancer">Agency / Freelancer</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">City *</label>
                  <select
                    value={spCity}
                    onChange={(e) => setSpCity(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B2424]"
                  >
                    <option value="Jaipur">Jaipur</option>
                    <option value="Delhi NCR">Delhi NCR</option>
                    <option value="Mumbai">Mumbai</option>
                    <option value="Bangalore">Bangalore</option>
                    <option value="Pune">Pune</option>
                    <option value="Hyderabad">Hyderabad</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Type *</label>
                  <select
                    value={spType}
                    onChange={(e) => setSpType(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B2424]"
                  >
                    <option value="Ad Spend">Ad Spend</option>
                    <option value="Tool">Tool / Subscriptions</option>
                    <option value="Freelancer">Freelancer Fee</option>
                    <option value="Event">Event / Promo</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Status *
                  </label>
                  <select
                    value={spStatus}
                    onChange={(e) => setSpStatus(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B2424]"
                  >
                    <option value="Paid">Paid</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Receipt / Invoice Link
                </label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/..."
                  value={spReceipt}
                  onChange={(e) => setSpReceipt(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B2424]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowSpendModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={spendSubmitting}
                  className="px-3 py-1.5 text-xs bg-[#8B2424] hover:bg-[#721c1c] text-white rounded-lg font-semibold cursor-pointer"
                >
                  {spendSubmitting ? 'Recording...' : 'Record Spend'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Lead Modal */}
      {showLeadModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-xl border border-slate-200">
            <h3 className="font-bold text-base text-slate-900 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-[#8B2424]" />
              Add Marketing Lead
            </h3>
            <form onSubmit={handleCreateLead} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Company Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Royal Jewels Jaipur"
                  value={ldCompany}
                  onChange={(e) => setLdCompany(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B2424]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Contact Person *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rajesh Sharma"
                    value={ldContact}
                    onChange={(e) => setLdContact(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B2424]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone *</label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 9876543210"
                    value={ldPhone}
                    onChange={(e) => setLdPhone(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B2424]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Source Platform *
                  </label>
                  <select
                    value={ldPlatform}
                    onChange={(e) => setLdPlatform(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B2424]"
                  >
                    <option value="Instagram">Instagram</option>
                    <option value="Facebook">Facebook</option>
                    <option value="Google Ads">Google Ads</option>
                    <option value="Justdial">Justdial</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="LinkedIn">LinkedIn</option>
                    <option value="Website">Website Form</option>
                    <option value="Direct Call">Direct Call</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">City *</label>
                  <select
                    value={ldCity}
                    onChange={(e) => setLdCity(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B2424]"
                  >
                    <option value="Jaipur">Jaipur</option>
                    <option value="Delhi NCR">Delhi NCR</option>
                    <option value="Mumbai">Mumbai</option>
                    <option value="Bangalore">Bangalore</option>
                    <option value="Pune">Pune</option>
                    <option value="Hyderabad">Hyderabad</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Interested In
                </label>
                <input
                  type="text"
                  placeholder="e.g. 3 Billboards on Tonk Road"
                  value={ldService}
                  onChange={(e) => setLdService(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B2424]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowLeadModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={leadSubmitting}
                  className="px-3 py-1.5 text-xs bg-[#8B2424] hover:bg-[#721c1c] text-white rounded-lg font-semibold cursor-pointer"
                >
                  {leadSubmitting ? 'Adding...' : 'Add Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Won Deal Value Confirmation Modal */}
      {winningLeadId && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-xl border border-slate-200">
            <div className="flex items-center gap-2 mb-2 text-emerald-700">
              <CheckCircle2 className="w-5 h-5" />
              <h3 className="font-bold text-base text-slate-900">Mark Lead as Won 🎉</h3>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              To calculate accurate marketing ROI &amp; ROAS, enter the confirmed contract/deal value:
            </p>
            <form onSubmit={handleConfirmWon} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Closed Deal Value (₹) *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={dealValueInput}
                  onChange={(e) => setDealValueInput(Number(e.target.value))}
                  className="w-full px-3 py-2 text-base font-bold text-emerald-700 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setWinningLeadId(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={stageSubmitting}
                  className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold cursor-pointer"
                >
                  {stageSubmitting ? 'Saving...' : 'Confirm Won'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
