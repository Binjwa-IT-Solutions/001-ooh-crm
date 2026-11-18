'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  AlertCircle,
  ShieldAlert,
  ShieldCheck,
  Clock,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Filter,
  Search,
  RefreshCw,
  Check,
  Camera,
  MapPin,
  TrendingUp,
  FileText,
  Calendar,
  RotateCw,
  X,
} from 'lucide-react';
import { exceptionsApi } from '../api';
import type {
  ExceptionFilters,
  ExceptionItem,
  ExceptionSeverity,
  ExceptionType,
} from '../types';

const TYPE_CONFIG: Record<
  ExceptionType,
  {
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    accentColor: string;
  }
> = {
  missing_or_rejected_proof: {
    title: 'Missing or Rejected Proof Photos',
    description: 'Mandatory proof photos missing or rejected by operations',
    icon: Camera,
    accentColor: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40',
  },
  campaign_past_deadline: {
    title: 'Campaigns Past Deadline Without Completion',
    description: 'End date reached without formal closure',
    icon: Clock,
    accentColor: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40',
  },
  task_escalated_l3: {
    title: 'Level 3 Escalated Tasks',
    description: 'Critical operational tasks escalated to L3 leadership',
    icon: AlertTriangle,
    accentColor: 'text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-950/60',
  },
  gps_mismatch: {
    title: 'GPS Geo-Fence Mismatches (Proof Location)',
    description: 'Photo coordinates deviate >500m from booked site location',
    icon: MapPin,
    accentColor: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40',
  },
  failed_audit_check: {
    title: 'Failed Compliance Audit Checks',
    description: 'Automated 6-point verification flags pending resolution',
    icon: ShieldAlert,
    accentColor: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40',
  },
  client_payment_outstanding: {
    title: 'Outstanding Client Payments & Billing',
    description: 'Contracted client billing pending reconciliation',
    icon: TrendingUp,
    accentColor: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40',
  },
  vendor_payment_outstanding: {
    title: 'Vendor PO Commitments & Cancelled POs',
    description: 'Purchase order anomalies needing operational review',
    icon: FileText,
    accentColor: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40',
  },
};

export const ExceptionsDashboard: React.FC = () => {
  const [items, setItems] = useState<ExceptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [includeAcknowledged, setIncludeAcknowledged] = useState(false);

  // Collapsed groups state
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Modal inspection & acknowledgement states
  const [inspectingItem, setInspectingItem] = useState<ExceptionItem | null>(null);
  const [acknowledgingItem, setAcknowledgingItem] = useState<ExceptionItem | null>(null);
  const [acknowledgeNotes, setAcknowledgeNotes] = useState('');
  const [savingAck, setSavingAck] = useState(false);

  const fetchExceptions = async (showFullLoading = false) => {
    try {
      if (showFullLoading) setLoading(true);
      setError(null);

      const filters: ExceptionFilters = {
        type: typeFilter !== 'ALL' ? typeFilter : undefined,
        severity: severityFilter !== 'ALL' ? (severityFilter as ExceptionSeverity) : undefined,
        city: cityFilter.trim() || undefined,
        search: search.trim() || undefined,
        includeAcknowledged,
      };

      const res = await exceptionsApi.getExceptions(filters);
      setItems(res.data || []);
    } catch (err: any) {
      console.error('Failed to load exceptions', err);
      setError(err.message || 'Failed to fetch operational exceptions');
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  };

  // Debounced auto-fetch on filter/search changes
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchExceptions(initialLoading);
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, severityFilter, cityFilter, search, includeAcknowledged]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchExceptions(false);
  };

  const handleResetFilters = () => {
    setTypeFilter('ALL');
    setSeverityFilter('ALL');
    setSearch('');
    setCityFilter('');
    setIncludeAcknowledged(false);
  };

  const openAcknowledgeModal = (item: ExceptionItem) => {
    setAcknowledgingItem(item);
    setAcknowledgeNotes('');
  };

  const handleConfirmAcknowledge = async () => {
    if (!acknowledgingItem) return;
    try {
      setSavingAck(true);
      await exceptionsApi.acknowledge(acknowledgingItem.id, {
        exceptionType: acknowledgingItem.type,
        entityId: acknowledgingItem.entityId,
        notes: acknowledgeNotes.trim() || undefined,
      });

      // Optimistically update
      if (!includeAcknowledged) {
        setItems((prev) => prev.filter((i) => i.id !== acknowledgingItem.id));
      } else {
        setItems((prev) =>
          prev.map((i) => (i.id === acknowledgingItem.id ? { ...i, acknowledged: true } : i)),
        );
      }
      setAcknowledgingItem(null);
    } catch (err: any) {
      alert(err.message || 'Failed to acknowledge exception');
    } finally {
      setSavingAck(false);
    }
  };

  const toggleGroup = (type: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

  // Group items by exception type
  const groupedExceptions = useMemo(() => {
    const groups: Record<string, ExceptionItem[]> = {};
    for (const item of items) {
      if (!groups[item.type]) {
        groups[item.type] = [];
      }
      groups[item.type].push(item);
    }
    return groups;
  }, [items]);

  const allCollapsed = useMemo(() => {
    const keys = Object.keys(groupedExceptions);
    return keys.length > 0 && keys.every((k) => collapsedGroups[k]);
  }, [groupedExceptions, collapsedGroups]);

  const toggleAllGroups = () => {
    const shouldCollapse = !allCollapsed;
    const next: Record<string, boolean> = {};
    for (const key of Object.keys(groupedExceptions)) {
      next[key] = shouldCollapse;
    }
    setCollapsedGroups(next);
  };

  const highCount = items.filter((i) => i.severity === 'HIGH' && !i.acknowledged).length;
  const mediumCount = items.filter((i) => i.severity === 'MEDIUM' && !i.acknowledged).length;
  const totalUnresolved = items.filter((i) => !i.acknowledged).length;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#8B2424] text-white shadow-xs">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Operational Exceptions & Alerts
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Surfaces active operational delays, proof anomalies, and compliance flags requiring action.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => fetchExceptions(true)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 disabled:opacity-50 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Interactive KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Total Unresolved */}
        <button
          type="button"
          onClick={() => setSeverityFilter('ALL')}
          className={`text-left rounded-2xl border p-4.5 transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-xs ${
            severityFilter === 'ALL'
              ? 'border-slate-400 bg-white ring-2 ring-[#8B2424] dark:bg-slate-900 dark:border-slate-700'
              : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/60'
          }`}
          title="Click to view all severities"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Total Unresolved Exceptions
            </span>
            <AlertCircle className="h-4 w-4 text-slate-500 dark:text-slate-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {totalUnresolved}
          </p>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">Pending manager action / review</span>
            <span className={`text-[10px] font-semibold ${severityFilter === 'ALL' ? 'text-[#8B2424] dark:text-rose-400' : 'text-slate-400'}`}>
              {severityFilter === 'ALL' ? '● Active' : 'Filter All'}
            </span>
          </div>
        </button>

        {/* High Severity */}
        <button
          type="button"
          onClick={() => setSeverityFilter(severityFilter === 'HIGH' ? 'ALL' : 'HIGH')}
          className={`text-left rounded-2xl border p-4.5 transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-xs ${
            severityFilter === 'HIGH'
              ? 'border-rose-400 bg-rose-50/70 ring-2 ring-rose-600 dark:bg-rose-950/40 dark:border-rose-700'
              : 'border-rose-200/80 bg-rose-50/30 hover:border-rose-300 hover:bg-rose-50/60 dark:border-rose-900/40 dark:bg-rose-950/20'
          }`}
          title="Click to filter by High severity"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">
              High Severity Issues
            </span>
            <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-rose-700 dark:text-rose-300">{highCount}</p>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[11px] text-rose-600/80">Requires immediate attention</span>
            <span className={`text-[10px] font-semibold ${severityFilter === 'HIGH' ? 'text-rose-700 dark:text-rose-300' : 'text-slate-400'}`}>
              {severityFilter === 'HIGH' ? '● Filter Active' : 'Filter High'}
            </span>
          </div>
        </button>

        {/* Medium Severity */}
        <button
          type="button"
          onClick={() => setSeverityFilter(severityFilter === 'MEDIUM' ? 'ALL' : 'MEDIUM')}
          className={`text-left rounded-2xl border p-4.5 transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-xs ${
            severityFilter === 'MEDIUM'
              ? 'border-blue-400 bg-blue-50/70 ring-2 ring-blue-600 dark:bg-blue-950/40 dark:border-blue-700'
              : 'border-blue-200/80 bg-blue-50/30 hover:border-blue-300 hover:bg-blue-50/60 dark:border-blue-900/40 dark:bg-blue-950/20'
          }`}
          title="Click to filter by Medium severity"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300">
              Medium Severity Items
            </span>
            <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-blue-700 dark:text-blue-300">{mediumCount}</p>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[11px] text-blue-600/80">Operational warnings & reconciliations</span>
            <span className={`text-[10px] font-semibold ${severityFilter === 'MEDIUM' ? 'text-blue-700 dark:text-blue-300' : 'text-slate-400'}`}>
              {severityFilter === 'MEDIUM' ? '● Filter Active' : 'Filter Med'}
            </span>
          </div>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <form onSubmit={handleSearchSubmit} className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
          {/* Keyword Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search exceptions, task, or campaign..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#8B2424] focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-950 dark:text-white transition"
            />
          </div>

          {/* Exception Type Filter */}
          <div className="w-full sm:w-48 shrink-0">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 focus:border-[#8B2424] focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-950 dark:text-white transition"
            >
              <option value="ALL">All Exception Types</option>
              <option value="missing_or_rejected_proof">Missing/Rejected Proofs</option>
              <option value="campaign_past_deadline">Campaigns Past Deadline</option>
              <option value="task_escalated_l3">L3 Escalated Tasks</option>
              <option value="gps_mismatch">GPS Geo-Fence Mismatches</option>
              <option value="failed_audit_check">Failed Audit Checks</option>
              <option value="client_payment_outstanding">Client Payment Outstanding</option>
              <option value="vendor_payment_outstanding">Vendor PO Exceptions</option>
            </select>
          </div>

          {/* Severity Filter */}
          <div className="w-full sm:w-36 shrink-0">
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 focus:border-[#8B2424] focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-950 dark:text-white transition"
            >
              <option value="ALL">All Severities</option>
              <option value="HIGH">High Severity</option>
              <option value="MEDIUM">Medium Severity</option>
              <option value="LOW">Low Severity</option>
            </select>
          </div>

          {/* City Filter */}
          <div className="w-full sm:w-36 shrink-0">
            <input
              type="text"
              placeholder="Filter by city..."
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#8B2424] focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-950 dark:text-white transition"
            />
          </div>

          {/* Toggle Acknowledged */}
          <label className="h-10 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={includeAcknowledged}
              onChange={(e) => setIncludeAcknowledged(e.target.checked)}
              className="rounded border-slate-300 text-[#8B2424] focus:ring-[#8B2424]"
            />
            <span className="whitespace-nowrap">Show Acknowledged</span>
          </label>

          {/* Reset Button */}
          <button
            type="button"
            onClick={handleResetFilters}
            className="h-10 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-600 shadow-2xs hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 transition shrink-0"
            title="Reset all filters"
          >
            <RotateCw className="h-3.5 w-3.5 text-slate-400" />
            <span>Reset</span>
          </button>
        </form>
      </div>

      {/* Error alert */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Content: Grouped by Exception Type */}
      {loading && initialLoading ? (
        <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-16 dark:border-slate-800 dark:bg-slate-900">
          <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
          <span className="ml-2 text-sm text-slate-500">Scanning active exceptions...</span>
        </div>
      ) : Object.keys(groupedExceptions).length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-16 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 mb-3">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            All Operational Parameters Healthy
          </h3>
          <p className="mt-1 max-w-sm text-xs text-slate-500">
            No active anomalies, overdue campaigns, or unaddressed audit failures detected.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary bar & Expand/Collapse All */}
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-slate-500 font-medium">
              Showing <strong className="text-slate-900 dark:text-white">{items.length}</strong> active exceptions across <strong className="text-slate-900 dark:text-white">{Object.keys(groupedExceptions).length}</strong> categories
            </span>
            <button
              type="button"
              onClick={toggleAllGroups}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#8B2424] hover:text-[#721c1c] dark:text-rose-400 transition"
            >
              <span>{allCollapsed ? 'Expand All Groups' : 'Collapse All Groups'}</span>
            </button>
          </div>

          {Object.entries(groupedExceptions).map(([typeKey, groupItems]) => {
            const config = TYPE_CONFIG[typeKey as ExceptionType] || {
              title: typeKey.replace(/_/g, ' '),
              description: 'Operational exception group',
              icon: AlertTriangle,
              accentColor: 'text-slate-700 bg-slate-100',
            };
            const IconComp = config.icon;
            const isCollapsed = collapsedGroups[typeKey];

            return (
              <div
                key={typeKey}
                className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden dark:border-slate-800 dark:bg-slate-900"
              >
                {/* Group Header */}
                <button
                  type="button"
                  onClick={() => toggleGroup(typeKey)}
                  className="flex w-full items-center justify-between border-b border-slate-100 bg-slate-50/60 p-4 text-left transition hover:bg-slate-100/60 dark:border-slate-800 dark:bg-slate-800/40 dark:hover:bg-slate-800/70"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-lg ${config.accentColor}`}
                    >
                      <IconComp className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                          {config.title}
                        </h2>
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-800 dark:bg-rose-900/50 dark:text-rose-300">
                          {groupItems.length}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">{config.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="text-xs">{isCollapsed ? 'Expand' : 'Collapse'}</span>
                    {isCollapsed ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronUp className="h-4 w-4" />
                    )}
                  </div>
                </button>

                {/* Group Items */}
                {!isCollapsed && (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {groupItems.map((item) => {
                      const isHigh = item.severity === 'HIGH';
                      const isAcknowledged = item.acknowledged;

                      return (
                        <div
                          key={item.id}
                          className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between transition ${
                            isAcknowledged
                              ? 'bg-slate-50/50 opacity-60 dark:bg-slate-800/20'
                              : isHigh
                              ? 'hover:bg-rose-50/20 dark:hover:bg-rose-950/10'
                              : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/30'
                          }`}
                        >
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            {/* Severity Tag */}
                            <span
                              className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                item.severity === 'HIGH'
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                  : item.severity === 'MEDIUM'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                  : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                              }`}
                            >
                              {item.severity}
                            </span>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                  {item.title}
                                </h3>
                                {item.source && (
                                  <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                    {item.source}
                                  </span>
                                )}
                                {item.city && (
                                  <span className="text-[11px] text-slate-400">
                                    &bull; {item.city}
                                  </span>
                                )}
                              </div>

                              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                                {item.description}
                              </p>

                              <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  <span>
                                    Detected:{' '}
                                    {new Date(item.occurredAt).toLocaleDateString('en-IN', {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric',
                                    })}
                                  </span>
                                </span>
                                {item.campaignName && (
                                  <span>Campaign: {item.campaignName}</span>
                                )}
                                {isAcknowledged && (
                                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                    &bull; Acknowledged
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 shrink-0 sm:self-center">
                            {/* Inspect Record Modal Button */}
                            <button
                              type="button"
                              onClick={() => setInspectingItem(item)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition shadow-2xs"
                            >
                              <span>View Record</span>
                              <ExternalLink className="h-3 w-3 text-slate-400" />
                            </button>

                            {/* Acknowledge button */}
                            {!isAcknowledged && (
                              <button
                                type="button"
                                onClick={() => openAcknowledgeModal(item)}
                                className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white transition"
                                title="Acknowledge and archive this exception"
                              >
                                <Check className="h-3 w-3" />
                                <span>Acknowledge</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal 1: View Record / Exception Inspector Modal ────────────────── */}
      {inspectingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <span
                  className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                    inspectingItem.severity === 'HIGH'
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      : inspectingItem.severity === 'MEDIUM'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                  }`}
                >
                  {inspectingItem.severity}
                </span>
                <h2 className="text-base font-bold text-slate-900 dark:text-white truncate max-w-md">
                  {inspectingItem.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setInspectingItem(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              {/* Description Card */}
              <div className="rounded-xl border border-rose-200/80 bg-rose-50/40 p-4 dark:border-rose-900/40 dark:bg-rose-950/20">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">
                  Exception Issue & Description
                </span>
                <p className="mt-1 text-xs font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                  {inspectingItem.description}
                </p>
              </div>

              {/* Entity & Campaign Details Grid */}
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                <div>
                  <span className="text-slate-400 font-medium text-[11px]">Source Module:</span>
                  <p className="font-semibold text-slate-900 dark:text-white mt-0.5">
                    {inspectingItem.source}
                  </p>
                </div>

                <div>
                  <span className="text-slate-400 font-medium text-[11px]">Campaign:</span>
                  <p className="font-semibold text-slate-900 dark:text-white mt-0.5">
                    {inspectingItem.campaignName || 'General Operational Asset'}
                  </p>
                </div>

                <div>
                  <span className="text-slate-400 font-medium text-[11px]">City / Location:</span>
                  <p className="font-semibold text-slate-900 dark:text-white mt-0.5">
                    {inspectingItem.city || 'National / Unspecified'}
                  </p>
                </div>

                <div>
                  <span className="text-slate-400 font-medium text-[11px]">Detected Date:</span>
                  <p className="font-semibold text-slate-900 dark:text-white mt-0.5">
                    {new Date(inspectingItem.occurredAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>

                {inspectingItem.amount !== undefined && (
                  <div>
                    <span className="text-slate-400 font-medium text-[11px]">Contracted / PO Amount:</span>
                    <p className="font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                      ₹{inspectingItem.amount.toLocaleString('en-IN')}
                    </p>
                  </div>
                )}

                <div>
                  <span className="text-slate-400 font-medium text-[11px]">Record Entity Reference:</span>
                  <p className="font-mono text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 truncate" title={inspectingItem.entityId}>
                    {inspectingItem.entityType}: #{inspectingItem.entityId.slice(-8)}
                  </p>
                </div>
              </div>

              {/* Extra Metadata */}
              {inspectingItem.metadata && Object.keys(inspectingItem.metadata).length > 0 && (
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-800/30">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
                    Associated Record Attributes
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    {Object.entries(inspectingItem.metadata).map(([k, v]) => {
                      if (v === null || v === undefined || typeof v === 'object') return null;
                      return (
                        <div key={k} className="flex flex-col">
                          <span className="text-slate-400 capitalize">{k.replace(/([A-Z])/g, ' $1')}:</span>
                          <span className="font-medium text-slate-800 dark:text-slate-200 break-words">{String(v)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setInspectingItem(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                {!inspectingItem.acknowledged && (
                  <button
                    type="button"
                    onClick={() => {
                      const itemToAck = inspectingItem;
                      setInspectingItem(null);
                      openAcknowledgeModal(itemToAck);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Acknowledge</span>
                  </button>
                )}

                <Link
                  href={inspectingItem.link}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#8B2424] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#721c1c] transition"
                >
                  <span>Open Full Record</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 2: Acknowledge Confirmation Modal ───────────────────────── */}
      {acknowledgingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                  <Check className="h-4 w-4" />
                </span>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Acknowledge Operational Alert
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setAcknowledgingItem(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 text-xs">
              {/* Highlight summary */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white text-xs">
                    {acknowledgingItem.title}
                  </span>
                  <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                    {acknowledgingItem.severity}
                  </span>
                </div>
                <p className="mt-1 text-slate-500 leading-relaxed">
                  {acknowledgingItem.description}
                </p>
                {acknowledgingItem.campaignName && (
                  <p className="mt-2 text-[11px] text-slate-400 font-medium">
                    Campaign: {acknowledgingItem.campaignName} {acknowledgingItem.city ? `• ${acknowledgingItem.city}` : ''}
                  </p>
                )}
              </div>

              {/* Notes Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Resolution Notes / Action Taken (Optional)
                </label>
                <textarea
                  rows={3}
                  value={acknowledgeNotes}
                  onChange={(e) => setAcknowledgeNotes(e.target.value)}
                  placeholder="e.g., Client requested extension to Friday, physical inspection verified verbally with field agent, replacement PO issued..."
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#8B2424] focus:outline-hidden dark:border-slate-700 dark:bg-slate-950 dark:text-white transition"
                />
                <span className="mt-1 text-[11px] text-slate-400 block">
                  Acknowledging will archive this exception and hide it from the active alerts list.
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setAcknowledgingItem(null)}
                disabled={savingAck}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmAcknowledge}
                disabled={savingAck}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white transition"
              >
                {savingAck ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Acknowledging...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Confirm Acknowledgment</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExceptionsDashboard;
