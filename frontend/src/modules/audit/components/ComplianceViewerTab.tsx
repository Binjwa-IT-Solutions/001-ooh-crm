'use client';

import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  Layers,
} from 'lucide-react';
import { auditApi } from '../api';
import { getCampaigns } from '@/modules/campaigns/api';
import type { Campaign } from '@/modules/campaigns/types';
import type { ComplianceRunSummary } from '../types';
import { CampaignComplianceCard } from './CampaignComplianceCard';

export const ComplianceViewerTab: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [search, setSearch] = useState('');
  const [scanningGlobal, setScanningGlobal] = useState(false);
  const [globalScanSummary, setGlobalScanSummary] = useState<ComplianceRunSummary | null>(null);
  const [globalMessage, setGlobalMessage] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'AUDITABLE' | 'COMPLETED' | 'OTHER'>('ALL');
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchCampaignsList = async () => {
    try {
      setLoadingCampaigns(true);
      const res = await getCampaigns();
      const list = res.data || [];
      setCampaigns(list);
      const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const targetCId = urlParams?.get('campaignId');
      const foundTarget = targetCId ? list.find((c) => String(c._id) === targetCId) : null;
      if (foundTarget) {
        setSelectedCampaign(foundTarget);
      } else if (!selectedCampaign && list.length > 0) {
        setSelectedCampaign(list[0]);
      }
    } catch (err) {
      console.error('Failed to load campaigns for compliance tab', err);
    } finally {
      setLoadingCampaigns(false);
    }
  };

  useEffect(() => {
    fetchCampaignsList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGlobalScan = async () => {
    try {
      setScanningGlobal(true);
      setGlobalMessage(null);
      const res = await auditApi.runComplianceAudit();
      if (res.data && 'totalCampaignsAudited' in res.data) {
        setGlobalScanSummary(res.data as ComplianceRunSummary);
      }
      setGlobalMessage(res.message || 'Global compliance scan executed successfully.');
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      console.error('Failed to trigger global compliance audit', err);
      setGlobalMessage(err.message || 'Failed to trigger compliance scan.');
    } finally {
      setScanningGlobal(false);
    }
  };

  const getStatusBadge = (status?: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('live') || s.includes('progress') || s === 'approved') {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300';
    }
    if (s.includes('end') || s === 'completed') {
      return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300';
    }
    if (s === 'rejected' || s === 'cancelled') {
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300';
    }
    return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400';
  };

  const filteredCampaigns = campaigns.filter((c) => {
    const s = (c.status || '').toLowerCase();
    if (statusFilter === 'AUDITABLE') {
      const isAuditable =
        s.includes('live') ||
        s.includes('progress') ||
        s === 'approved' ||
        s.includes('end') ||
        s === 'completed';
      if (!isAuditable) return false;
    } else if (statusFilter === 'COMPLETED') {
      const isCompleted = s.includes('end') || s === 'completed';
      if (!isCompleted) return false;
    } else if (statusFilter === 'OTHER') {
      const isOther = s === 'rejected' || s === 'cancelled' || s === 'draft';
      if (!isOther) return false;
    }

    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      c.name?.toLowerCase().includes(term) ||
      c.campaignCode?.toLowerCase().includes(term) ||
      c.city?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Global Compliance Scan Header */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 border border-rose-200/80 text-[#8B2424] dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-400">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                  Automated Campaign Compliance Engine
                </h2>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8B2424] dark:text-rose-400">
                  Continuous 6-Point Verification
                </span>
              </div>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Performs 6-point programmatic cross-checks across all active campaigns:
              contract schedules, task deadlines, approved proof of display, GPS geo-fence radius (&le;500m),
              and client/vendor financial reconciliations.
            </p>
          </div>

          <div className="flex flex-col gap-1.5 sm:items-end shrink-0">
            <button
              type="button"
              onClick={handleGlobalScan}
              disabled={scanningGlobal}
              className="inline-flex items-center gap-2 rounded-xl bg-[#8B2424] px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-[#721c1c] active:scale-98 disabled:opacity-50 transition border border-[#721c1c]"
            >
              <Sparkles className={`h-4 w-4 ${scanningGlobal ? 'animate-spin' : ''}`} />
              <span>{scanningGlobal ? 'Scanning All Campaigns...' : 'Run Global Compliance Scan'}</span>
            </button>
            <span className="text-[11px] text-slate-400">
              Admin & Auditor manual trigger
            </span>
          </div>
        </div>

        {/* Global Scan Result Alert */}
        {globalMessage && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{globalMessage}</span>
          </div>
        )}

        {globalScanSummary && (
          <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100 dark:bg-slate-800/40 dark:border-slate-800">
                <p className="text-[11px] text-slate-500 font-medium">Campaigns Audited</p>
                <p className="text-xl font-bold text-slate-900 mt-0.5 dark:text-white">{globalScanSummary.totalCampaignsAudited}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100 dark:bg-slate-800/40 dark:border-slate-800">
                <p className="text-[11px] text-slate-500 font-medium">Checks Evaluated</p>
                <p className="text-xl font-bold text-slate-900 mt-0.5 dark:text-white">{globalScanSummary.totalChecksRun}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100 dark:bg-slate-800/40 dark:border-slate-800">
                <p className="text-[11px] text-slate-500 font-medium">Failing Exceptions</p>
                <p className={`text-xl font-bold mt-0.5 ${globalScanSummary.failingChecksCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {globalScanSummary.failingChecksCount}
                </p>
              </div>
            </div>
            <p className="mt-3 text-center text-[11px] text-slate-500 bg-slate-50 rounded-lg py-1.5 px-3 border border-slate-200/60 dark:bg-slate-800/50 dark:border-slate-800 dark:text-slate-400">
              Audited {globalScanSummary.totalCampaignsAudited} Active &amp; Completed campaigns &bull; Inactive / Draft / Rejected campaigns are excluded from verification.
            </p>
          </div>
        )}
      </div>

      {/* Main Campaign Inspector Layout */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Campaign Picker */}
        <div className="lg:col-span-4 space-y-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-slate-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Select Campaign
                </h3>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                {filteredCampaigns.length} / {campaigns.length}
              </span>
            </div>

            {/* Search Box */}
            <div className="relative mt-3">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search campaigns..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#8B2424] focus:outline-hidden focus:ring-1 focus:ring-[#8B2424] dark:border-slate-800 dark:bg-slate-800/40 dark:text-white"
              />
            </div>

            {/* Quick Status Filter Pills */}
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {[
                { key: 'ALL', label: `All (${campaigns.length})` },
                { key: 'AUDITABLE', label: 'Auditable / Active' },
                { key: 'COMPLETED', label: 'Completed' },
                { key: 'OTHER', label: 'Draft / Rejected' },
              ].map((pill) => (
                <button
                  key={pill.key}
                  type="button"
                  onClick={() => setStatusFilter(pill.key as any)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                    statusFilter === pill.key
                      ? 'bg-[#8B2424] text-white shadow-xs font-semibold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {/* List */}
            <div className="mt-3 max-h-[500px] space-y-1.5 overflow-y-auto pr-1">
              {loadingCampaigns ? (
                <div className="flex items-center justify-center py-8 text-xs text-slate-400">
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin text-slate-400" />
                  Loading campaigns...
                </div>
              ) : filteredCampaigns.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  No campaigns matched filter.
                </div>
              ) : (
                filteredCampaigns.map((c) => {
                  const isSelected = selectedCampaign?._id === c._id;
                  return (
                    <button
                      key={c._id}
                      type="button"
                      onClick={() => setSelectedCampaign(c)}
                      className={`group relative flex w-full items-center justify-between rounded-xl p-3 text-left text-xs transition border ${
                        isSelected
                          ? 'border-[#8B2424]/40 bg-[#8B2424]/5 shadow-2xs dark:bg-[#8B2424]/10 dark:border-[#8B2424]/50'
                          : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {isSelected && (
                        <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[#8B2424]" />
                      )}
                      <div className="min-w-0 pr-2 pl-1.5">
                        <div className={`truncate font-semibold ${isSelected ? 'text-[#8B2424] dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
                          {c.name}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap text-[10px]">
                          <span className="font-mono text-slate-500 font-medium">{c.campaignCode || 'CMP'}</span>
                          <span className={`rounded-md border px-1.5 py-0.5 font-semibold text-[9px] uppercase tracking-wider ${getStatusBadge(c.status)}`}>
                            {c.status?.replace('_', ' ')}
                          </span>
                          {c.city && (
                            <span className="text-slate-400 font-medium">&bull; {c.city}</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight
                        className={`h-4 w-4 shrink-0 transition group-hover:translate-x-0.5 ${
                          isSelected ? 'text-[#8B2424] dark:text-rose-400' : 'text-slate-300 dark:text-slate-600'
                        }`}
                      />
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Campaign Compliance Card */}
        <div className="lg:col-span-8">
          {selectedCampaign ? (
            <CampaignComplianceCard
              key={`${selectedCampaign._id}-${refreshKey}`}
              campaignId={selectedCampaign._id}
              campaignName={selectedCampaign.name}
            />
          ) : (
            <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white text-center dark:border-slate-800 dark:bg-slate-900">
              <ShieldCheck className="h-8 w-8 text-slate-300 mb-2" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                Select a campaign from the left to inspect compliance
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ComplianceViewerTab;
