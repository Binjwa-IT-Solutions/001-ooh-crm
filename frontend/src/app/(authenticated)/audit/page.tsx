'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  ShieldCheck,
  Search,
  Filter,
  Download,
  RefreshCw,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Layers,
  Activity,
  AlertTriangle,
  RotateCw,
} from 'lucide-react';

import { RequireAuth } from '@/shared/auth/require-auth';
import { auditApi } from '@/modules/audit/api';
import type { AuditFilters, AuditLogEntry } from '@/modules/audit/types';
import { AuditDetailModal } from '@/modules/audit/components/AuditDetailModal';
import { ComplianceViewerTab } from '@/modules/audit/components/ComplianceViewerTab';
import { getBusinessActivityInfo } from '@/modules/audit/audit-helpers';

const ENTITY_OPTIONS = [
  { value: 'ALL', label: 'All Modules' },
  { value: 'leads', label: 'Leads' },
  { value: 'quotations', label: 'Quotations' },
  { value: 'campaigns', label: 'Campaigns' },
  { value: 'sites', label: 'Sites / Inventory' },
  { value: 'bookings', label: 'Bookings' },
  { value: 'employees', label: 'Employees' },
  { value: 'users', label: 'Users' },
  { value: 'purchase-orders', label: 'Purchase Orders' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'auth', label: 'Auth & Sessions' },
];

const ACTION_OPTIONS = [
  { value: 'ALL', label: 'All Actions' },
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
  { value: 'login', label: 'Login' },
  { value: 'logout', label: 'Logout' },
  { value: 'login_failed', label: 'Failed Login' },
  { value: 'export', label: 'Export' },
];

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<'logs' | 'compliance'>('logs');

  // Filters state
  const [entity, setEntity] = useState('ALL');
  const [action, setAction] = useState('ALL');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');

  // Modal inspection
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);
  const [, startTransition] = useTransition();

  const fetchLogs = async (targetPage = page) => {
    try {
      setLoading(true);
      setError(null);

      const filters: AuditFilters = {
        entity,
        action,
        from: from || undefined,
        to: to || undefined,
        search: search.trim() || undefined,
        page: targetPage,
        pageSize,
      };

      const res = await auditApi.getLogs(filters);
      setLogs(res.data || []);
      setTotal(res.meta.total || 0);
      setPage(res.meta.page || 1);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to fetch audit records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      if (p.get('tab') === 'compliance') {
        setActiveTab('compliance');
      }
    }
  }, []);

  useEffect(() => {
    fetchLogs(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, action, from, to, pageSize]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs(1);
  };

  const handleResetFilters = () => {
    setEntity('ALL');
    setAction('ALL');
    setFrom('');
    setTo('');
    setSearch('');
    startTransition(() => {
      fetchLogs(1);
    });
  };

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      await auditApi.exportCsv({
        entity,
        action,
        from: from || undefined,
        to: to || undefined,
      });
    } catch (err: any) {
      alert(err.message || 'Failed to export CSV');
    } finally {
      setExporting(false);
    }
  };

  const getActionBadge = (act: string) => {
    switch (act.toLowerCase()) {
      case 'create':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
      case 'update':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800';
      case 'delete':
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800';
      case 'login':
        return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800';
      case 'login_failed':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
      case 'export':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    }
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <RequireAuth permission="audit.view">
      <div className="space-y-6 pb-12">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#8B2424] text-white shadow-sm">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Compliance & Audit Trail
              </h1>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Digital activity ledger recording every business transaction, status change, and user activity.
            </p>
          </div>

          {activeTab === 'logs' && (
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => fetchLogs()}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 disabled:opacity-50 transition"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>

              <button
                type="button"
                onClick={handleExportCsv}
                disabled={exporting || loading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#8B2424] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#721c1c] disabled:opacity-50 transition"
              >
                <Download className="h-3.5 w-3.5" />
                <span>{exporting ? 'Exporting...' : 'Export Audit CSV'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
              activeTab === 'logs'
                ? 'border-[#8B2424] text-[#8B2424] dark:border-rose-500 dark:text-rose-400'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Activity Ledger (Logs)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('compliance')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
              activeTab === 'compliance'
                ? 'border-[#8B2424] text-[#8B2424] dark:border-rose-500 dark:text-rose-400'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Campaign Compliance Checks</span>
          </button>
        </div>

        {activeTab === 'compliance' ? (
          <ComplianceViewerTab />
        ) : (
          <>
            {/* KPI Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Total Activity Records</span>
              <Layers className="h-4 w-4 text-slate-400" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{total.toLocaleString('en-IN')}</p>
            <p className="mt-1 text-[11px] text-slate-400">Permanent tamper-proof history</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Tracked Modules</span>
              <Activity className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">10+ Modules</p>
            <p className="mt-1 text-[11px] text-slate-400">Leads, Quotes, Campaigns, Finance</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Data Privacy</span>
              <ShieldCheck className="h-4 w-4 text-blue-500" />
            </div>
            <p className="mt-2 text-2xl font-bold text-blue-600 dark:text-blue-400">Protected</p>
            <p className="mt-1 text-[11px] text-slate-400">Passwords & Banking masked</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Access Scope</span>
              <ShieldCheck className="h-4 w-4 text-purple-500" />
            </div>
            <p className="mt-2 text-2xl font-bold text-purple-600 dark:text-purple-400">Admin & Finance</p>
            <p className="mt-1 text-[11px] text-slate-400">Restricted role authorization</p>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <form onSubmit={handleSearchSubmit} className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search actor email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-slate-400 transition"
              />
            </div>

            {/* Entity Module Dropdown */}
            <div className="w-full sm:w-44 shrink-0">
              <select
                value={entity}
                onChange={(e) => setEntity(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 focus:border-slate-900 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-950 dark:text-white transition"
              >
                {ENTITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Action Type Dropdown */}
            <div className="w-full sm:w-40 shrink-0">
              <select
                value={action}
                onChange={(e) => setAction(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 focus:border-slate-900 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-950 dark:text-white transition"
              >
                {ACTION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range Inputs */}
            <div className="flex items-center gap-2 shrink-0">
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-10 w-36 sm:w-40 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 focus:border-slate-900 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-950 dark:text-white transition"
                title="Filter records from date"
              />
              <span className="text-xs text-slate-400 font-medium">to</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-10 w-36 sm:w-40 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 focus:border-slate-900 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-950 dark:text-white transition"
                title="Filter records to date"
              />
            </div>

            {/* Reset Button */}
            <button
              type="button"
              onClick={handleResetFilters}
              className="h-10 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-600 shadow-2xs hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 transition shrink-0"
              title="Reset all filters"
            >
              <RotateCw className="h-3.5 w-3.5 text-slate-400" />
              <span>Reset</span>
            </button>
          </form>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Audit Log Table */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50/75 font-semibold text-slate-600 uppercase tracking-wider dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3">Timestamp (IST)</th>
                  <th className="px-5 py-3">Actor / User</th>
                  <th className="px-5 py-3">Action</th>
                  <th className="px-5 py-3">Module & Record</th>
                  <th className="px-5 py-3">Business Activity & Channel</th>
                  <th className="px-5 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-5 py-4"><div className="h-4 w-32 rounded bg-slate-100 dark:bg-slate-800" /></td>
                      <td className="px-5 py-4"><div className="h-4 w-40 rounded bg-slate-100 dark:bg-slate-800" /></td>
                      <td className="px-5 py-4"><div className="h-4 w-16 rounded bg-slate-100 dark:bg-slate-800" /></td>
                      <td className="px-5 py-4"><div className="h-4 w-24 rounded bg-slate-100 dark:bg-slate-800" /></td>
                      <td className="px-5 py-4"><div className="h-4 w-36 rounded bg-slate-100 dark:bg-slate-800" /></td>
                      <td className="px-5 py-4 text-right"><div className="ml-auto h-4 w-12 rounded bg-slate-100 dark:bg-slate-800" /></td>
                    </tr>
                  ))
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-sm text-slate-500">
                      <Filter className="mx-auto mb-2 h-6 w-6 text-slate-300 dark:text-slate-600" />
                      <p className="font-semibold text-slate-900 dark:text-white">No audit records found</p>
                      <p className="mt-1 text-xs text-slate-400">Try adjusting your filters or search criteria.</p>
                    </td>
                  </tr>
                ) : (
                  logs.map((entry) => {
                    const activity = getBusinessActivityInfo(entry);
                    return (
                      <tr key={entry._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                        {/* Timestamp */}
                        <td className="px-5 py-3.5 whitespace-nowrap text-slate-500">
                          {new Date(entry.createdAt).toLocaleString('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </td>

                        {/* Actor */}
                        <td className="px-5 py-3.5">
                          <div className="font-medium text-slate-900 dark:text-white">
                            {entry.actorEmail || 'System / Automated'}
                          </div>
                          {entry.actorRole && (
                            <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">
                              {entry.actorRole}
                            </span>
                          )}
                        </td>

                        {/* Action */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${getActionBadge(entry.action)}`}>
                            {entry.action}
                          </span>
                        </td>

                        {/* Module & Record */}
                        <td className="px-5 py-3.5">
                          <span className="font-semibold capitalize text-slate-800 dark:text-slate-200">
                            {entry.entity}
                          </span>
                          {entry.entityId && (
                            <span className="block font-mono text-[10px] text-slate-400 truncate max-w-32" title={entry.entityId}>
                              #{entry.entityId.slice(-8)}
                            </span>
                          )}
                        </td>

                        {/* Business Activity & Channel */}
                        <td className="px-5 py-3.5 max-w-[260px]" title={entry.method || entry.path ? `Technical: ${entry.method ?? ''} ${entry.path ?? ''}`.trim() : 'N/A'}>
                          <div className="font-medium text-slate-900 dark:text-white truncate">
                            {activity.title}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`inline-flex items-center rounded-md border px-1.5 py-0.2 text-[10px] font-medium ${activity.badgeColor}`}>
                              {activity.channel}
                            </span>
                          </div>
                        </td>

                      {/* View Button */}
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedEntry(entry)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition shadow-2xs"
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
            <div className="text-xs text-slate-500">
              Showing <span className="font-semibold text-slate-900 dark:text-white">{total === 0 ? 0 : (page - 1) * pageSize + 1}</span> to{' '}
              <span className="font-semibold text-slate-900 dark:text-white">{Math.min(page * pageSize, total)}</span> of{' '}
              <span className="font-semibold text-slate-900 dark:text-white">{total}</span> results
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span>Per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => fetchLogs(page - 1)}
                  disabled={page <= 1 || loading}
                  className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 disabled:opacity-40 transition"
                  title="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => fetchLogs(page + 1)}
                  disabled={page >= totalPages || loading}
                  className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 disabled:opacity-40 transition"
                  title="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Detail Inspection Modal */}
        <AuditDetailModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
          </>
        )}
      </div>
    </RequireAuth>
  );
}
