'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { leadsApi } from '@/modules/leads/api';
import { quotationsApi } from '@/modules/quotations/api';
import type { Lead, LeadStatus } from '@/modules/leads/types';
import type { QuotationStats } from '@/modules/quotations/types';
import {
  Users,
  Clock,
  AlertCircle,
  FileText,
  CheckCircle2,
  TrendingUp,
  ArrowRight,
  Phone,
  Building2,
  MapPin,
  Sparkles,
  ChevronRight,
  Plus,
  Calendar,
  MessageSquare,
  Check,
  Search,
} from 'lucide-react';
import { formatPaise } from '@/modules/finance/utils/formatters';
import { AttendanceWidget } from '@/modules/hr/components/attendance-widget';
import LogCallModal, { type LogFollowUpPayload } from '@/modules/leads/component/log-call-modal';

interface ExtendedLeadStats {
  totalActive: number;
  overdueCount: number;
  unclaimedCount: number;
  wonCount: number;
  wonRevenue: number;
  stageCounts?: Record<string, number>;
  todayFollowUpsCount?: number;
  topCities?: Array<{ city: string; count: number }>;
  targetRevenue?: number;
}

const STATUS_STYLES: Record<string, string> = {
  New: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300',
  Contacted: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  Interested: 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-300',
  Qualified: 'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950/50 dark:text-purple-300',
  'Proposal Sent': 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300',
  Negotiation: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/50 dark:text-orange-300',
  Won: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
  Lost: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300',
  Duplicate: 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300',
  Rejected: 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

function StatusPill({ status }: { status: LeadStatus | string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
        STATUS_STYLES[status] ?? 'border-slate-200 bg-slate-50 text-slate-700'
      }`}
    >
      {status}
    </span>
  );
}

function formatDate(dateStr?: string | Date | null) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function cleanPhoneNumber(mobile?: string) {
  if (!mobile) return '';
  const digits = mobile.replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

export function SalesAgentDashboard() {
  const [stats, setStats] = useState<ExtendedLeadStats | null>(null);
  const [quotationStats, setQuotationStats] = useState<QuotationStats | null>(null);
  const [recentLeads, setRecentLeads] = useState<Lead[]>([]);
  const [allMyLeads, setAllMyLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick Action / Log Call Modal State
  const [selectedLeadForLog, setSelectedLeadForLog] = useState<Lead | null>(null);
  const [isLogCallOpen, setIsLogCallOpen] = useState(false);

  // Task Filter state: 'today' | 'overdue' | 'all'
  const [taskFilter, setTaskFilter] = useState<'today' | 'overdue' | 'all'>('today');

  const loadData = async () => {
    try {
      const [leadStatsRes, qStatsRes, recentRes, allRes] = await Promise.allSettled([
        leadsApi.getStats(),
        quotationsApi.getStats(),
        leadsApi.list({ limit: 8 }),
        leadsApi.list({ limit: 40 }),
      ]);

      if (leadStatsRes.status === 'fulfilled') {
        setStats(leadStatsRes.value as ExtendedLeadStats);
      }

      if (qStatsRes.status === 'fulfilled') {
        setQuotationStats(qStatsRes.value);
      }

      if (recentRes.status === 'fulfilled') {
        setRecentLeads(recentRes.value.data || []);
      }

      if (allRes.status === 'fulfilled') {
        setAllMyLeads(allRes.value.data || []);
      }
    } catch (err) {
      console.error('Failed to load sales dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute Today's Tasks & Follow-ups
  const { todayFollowUps, overdueTasks, allScheduledTasks } = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const active = allMyLeads.filter((l) => l.status !== 'Won' && l.status !== 'Lost');

    const overdue: Lead[] = [];
    const today: Lead[] = [];
    const scheduled: Lead[] = [];

    for (const lead of active) {
      if (lead.nextActionDate) {
        const d = new Date(lead.nextActionDate);
        if (d < startOfToday) {
          overdue.push(lead);
        } else if (d >= startOfToday && d <= endOfToday) {
          today.push(lead);
        } else {
          scheduled.push(lead);
        }
      }
    }

    return {
      todayFollowUps: today,
      overdueTasks: overdue,
      allScheduledTasks: [...overdue, ...today, ...scheduled],
    };
  }, [allMyLeads]);

  // Compute Funnel Counts
  const funnelStages = useMemo(() => {
    const counts = stats?.stageCounts || {};
    return [
      { name: 'New Inquiries', key: 'New', count: counts['New'] ?? 0, color: 'bg-sky-500' },
      { name: 'Contacted', key: 'Contacted', count: counts['Contacted'] ?? 0, color: 'bg-amber-500' },
      { name: 'Qualified', key: 'Qualified', count: (counts['Qualified'] ?? 0) + (counts['Interested'] ?? 0), color: 'bg-purple-500' },
      { name: 'Proposal Sent', key: 'Proposal Sent', count: counts['Proposal Sent'] ?? 0, color: 'bg-indigo-500' },
      { name: 'Negotiation', key: 'Negotiation', count: counts['Negotiation'] ?? 0, color: 'bg-orange-500' },
      { name: 'Closed Won', key: 'Won', count: stats?.wonCount ?? (counts['Won'] ?? 0), color: 'bg-emerald-500' },
    ];
  }, [stats]);

  // Top Cities list
  const topCities = useMemo(() => {
    if (stats?.topCities && stats.topCities.length > 0) {
      return stats.topCities;
    }
    // Fallback computed from current loaded leads
    const map = new Map<string, number>();
    for (const l of allMyLeads) {
      const c = l.city?.trim();
      if (c) map.set(c, (map.get(c) || 0) + 1);
    }
    const arr = Array.from(map.entries()).map(([city, count]) => ({ city, count }));
    arr.sort((a, b) => b.count - a.count);
    return arr.slice(0, 5);
  }, [stats, allMyLeads]);

  // Handle Quick Call Log submit
  const handleLogCallSubmit = async (payload: LogFollowUpPayload) => {
    if (!selectedLeadForLog) return;
    try {
      await leadsApi.logCall(selectedLeadForLog.id || selectedLeadForLog._id!, payload);
      setIsLogCallOpen(false);
      setSelectedLeadForLog(null);
      await loadData();
    } catch (err) {
      console.error('Failed to log call', err);
    }
  };

  const tasksToDisplay =
    taskFilter === 'today'
      ? todayFollowUps
      : taskFilter === 'overdue'
      ? overdueTasks
      : allScheduledTasks;

  return (
    <div className="space-y-6">
      {/* ─── MAIN DASHBOARD GRID (2 COLS LEFT, 1 COL RIGHT) ─── */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        {/* Left (2 Cols): KPIs, Funnel, Workspace, Tasks, Recent Leads */}
        <div className="space-y-5 lg:col-span-2">
          {/* 4 Compact KPI Cards */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            {/* Active Pipeline */}
            <Link
              href="/leads"
              className="group flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-3 shadow-2xs transition-all hover:border-slate-300 hover:shadow-xs dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Active Pipeline
                </span>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 text-sky-600 transition group-hover:scale-105 dark:bg-sky-950/60 dark:text-sky-400">
                  <Users className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="mt-1.5 flex items-baseline justify-between">
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                    {stats?.totalActive ?? 0}
                  </span>
                  <span className="text-[11px] text-slate-400">inquiries</span>
                </div>
                <span className="text-[10px] font-semibold text-[#8B2424] opacity-0 group-hover:opacity-100 transition">
                  View →
                </span>
              </div>
            </Link>

            {/* Missed / Overdue Follow-ups */}
            <Link
              href="/leads?overdue=true"
              className="group flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-3 shadow-2xs transition-all hover:border-slate-300 hover:shadow-xs dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Team Overdue
                </span>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600 transition group-hover:scale-105 dark:bg-rose-950/60 dark:text-rose-400">
                  <AlertCircle className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="mt-1.5 flex items-baseline justify-between">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                    {stats?.overdueCount ?? 0}
                  </span>
                  {(stats?.overdueCount ?? 0) > 0 ? (
                    <span className="rounded-full bg-rose-100 px-1.5 py-0.2 text-[9px] font-bold text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                      Action Req
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-emerald-600">On Track</span>
                  )}
                </div>
                <span className="text-[10px] font-semibold text-[#8B2424] opacity-0 group-hover:opacity-100 transition">
                  Review →
                </span>
              </div>
            </Link>

            {/* Unclaimed Pool */}
            <Link
              href="/leads?tab=unclaimed"
              className="group flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-3 shadow-2xs transition-all hover:border-slate-300 hover:shadow-xs dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Unclaimed Pool
                </span>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600 transition group-hover:scale-105 dark:bg-amber-950/60 dark:text-amber-400">
                  <Clock className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="mt-1.5 flex items-baseline justify-between">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                    {stats?.unclaimedCount ?? 0}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.2 text-[9px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    <span className="h-1 w-1 rounded-full bg-amber-600 animate-pulse" /> Live
                  </span>
                </div>
                <span className="text-[10px] font-semibold text-[#8B2424] opacity-0 group-hover:opacity-100 transition">
                  Claim →
                </span>
              </div>
            </Link>

            {/* Proposals Pipeline */}
            <Link
              href="/quotations"
              className="group flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-3 shadow-2xs transition-all hover:border-slate-300 hover:shadow-xs dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Proposals
                </span>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 transition group-hover:scale-105 dark:bg-emerald-950/60 dark:text-emerald-400">
                  <FileText className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="mt-1.5 flex items-baseline justify-between">
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                    {quotationStats?.totalCount ?? 0}
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    ({quotationStats?.acceptedCount ?? 0} Won)
                  </span>
                </div>
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                  {quotationStats?.totalQuotedValue ? formatPaise(quotationStats.totalQuotedValue) : '₹0'}
                </span>
              </div>
            </Link>
          </div>

          {/* Deal Progression Funnel */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[#8B2424]" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Deal Progression Funnel
                </h3>
              </div>
              <Link
                href="/leads"
                className="text-xs font-semibold text-[#8B2424] hover:underline"
              >
                Manage Pipeline <ArrowRight className="inline h-3 w-3" />
              </Link>
            </div>

            <div className="mt-3.5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {funnelStages.map((stage, idx) => (
                <Link
                  key={stage.key}
                  href={`/leads?tab=my-leads&status=${encodeURIComponent(stage.key)}`}
                  className="group relative flex flex-col justify-between rounded-lg border border-slate-200/70 bg-slate-50/60 p-2.5 transition hover:border-[#8B2424] hover:bg-white hover:shadow-xs dark:border-slate-800 dark:bg-slate-800/40 dark:hover:bg-slate-800"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400">0{idx + 1}</span>
                    <span className={`h-2 w-2 rounded-full ${stage.color}`} />
                  </div>
                  <div className="my-1.5">
                    <span className="text-lg font-extrabold text-slate-900 group-hover:text-[#8B2424] dark:text-slate-100">
                      {stage.count}
                    </span>
                    <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                      {stage.name}
                    </span>
                  </div>
                  <div className="flex items-center text-[10px] font-semibold text-slate-400 group-hover:text-[#8B2424]">
                    Filter <ChevronRight className="h-3 w-3 ml-0.5" />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Action Workspace Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#8B2424] text-white shadow-xs">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Sales Action Workspace
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Manage client inquiries, schedule calls, and issue proposals.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/leads?tab=unclaimed"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#8B2424] px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-[#731e1e]"
              >
                <Clock className="h-3.5 w-3.5" />
                Claim Leads ({stats?.unclaimedCount ?? 0})
              </Link>
              <Link
                href="/quotations"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <FileText className="h-3.5 w-3.5" />
                New Quotation
              </Link>
              <Link
                href="/leads"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Lead
              </Link>
            </div>
          </div>

          {/* ─── FEATURE 1: TODAY'S ACTION CENTER & CALL TASKS ("Aaj Mujhe Kya Karna Hai?") ─── */}
          <div className="rounded-xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#8B2424]" />
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Today&apos;s Follow-up &amp; Call Tasks
                </h3>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                <button
                  onClick={() => setTaskFilter('today')}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                    taskFilter === 'today'
                      ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-900 dark:text-slate-50'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                  }`}
                >
                  Due Today ({todayFollowUps.length})
                </button>
                <button
                  onClick={() => setTaskFilter('overdue')}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                    taskFilter === 'overdue'
                      ? 'bg-rose-50 text-rose-700 shadow-2xs dark:bg-rose-950 dark:text-rose-300'
                      : 'text-slate-500 hover:text-rose-600 dark:text-slate-400'
                  }`}
                >
                  Overdue ({overdueTasks.length})
                </button>
                <button
                  onClick={() => setTaskFilter('all')}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                    taskFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-900 dark:text-slate-50'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                  }`}
                >
                  All Scheduled ({allScheduledTasks.length})
                </button>
              </div>
            </div>

            <div className="p-4 space-y-3">
              {tasksToDisplay.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 py-8 text-center dark:border-slate-800">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
                  <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                    No scheduled tasks in this queue!
                  </p>
                  <p className="text-xs text-slate-500">
                    You are caught up with all follow-up calls for this section.
                  </p>
                </div>
              ) : (
                tasksToDisplay.map((lead) => {
                  const cleanPhone = cleanPhoneNumber(lead.mobile);
                  return (
                    <div
                      key={lead._id || lead.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800/30"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                            {lead.companyName}
                          </h4>
                          <StatusPill status={lead.status} />
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                            👤 {lead.contactPerson}
                          </span>
                          <span className="flex items-center gap-1">
                            📍 {lead.city || 'National'}
                          </span>
                          <span className="flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                            ⏰ {formatDate(lead.nextActionDate)}
                          </span>
                        </div>
                      </div>

                      {/* Direct Quick Action Buttons */}
                      <div className="flex items-center gap-2">
                        {cleanPhone && (
                          <>
                            <a
                              href={`tel:${cleanPhone}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                              title="Direct Phone Call"
                            >
                              <Phone className="h-3.5 w-3.5 text-emerald-600" />
                              Call
                            </a>
                            <a
                              href={`https://wa.me/91${cleanPhone}?text=${encodeURIComponent(
                                `Hello ${lead.contactPerson}, this is Media Octus regarding your outdoor advertising requirement.`,
                              )}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                              title="Chat on WhatsApp"
                            >
                              <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                              WhatsApp
                            </a>
                          </>
                        )}
                        <button
                          onClick={() => {
                            setSelectedLeadForLog(lead);
                            setIsLogCallOpen(true);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#8B2424] px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-[#731e1e] cursor-pointer"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Log Action
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>



          {/* ─── Recent Active Leads Table ─── */}
          <div className="rounded-xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-50">
                  Recent Inquiries &amp; Leads
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Latest client contacts in your active workflow
                </p>
              </div>
              <Link
                href="/leads"
                className="inline-flex items-center text-xs font-semibold text-[#8B2424] hover:underline"
              >
                All Leads <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50/60 font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                  <tr>
                    <th className="px-6 py-3">Company &amp; Contact</th>
                    <th className="px-4 py-3">Phone &amp; Location</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Received</th>
                    <th className="px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 dark:divide-slate-800 dark:text-slate-300">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Loading your sales inquiries...
                      </td>
                    </tr>
                  ) : recentLeads.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No active inquiries yet. Head to the Unclaimed pool to claim incoming leads!
                      </td>
                    </tr>
                  ) : (
                    recentLeads.map((lead) => (
                      <tr
                        key={lead._id || lead.id}
                        className="transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                      >
                        <td className="px-6 py-3.5">
                          <div className="font-bold text-slate-900 dark:text-slate-100">
                            {lead.companyName}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {lead.contactPerson}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-medium text-slate-800 dark:text-slate-200">
                            {lead.mobile}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {lead.city || 'National / Other'}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusPill status={lead.status} />
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="font-medium text-slate-600 dark:text-slate-400">
                            {lead.source || 'Direct'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-500">
                          {formatDate(lead.receivedAt || lead.createdAt)}
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <Link
                            href="/leads"
                            className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-[#8B2424] shadow-2xs transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
                          >
                            Open <ChevronRight className="ml-1 h-3 w-3" />
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ─── RIGHT COLUMN (1 Col): Attendance (Top Right) + Activity Feed + City Breakdown ─── */}
        <div className="space-y-6 lg:col-span-1">
          {/* Attendance Widget at Top Right */}
          <AttendanceWidget />

          {/* ─── FEATURE 5: RECENT ACTIVITIES & QUICK NOTES LOG ─── */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-sky-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Recent Interactions
                </h3>
              </div>
              <span className="text-[11px] text-slate-400">Live Log</span>
            </div>

            <div className="mt-3 space-y-3">
              {recentLeads.slice(0, 4).map((lead) => {
                const latestLog = lead.callLogs && lead.callLogs.length > 0
                  ? lead.callLogs[lead.callLogs.length - 1]
                  : null;

                return (
                  <div
                    key={lead._id || lead.id}
                    className="flex items-start gap-2.5 rounded-lg border border-slate-100 bg-slate-50/50 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-800/30"
                  >
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                      <Phone className="h-3 w-3" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {lead.companyName}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                        {latestLog?.remarks || latestLog?.reason || `Status updated to ${lead.status}`}
                      </p>
                      <span className="mt-0.5 block text-[10px] text-slate-400">
                        {formatDate(latestLog?.createdAt || lead.updatedAt || lead.createdAt)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ─── FEATURE 6: TOP CITIES & MEDIA DEMAND BREAKDOWN ─── */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#8B2424]" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Top Cities &amp; Media Demand
                </h3>
              </div>
              <span className="text-[11px] font-semibold text-slate-400">Inquiries</span>
            </div>

            <div className="mt-3 space-y-2.5">
              {topCities.length === 0 ? (
                <p className="py-3 text-center text-xs text-slate-400">No city data available</p>
              ) : (
                topCities.map((item) => (
                  <div key={item.city} className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {item.city}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          style={{
                            width: `${Math.min(100, (item.count / (stats?.totalActive || 10)) * 100)}%`,
                          }}
                          className="h-full bg-[#8B2424]"
                        />
                      </div>
                      <span className="font-bold text-slate-900 dark:text-slate-100 w-5 text-right">
                        {item.count}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Popular Media Formats Badges */}
            <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Core OOH Categories
              </span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {['Billboards', 'Unipoles', 'Gantries', 'Bus Shelters', 'Mall Media'].map((cat) => (
                  <span
                    key={cat}
                    className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── QUICK LOG CALL / INTERACTION MODAL ─── */}
      {selectedLeadForLog && (
        <LogCallModal
          open={isLogCallOpen}
          onClose={() => {
            setIsLogCallOpen(false);
            setSelectedLeadForLog(null);
          }}
          onSubmit={handleLogCallSubmit}
          contacts={[
            {
              name: selectedLeadForLog.contactPerson,
              phone: selectedLeadForLog.mobile,
            },
          ]}
          leadDefaults={{
            budget: selectedLeadForLog.qualification?.budget,
            companyAddress: selectedLeadForLog.companyAddress,
            email: selectedLeadForLog.email,
          }}
        />
      )}
    </div>
  );
}
