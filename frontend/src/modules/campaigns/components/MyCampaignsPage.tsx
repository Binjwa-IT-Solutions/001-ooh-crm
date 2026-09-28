'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Megaphone,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

import { useAuth } from '@/shared/auth/auth-context';
import { leadsApi } from '@/modules/leads/api';
import { useCampaigns } from '../hooks/useCampaigns';
import type { Campaign, CampaignFilters } from '../types';

const STATUS_STYLES: Record<string, string> = {
  Draft: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  Approved: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300',
  InProgress: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
  Completed: 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  Cancelled: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300',
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

function formatRupees(amount: number): string {
  return `₹${(amount || 0).toLocaleString('en-IN')}`;
}

export default function MyCampaignsPage() {
  const { user } = useAuth();
  const isManagerOrAdmin = ['admin', 'manager'].includes(user?.role?.toLowerCase() || '');
  const isSalesAgent = user?.role?.toLowerCase() === 'sales_agent';

  // Active top tab
  const [activeTab, setActiveTab] = useState<'all' | 'live' | 'closed' | 'renewals'>('all');

  // Filters
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [agentOptions, setAgentOptions] = useState<{ _id: string; name: string; email: string; role: string }[]>([]);

  // Load sales agents for managers/admins
  useEffect(() => {
    if (isManagerOrAdmin) {
      leadsApi.listAgents()
        .then((res) => {
          if (res.agents) setAgentOptions(res.agents);
        })
        .catch(() => {});
    }
  }, [isManagerOrAdmin]);

  // Filters passed to backend:
  // - Sales Agent: ALWAYS scoped to their own campaigns (myCampaigns: true)
  // - Admin / Manager: DEFAULTS to ALL Team Campaigns, or can filter by specific agent
  const apiFilters = useMemo<CampaignFilters>(() => {
    let myCampaigns: boolean | undefined = undefined;
    let agentId: string | undefined = undefined;

    if (isSalesAgent) {
      myCampaigns = true;
    } else if (selectedAgentId === 'me') {
      myCampaigns = true;
    } else if (selectedAgentId && selectedAgentId !== 'all') {
      agentId = selectedAgentId;
    }

    return {
      search: search.trim() || undefined,
      city: city.trim() || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      myCampaigns,
      agentId,
    };
  }, [search, city, startDate, endDate, isSalesAgent, selectedAgentId]);

  const { campaigns, loading, error, reload } = useCampaigns(apiFilters);

  // Compute live KPI summary stats
  const counts = useMemo(() => {
    let all = campaigns.length;
    let live = 0;
    let closed = 0;
    let renewals = 0;
    const now = Date.now();

    for (const c of campaigns) {
      if (c.status === 'InProgress' || c.status === 'Approved') {
        live++;
      } else if (c.status === 'Completed' || c.status === 'Cancelled') {
        closed++;
      }

      if (c.status !== 'Completed' && c.status !== 'Cancelled' && c.endDate) {
        const end = new Date(c.endDate).getTime();
        if (!isNaN(end)) {
          const diffDays = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
          if (diffDays >= 0 && diffDays <= 7) {
            renewals++;
          }
        }
      }
    }

    return { all, live, closed, renewals };
  }, [campaigns]);

  // Filter campaigns by active tab
  const displayedCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      if (activeTab === 'live') {
        return c.status === 'InProgress' || c.status === 'Approved';
      }
      if (activeTab === 'closed') {
        return c.status === 'Completed' || c.status === 'Cancelled';
      }
      if (activeTab === 'renewals') {
        if (c.status === 'Completed' || c.status === 'Cancelled' || !c.endDate) return false;
        const end = new Date(c.endDate).getTime();
        const diffDays = Math.ceil((end - Date.now()) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 7;
      }
      return true;
    });
  }, [campaigns, activeTab]);

  const resetAllFilters = () => {
    setSearch('');
    setCity('');
    setStartDate('');
    setEndDate('');
    setSelectedAgentId('');
    setActiveTab('all');
  };

  const hasActiveFilters = Boolean(search || city || startDate || endDate || selectedAgentId || activeTab !== 'all');

  return (
    <div className="space-y-6 pb-8">
      {/* Page Header - Exactly matching Leads & Quotations */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
            {isSalesAgent ? 'My Campaigns' : 'Sales Campaigns'}
          </h1>
          <p className="text-sm text-slate-500">
            Track live campaigns on sites, monitor closed contracts, and manage client renewals.
          </p>
        </div>

        <button
          type="button"
          onClick={reload}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 disabled:opacity-50 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Tabs - Consistent with Leads and Quotations */}
      <div className="flex gap-4 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('all')}
          className={`h-11 px-4 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'all'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
          }`}
        >
          All Campaigns ({counts.all})
        </button>

        <button
          onClick={() => setActiveTab('live')}
          className={`h-11 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'live'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
            <span>Live Campaigns</span>
          </span>
          <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-bold dark:bg-emerald-950 dark:text-emerald-300">
            {counts.live}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('closed')}
          className={`h-11 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'closed'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
          }`}
        >
          <span>Closed</span>
          <span className="rounded-full bg-slate-100 text-slate-700 px-2 py-0.5 text-xs font-bold dark:bg-slate-800 dark:text-slate-300">
            {counts.closed}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('renewals')}
          className={`h-11 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'renewals'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
          }`}
        >
          <span>Ending Soon (Renew)</span>
          {counts.renewals > 0 && (
            <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-bold dark:bg-amber-950 dark:text-amber-300">
              {counts.renewals}
            </span>
          )}
        </button>
      </div>

      {/* KPI Summary Cards - Consistent with Leads Executive Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Campaigns */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Campaigns
            </p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {counts.all}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {isSalesAgent ? 'Your assigned clients' : 'All campaigns'}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Megaphone className="w-5 h-5" />
          </div>
        </div>

        {/* Live on Sites */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Live on Sites
            </p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {counts.live}
            </p>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
              Active running display
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Closed */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Closed Contracts
            </p>
            <p className="text-2xl font-bold text-slate-700 dark:text-slate-300 mt-1">
              {counts.closed}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Completed or ended
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Renewals */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Renewals Due
            </p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
              {counts.renewals}
            </p>
            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
              Ending within 7 days
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Card - Consistent with Leads and Quotations */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {/* Search */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Campaign code, client..."
                className="h-10 w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
          </div>

          {/* City */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              City
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="All Cities"
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>

          {/* From Date */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              From Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>

          {/* To Date */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              To Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>

          {/* Agent Filter (Admin / Manager) */}
          {isManagerOrAdmin && agentOptions.length > 0 && (
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Sales Agent
              </label>
              <select
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              >
                <option value="">All Team Campaigns (Default)</option>
                <option value="me">My Campaigns Only</option>
                {agentOptions.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.name} ({a.role})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {hasActiveFilters && (
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
            <span className="text-xs text-slate-500">
              Showing {displayedCampaigns.length} matching campaigns
            </span>
            <button
              type="button"
              onClick={resetAllFilters}
              className="text-xs font-medium text-primary hover:underline"
            >
              Reset All Filters
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* Table - Consistent with Leads and Quotations */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-700 dark:text-slate-200">
            <thead className="bg-slate-50 text-slate-900 dark:bg-slate-800 dark:text-white">
              <tr>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Campaign</th>
                <th className="px-4 py-3 font-medium">Client / Contact</th>
                <th className="px-4 py-3 font-medium">City</th>
                <th className="px-4 py-3 font-medium">Duration & Renewals</th>
                <th className="px-4 py-3 font-medium">Sites</th>
                <th className="px-4 py-3 font-medium">Value</th>
                <th className="px-4 py-3 font-medium">Status</th>
                {isManagerOrAdmin && <th className="px-4 py-3 font-medium">Agent</th>}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={isManagerOrAdmin ? 9 : 8} className="px-4 py-12 text-center text-slate-500">
                    Loading campaigns...
                  </td>
                </tr>
              ) : displayedCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={isManagerOrAdmin ? 9 : 8} className="px-4 py-12 text-center text-slate-500">
                    No campaigns found matching current filters.
                  </td>
                </tr>
              ) : (
                displayedCampaigns.map((c) => {
                  const leadObj = typeof c.leadId === 'object' ? c.leadId : null;
                  const company = leadObj?.companyName || leadObj?.company || 'Valued Client';
                  const contactPerson = leadObj?.contactPerson || leadObj?.name || null;

                  let agentName = 'Unassigned';
                  if (leadObj?.assignedTo) {
                    if (typeof leadObj.assignedTo === 'object' && leadObj.assignedTo?.name) {
                      agentName = leadObj.assignedTo.name;
                    }
                  }

                  const renewal = getRenewalAlert(c);
                  const statusClass = STATUS_STYLES[c.status] || 'border-slate-200 bg-slate-100 text-slate-700';

                  return (
                    <tr key={c._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      {/* Code */}
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                        {c.campaignCode}
                      </td>

                      {/* Name */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900 dark:text-white max-w-50 truncate">
                          {c.name}
                        </div>
                      </td>

                      {/* Client / Contact Person */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900 dark:text-white">
                          {company}
                        </div>
                        {contactPerson && (
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block shrink-0" />
                            <span>{contactPerson}</span>
                          </div>
                        )}
                      </td>

                      {/* City */}
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                        {c.city || '—'}
                      </td>

                      {/* Duration & Renewals Alert */}
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        <div className="text-slate-700 dark:text-slate-300">
                          {formatDate(c.startDate)} to {formatDate(c.endDate)}
                        </div>
                        {renewal && (
                          <div className="mt-1">
                            <span
                              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                                renewal.urgent
                                  ? 'border border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                  : 'border border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-300'
                              }`}
                            >
                              <span>⏳</span>
                              <span>{renewal.label}</span>
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Sites */}
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-800 dark:bg-slate-800 dark:text-slate-300">
                          {c.siteIds.length} {c.siteIds.length === 1 ? 'site' : 'sites'}
                        </span>
                      </td>

                      {/* Contract Value */}
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                        {formatRupees(c.contractedValue)}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {c.status === 'InProgress' ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Live
                          </span>
                        ) : c.status === 'Completed' ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            Closed
                          </span>
                        ) : (
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusClass}`}>
                            {c.status}
                          </span>
                        )}
                      </td>

                      {/* Agent (for Admin/Manager) */}
                      {isManagerOrAdmin && (
                        <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-medium">
                            {agentName}
                          </span>
                        </td>
                      )}
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

function getRenewalAlert(campaign: Campaign): { label: string; urgent: boolean } | null {
  if (campaign.status === 'Completed' || campaign.status === 'Cancelled' || !campaign.endDate) {
    return null;
  }
  const end = new Date(campaign.endDate).getTime();
  const now = Date.now();
  if (isNaN(end)) return null;

  const diffMs = end - now;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays >= 0 && diffDays <= 7) {
    const daysText = diffDays === 0 ? 'today' : diffDays === 1 ? 'in 1 day' : `in ${diffDays} days`;
    return {
      label: `Ending ${daysText} (Renew)`,
      urgent: diffDays <= 3,
    };
  }
  if (diffDays < 0) {
    return {
      label: `Expired (${Math.abs(diffDays)}d ago)`,
      urgent: true,
    };
  }
  return null;
}
