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
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchCampaignsList = async () => {
    try {
      setLoadingCampaigns(true);
      const res = await getCampaigns();
      const list = res.data || [];
      setCampaigns(list);
      if (!selectedCampaign && list.length > 0) {
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

  const filteredCampaigns = campaigns.filter((c) => {
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
      <div className="rounded-xl border border-slate-200 bg-linear-to-r from-slate-900 to-slate-800 p-6 text-white shadow-xs dark:border-slate-800">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-emerald-400">
                <Sparkles className="h-4 w-4" />
              </span>
              <h2 className="text-lg font-bold tracking-tight">
                Track H1 Automated Compliance Engine
              </h2>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-300">
              Performs 6-point programmatic cross-checks across all active campaigns:
              contract schedules, task deadlines, approved proof of display, GPS geo-fence radius (&le;500m),
              and client/vendor financial reconciliations.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:items-end">
            <button
              type="button"
              onClick={handleGlobalScan}
              disabled={scanningGlobal}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-xs font-bold text-slate-950 shadow-md hover:bg-emerald-400 disabled:opacity-50 transition"
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
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-white/10 p-3 text-xs text-white">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>{globalMessage}</span>
          </div>
        )}

        {globalScanSummary && (
          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/10 pt-4 text-center">
            <div>
              <p className="text-[11px] text-slate-400">Campaigns Audited</p>
              <p className="text-lg font-bold text-white">{globalScanSummary.totalCampaignsAudited}</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-400">Checks Evaluated</p>
              <p className="text-lg font-bold text-white">{globalScanSummary.totalChecksRun}</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-400">Failing Exceptions</p>
              <p className={`text-lg font-bold ${globalScanSummary.failingChecksCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {globalScanSummary.failingChecksCount}
              </p>
            </div>
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
                {campaigns.length}
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

            {/* List */}
            <div className="mt-3 max-h-[520px] space-y-1.5 overflow-y-auto pr-1">
              {loadingCampaigns ? (
                <div className="flex items-center justify-center py-8 text-xs text-slate-400">
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
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
                      className={`flex w-full items-center justify-between rounded-lg p-2.5 text-left text-xs transition ${
                        isSelected
                          ? 'border border-[#8B2424]/30 bg-[#8B2424]/5 text-slate-900 font-semibold dark:bg-[#8B2424]/10 dark:text-white'
                          : 'border border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="truncate font-medium">{c.name}</div>
                        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-400">
                          <span>{c.campaignCode || 'CMP'}</span>
                          <span>&bull;</span>
                          <span className="capitalize">{c.status?.replace('_', ' ')}</span>
                          {c.city && (
                            <>
                              <span>&bull;</span>
                              <span>{c.city}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <ChevronRight
                        className={`h-4 w-4 shrink-0 transition ${
                          isSelected ? 'text-[#8B2424] dark:text-red-400' : 'text-slate-300'
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
