'use client';

import { useState, useEffect } from 'react';
import {
  CreditCard,
  Plus,
  RefreshCw,
  ExternalLink,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Users,
  Target,
} from 'lucide-react';
import { marketingApi } from '../api';
import type { MarketingSpendItem, MarketingLeadItem } from '../types';

export default function BudgetLeadsTab() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [budget, setBudget] = useState<{ plannedAmount: number; totalSpent: number; remaining: number } | null>(null);
  const [spends, setSpends] = useState<MarketingSpendItem[]>([]);
  const [leads, setLeads] = useState<MarketingLeadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<'spend' | 'leads'>('spend');

  // Spend modal
  const [showSpendModal, setShowSpendModal] = useState(false);
  const [spendSubmitting, setSpendSubmitting] = useState(false);
  const [spDate, setSpDate] = useState(new Date().toISOString().slice(0, 10));
  const [spCampaign, setSpCampaign] = useState('');
  const [spPlatform, setSpPlatform] = useState('Meta Ads');
  const [spCity, setSpCity] = useState('Jaipur');
  const [spAmount, setSpAmount] = useState<number>(5000);
  const [spType, setSpType] = useState('Ad Spend');
  const [spReceipt, setSpReceipt] = useState('');
  const [spStatus, setSpStatus] = useState('Paid');

  // Budget Set modal
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgetSubmitting, setBudgetSubmitting] = useState(false);
  const [plannedBudgetInput, setPlannedBudgetInput] = useState<number>(50000);

  // Lead modal
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [ldCompany, setLdCompany] = useState('');
  const [ldContact, setLdContact] = useState('');
  const [ldPhone, setLdPhone] = useState('');
  const [ldEmail, setLdEmail] = useState('');
  const [ldCity, setLdCity] = useState('Jaipur');
  const [ldPlatform, setLdPlatform] = useState('Meta Ads');
  const [ldService, setLdService] = useState('Billboards');

  // Lead Won prompt modal
  const [winningLeadId, setWinningLeadId] = useState<string | null>(null);
  const [dealValueInput, setDealValueInput] = useState<number>(100000);
  const [stageSubmitting, setStageSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [budgetRes, spendsRes, leadsRes] = await Promise.all([
        marketingApi.getBudget(selectedMonth).catch(() => null),
        marketingApi.getSpends(selectedMonth).catch(() => ({ data: [] })),
        marketingApi.getLeads().catch(() => ({ data: [] })),
      ]);

      if (budgetRes?.data) {
        setBudget(budgetRes.data);
        setPlannedBudgetInput(budgetRes.data.plannedAmount || 50000);
      } else {
        setBudget(null);
      }

      setSpends(spendsRes?.data || []);
      setLeads(leadsRes?.data || []);
    } catch (err) {
      console.error('Failed to load marketing budget & leads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
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

  const planned = budget?.plannedAmount || 0;
  const spent = budget?.totalSpent || 0;
  const remaining = planned - spent;
  const utilizationPct = planned > 0 ? Math.min(Math.round((spent / planned) * 100), 100) : 0;
  const isOverBudget = spent > planned && planned > 0;

  return (
    <div className="space-y-6">
      {/* Month & Budget KPI Bar */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-indigo-600" />
              Budget, Spend Ledger & Leads
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Strict accounting of ad spend & direct deal attribution for ROI calculation.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="text-xs font-semibold px-3 py-1.5 border border-slate-300 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={() => setShowBudgetModal(true)}
              className="px-3 py-1.5 text-xs font-semibold border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg transition"
            >
              Set Budget
            </button>
            <button
              onClick={loadData}
              disabled={loading}
              className="p-1.5 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600"
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
            <p className="text-lg font-bold text-indigo-700 mt-1">₹{spent.toLocaleString()}</p>
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
              <span className={isOverBudget ? 'text-rose-600' : 'text-slate-900'}>
                {utilizationPct}%
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  isOverBudget ? 'bg-rose-500' : utilizationPct > 85 ? 'bg-amber-500' : 'bg-indigo-600'
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
            className={`pb-3 text-sm font-semibold transition border-b-2 flex items-center gap-2 ${
              subTab === 'spend'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Spend Ledger ({spends.length})
          </button>

          <button
            onClick={() => setSubTab('leads')}
            className={`pb-3 text-sm font-semibold transition border-b-2 flex items-center gap-2 ${
              subTab === 'leads'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Users className="w-4 h-4" />
            Marketing Leads & Deals ({leads.length})
          </button>
        </div>

        <div>
          {subTab === 'spend' ? (
            <button
              onClick={() => setShowSpendModal(true)}
              className="mb-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Record Spend
            </button>
          ) : (
            <button
              onClick={() => setShowLeadModal(true)}
              className="mb-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Marketing Lead
            </button>
          )}
        </div>
      </div>

      {/* Subtab Content: Spend Ledger */}
      {subTab === 'spend' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Campaign</th>
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
                      No marketing spends logged for {selectedMonth}. Click "Record Spend" to add.
                    </td>
                  </tr>
                ) : (
                  spends.map((sp) => (
                    <tr key={sp._id} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                        {sp.date}
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
                            className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium"
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
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-4 py-3">Company & Contact</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">City</th>
                  <th className="px-4 py-3">Source Platform</th>
                  <th className="px-4 py-3">Service</th>
                  <th className="px-4 py-3 text-center">Stage</th>
                  <th className="px-4 py-3 text-right">Deal Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leads.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      No marketing leads registered yet. Click "Add Marketing Lead" to create one.
                    </td>
                  </tr>
                ) : (
                  leads.map((ld) => (
                    <tr key={ld._id} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-900">{ld.companyName}</p>
                        <p className="text-[11px] text-slate-500">
                          {ld.contactPerson} {ld.email ? `• ${ld.email}` : ''}
                        </p>
                      </td>
                      <td className="px-4 py-3 font-mono">{ld.phone}</td>
                      <td className="px-4 py-3 font-medium">{ld.city}</td>
                      <td className="px-4 py-3">
                        <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-medium border border-indigo-100">
                          {ld.sourcePlatform}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{ld.serviceInterested || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <select
                          value={ld.stage}
                          onChange={(e) => handleStageSelect(ld._id, e.target.value)}
                          className={`text-xs font-semibold px-2 py-1 rounded border cursor-pointer focus:outline-none ${
                            ld.stage === 'Won'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                              : ld.stage === 'Lost'
                              ? 'bg-rose-50 text-rose-700 border-rose-300'
                              : 'bg-slate-50 text-slate-700 border-slate-300'
                          }`}
                        >
                          <option value="New">New</option>
                          <option value="Contacted">Contacted</option>
                          <option value="Meeting Done">Meeting Done</option>
                          <option value="Proposal Sent">Proposal Sent</option>
                          <option value="Negotiation">Negotiation</option>
                          <option value="Won">🏆 Won (Closed)</option>
                          <option value="Lost">Lost</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900 whitespace-nowrap">
                        {ld.dealValue ? `₹${ld.dealValue.toLocaleString()}` : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowBudgetModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={budgetSubmitting}
                  className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold"
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
              <CreditCard className="w-4 h-4 text-indigo-600" />
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
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Campaign Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Diwali Billboard Awareness Jaipur"
                  value={spCampaign}
                  onChange={(e) => setSpCampaign(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Meta Ads">Meta Ads</option>
                    <option value="Google Ads">Google Ads</option>
                    <option value="LinkedIn Ads">LinkedIn Ads</option>
                    <option value="Print/Hoardings">Print/Hoardings</option>
                    <option value="Influencer">Influencer</option>
                    <option value="Tools/Software">Tools/Software</option>
                    <option value="Agency/Freelancer">Agency/Freelancer</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">City *</label>
                  <select
                    value={spCity}
                    onChange={(e) => setSpCity(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowSpendModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={spendSubmitting}
                  className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold"
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
              <Users className="w-4 h-4 text-indigo-600" />
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
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Meta Ads">Meta Ads</option>
                    <option value="Google Ads">Google Ads</option>
                    <option value="Instagram Organic">Instagram Organic</option>
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
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowLeadModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={leadSubmitting}
                  className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold"
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
              To calculate accurate marketing ROI & ROAS, enter the confirmed contract/deal value:
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
                  className="px-3 py-1.5 text-xs text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={stageSubmitting}
                  className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold"
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
