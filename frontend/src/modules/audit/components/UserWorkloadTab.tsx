'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Users,
  Search,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  FileText,
  Calendar,
  Briefcase,
  AlertCircle,
  Activity,
  ArrowUpRight,
  Filter,
  Layers,
} from 'lucide-react';
import { auditApi } from '../api';
import type { UserSummaryItem, UserWorkloadAuditResponse } from '../types';

export function UserWorkloadTab() {
  const [users, setUsers] = useState<UserSummaryItem[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [dateRange, setDateRange] = useState<'all' | 'today' | '7days' | '30days'>('all');

  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingWorkload, setLoadingWorkload] = useState(false);
  const [workloadData, setWorkloadData] = useState<UserWorkloadAuditResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sales Queue Tabs: 'leads' | 'quotes' | 'tasks'
  const [salesQueueTab, setSalesQueueTab] = useState<'leads' | 'quotes' | 'tasks'>('leads');

  // Operations Task Filter: 'ALL' | 'Installation' | 'Printing' | 'Verification' | 'OVERDUE'
  const [opsTaskFilter, setOpsTaskFilter] = useState<string>('ALL');

  // General Task Filter: 'ALL' | 'InProgress' | 'Pending' | 'OVERDUE'
  const [generalTaskFilter, setGeneralTaskFilter] = useState<string>('ALL');

  // Calculate ISO string bounds based on selected dateRange
  const { fromDate, toDate } = useMemo(() => {
    if (dateRange === 'all') return { fromDate: undefined, toDate: undefined };
    const now = new Date();
    const to = now.toISOString();
    let from: Date;

    if (dateRange === 'today') {
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    } else if (dateRange === '7days') {
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else {
      // 30days
      from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    return { fromDate: from.toISOString(), toDate: to };
  }, [dateRange]);

  // Load user list
  const loadUsers = async () => {
    try {
      setLoadingUsers(true);
      setError(null);
      const res = await auditApi.getWorkloadUsers();
      const list = res.data || [];
      setUsers(list);
      if (list.length > 0 && !selectedUserId) {
        setSelectedUserId(list[0]._id);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to fetch staff members list');
    } finally {
      setLoadingUsers(false);
    }
  };

  // Load workload data for selected user
  const loadUserWorkload = async (userId: string) => {
    if (!userId) return;
    try {
      setLoadingWorkload(true);
      setError(null);
      const res = await auditApi.getUserWorkload(userId, fromDate, toDate);
      setWorkloadData(res.data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to fetch user workload metrics');
    } finally {
      setLoadingWorkload(false);
    }
  };

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      loadUserWorkload(selectedUserId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId, fromDate, toDate]);

  // Filtered users for dropdown search
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchSearch =
        u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(userSearch.toLowerCase());
      const matchRole =
        roleFilter === 'ALL' ||
        u.role.toLowerCase() === roleFilter.toLowerCase() ||
        (roleFilter === 'ops' && (u.role.toLowerCase() === 'ops' || u.role.toLowerCase() === 'operations'));
      return matchSearch && matchRole;
    });
  }, [users, userSearch, roleFilter]);

  // Synchronize selectedUserId when roleFilter or filteredUsers change
  useEffect(() => {
    if (filteredUsers.length > 0) {
      const isCurrentSelectedValid = filteredUsers.some((u) => u._id === selectedUserId);
      if (!isCurrentSelectedValid) {
        setSelectedUserId(filteredUsers[0]._id);
      }
    }
  }, [filteredUsers, selectedUserId]);

  const selectedUserObj = useMemo(() => {
    return users.find((u) => u._id === selectedUserId) || null;
  }, [users, selectedUserId]);

  // Role detection: accurately reflects the currently selected user
  const currentRole = (selectedUserObj?.role || workloadData?.user.role || '').toLowerCase();
  const hasCommercialWork = Boolean(
    (workloadData?.pendingItems.leads.length ?? 0) > 0 ||
    (workloadData?.pendingItems.quotations.length ?? 0) > 0 ||
    (workloadData?.metrics.completed.leadsWon ?? 0) > 0 ||
    (workloadData?.metrics.pending.leadsActive ?? 0) > 0
  );
  const isSales = currentRole === 'sales_agent' || (['manager', 'admin'].includes(currentRole) && hasCommercialWork);
  const isOps = ['ops', 'operations', 'media_manager'].includes(currentRole);
  const isFinance = currentRole === 'finance';

  const formatCurrency = (paise: number) => {
    return (paise / 100).toLocaleString('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    });
  };

  const formatRoleName = (role: string) => {
    return role.replace(/_/g, ' ').toUpperCase();
  };

  // Filtered tasks for Operations
  const displayedOpsTasks = useMemo(() => {
    if (!workloadData) return [];
    const tasks = workloadData.pendingItems.tasks;
    if (opsTaskFilter === 'ALL') return tasks;
    if (opsTaskFilter === 'OVERDUE') return tasks.filter((t) => t.isOverdue);
    return tasks.filter((t) => (t.type || '').toLowerCase() === opsTaskFilter.toLowerCase());
  }, [workloadData, opsTaskFilter]);

  // Filtered tasks for Finance / General staff
  const displayedGeneralTasks = useMemo(() => {
    if (!workloadData) return [];
    const tasks = workloadData.pendingItems.tasks;
    if (generalTaskFilter === 'ALL') return tasks;
    if (generalTaskFilter === 'OVERDUE') return tasks.filter((t) => t.isOverdue);
    return tasks.filter((t) => t.status === generalTaskFilter);
  }, [workloadData, generalTaskFilter]);

  // Total tasks count from response
  const totalAssignedTasks = workloadData?.metrics.performance.totalTasksCount ?? (
    (workloadData?.metrics.completed.tasksCompleted ?? 0) +
    (workloadData?.metrics.pending.tasksPending ?? 0) +
    (workloadData?.metrics.pending.tasksInProgress ?? 0)
  );

  return (
    <div className="space-y-6">
      {/* 1. Unified Executive Staff Selector & Filter Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          {/* Left: User Avatar + Dropdowns + Quick Profile Info */}
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            {/* User Avatar */}
            {selectedUserObj && (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#8B2424] to-[#a83232] text-sm font-bold text-white shadow-xs">
                {selectedUserObj.name.slice(0, 2).toUpperCase()}
              </div>
            )}

            {/* Select Staff Dropdown */}
            <div className="relative min-w-[240px] flex-1 max-w-sm">
              <label htmlFor="staff-picker" className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Audited Staff Member
              </label>
              <select
                id="staff-picker"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                disabled={loadingUsers}
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-900 focus:border-[#8B2424] focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-950 dark:text-white transition cursor-pointer"
              >
                {filteredUsers.length === 0 ? (
                  <option value="">No staff members matching</option>
                ) : (
                  filteredUsers.map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.name} ({formatRoleName(u.role)})
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Role Filter */}
            <div className="shrink-0">
              <label htmlFor="role-filter" className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Filter Role
              </label>
              <select
                id="role-filter"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 focus:border-slate-400 focus:outline-hidden dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 cursor-pointer"
              >
                <option value="ALL">All Roles</option>
                <option value="sales_agent">Sales Agents</option>
                <option value="ops">Operations (Ops)</option>
                <option value="media_manager">Media Managers</option>
                <option value="finance">Finance</option>
                <option value="hr">HR</option>
                <option value="manager">Managers</option>
                <option value="admin">Admins</option>
              </select>
            </div>

            {/* Staff Details Badge (Email + Status) */}
            {selectedUserObj && (
              <div className="hidden 2xl:flex flex-col justify-center pl-2 text-xs border-l border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedUserObj.email}</span>
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.2 text-[10px] font-semibold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
                    Active
                  </span>
                </div>
                {selectedUserObj.lastLoginAt && (
                  <span className="text-[11px] text-slate-400">
                    Last active: {new Date(selectedUserObj.lastLoginAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Right: Date Range Selector & Refresh */}
          <div className="flex items-center gap-2 shrink-0 self-end xl:self-center">
            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium dark:border-slate-800 dark:bg-slate-950">
              <button
                type="button"
                onClick={() => setDateRange('all')}
                className={`rounded-md px-2.5 py-1.5 transition ${
                  dateRange === 'all'
                    ? 'bg-[#8B2424] text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                All Time
              </button>
              <button
                type="button"
                onClick={() => setDateRange('today')}
                className={`rounded-md px-2.5 py-1.5 transition ${
                  dateRange === 'today'
                    ? 'bg-[#8B2424] text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setDateRange('7days')}
                className={`rounded-md px-2.5 py-1.5 transition ${
                  dateRange === '7days'
                    ? 'bg-[#8B2424] text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                Last 7 Days
              </button>
              <button
                type="button"
                onClick={() => setDateRange('30days')}
                className={`rounded-md px-2.5 py-1.5 transition ${
                  dateRange === '30days'
                    ? 'bg-[#8B2424] text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                Last 30 Days
              </button>
            </div>

            <button
              type="button"
              onClick={() => selectedUserId && loadUserWorkload(selectedUserId)}
              disabled={loadingWorkload || !selectedUserId}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 disabled:opacity-50 transition cursor-pointer"
              title="Refresh workload metrics"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingWorkload ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading Skeleton */}
      {loadingWorkload && !workloadData && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900"
            />
          ))}
        </div>
      )}

      {/* Workload Data Content */}
      {workloadData && (
        <>
          {/* Role Focus Scope Banner */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-2.5 text-xs dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-600 dark:text-slate-400">Auditing Focus:</span>
              <span className="rounded-md bg-[#8B2424]/10 px-2.5 py-0.5 font-bold text-[#8B2424] dark:bg-rose-950/40 dark:text-rose-400">
                {isSales
                  ? 'Commercial & Sales Pipeline Focus'
                  : isOps
                  ? 'Operations, Site Execution & Field Deliverables'
                  : isFinance
                  ? 'Financial Reconciliations & Assigned Tasks'
                  : 'Staff Deliverables & On-Time SLA Focus'}
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              {isSales
                ? 'Auditing customer acquisition, quotations sent & client follow-ups'
                : isOps
                ? 'Auditing mounting, printing, site verification proofs & campaign tasks'
                : 'Auditing staff responsibilities, deadlines & system mutations'}
            </span>
          </div>

          {/* 2. KPI Summary 4-Grid Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Card 1: Completed Work */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-5 shadow-xs dark:border-emerald-900/60 dark:bg-emerald-950/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider dark:text-emerald-300">
                  {isSales ? 'Deals & Work Completed' : isOps ? 'Execution Completed' : 'Work Completed'}
                </span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-emerald-900 dark:text-emerald-100">
                  {isSales
                    ? workloadData.metrics.completed.leadsWon + workloadData.metrics.completed.tasksCompleted
                    : workloadData.metrics.completed.tasksCompleted}
                </span>
                <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                  {isSales ? 'Leads & Tasks closed' : isOps ? 'Operations tasks finished' : 'Tasks finished'}
                </span>
              </div>

              <div className="mt-3 space-y-1.5 border-t border-emerald-200/60 pt-2.5 text-xs text-emerald-900 dark:border-emerald-900/40 dark:text-emerald-200">
                {isSales ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Leads Won:</span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-300">
                        {workloadData.metrics.completed.leadsWon}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Quotes Sent / Accepted:</span>
                      <span className="font-semibold">
                        {workloadData.metrics.completed.quotationsSent} / {workloadData.metrics.completed.quotationsAccepted}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Calls Logged:</span>
                      <span className="font-semibold">{workloadData.metrics.completed.callsLogged}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Tasks Completed:</span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-300">
                        {workloadData.metrics.completed.tasksCompleted}
                      </span>
                    </div>
                  </>
                ) : isOps ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Tasks Completed:</span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-300">
                        {workloadData.metrics.completed.tasksCompleted}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Site Proofs Uploaded:</span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-300">
                        {workloadData.metrics.ops?.proofsUploaded ?? 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Campaigns Managed:</span>
                      <span className="font-semibold">
                        {workloadData.metrics.ops?.campaignsManaged ?? 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">System Activity Events:</span>
                      <span className="font-semibold">{workloadData.metrics.completed.totalAuditActions}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Tasks Completed:</span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-300">
                        {workloadData.metrics.completed.tasksCompleted}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">System Ledger Actions:</span>
                      <span className="font-semibold">{workloadData.metrics.completed.totalAuditActions}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">User Status:</span>
                      <span className="font-semibold text-emerald-600 capitalize">{workloadData.user.status}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Card 2: Active / Pending Workload */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-5 shadow-xs dark:border-amber-900/60 dark:bg-amber-950/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-800 uppercase tracking-wider dark:text-amber-300">
                  {isSales ? 'Active Pipeline (Pending)' : isOps ? 'Pending Operations Queue' : 'Active Workload (Pending)'}
                </span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
                  <Clock className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-amber-900 dark:text-amber-100">
                  {isSales
                    ? workloadData.metrics.pending.leadsActive + workloadData.metrics.pending.tasksPending + workloadData.metrics.pending.tasksInProgress
                    : workloadData.metrics.pending.tasksPending + workloadData.metrics.pending.tasksInProgress}
                </span>
                <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                  {isSales ? 'Queue items in progress' : isOps ? 'Execution tasks pending' : 'Tasks waiting'}
                </span>
              </div>

              <div className="mt-3 space-y-1.5 border-t border-amber-200/60 pt-2.5 text-xs text-amber-900 dark:border-amber-900/40 dark:text-amber-200">
                {isSales ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Active Pipeline Leads:</span>
                      <span className="font-bold text-amber-700 dark:text-amber-300">
                        {workloadData.metrics.pending.leadsActive}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">New / Uncontacted:</span>
                      <span className="font-semibold">{workloadData.metrics.pending.leadsNew}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Draft Quotations:</span>
                      <span className="font-semibold">{workloadData.metrics.pending.quotationsDraft}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Open Tasks:</span>
                      <span className="font-bold text-amber-700 dark:text-amber-300">
                        {workloadData.metrics.pending.tasksPending + workloadData.metrics.pending.tasksInProgress}
                      </span>
                    </div>
                  </>
                ) : isOps ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Tasks In-Progress:</span>
                      <span className="font-bold text-amber-700 dark:text-amber-300">
                        {workloadData.metrics.pending.tasksInProgress}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Tasks Pending Start:</span>
                      <span className="font-semibold">{workloadData.metrics.pending.tasksPending}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Live Campaigns:</span>
                      <span className="font-bold text-amber-700 dark:text-amber-300">
                        {workloadData.metrics.ops?.activeCampaigns ?? 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Total Task Backlog:</span>
                      <span className="font-semibold">
                        {workloadData.metrics.pending.tasksPending + workloadData.metrics.pending.tasksInProgress + workloadData.metrics.completed.tasksCompleted}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">In-Progress Tasks:</span>
                      <span className="font-bold text-amber-700 dark:text-amber-300">
                        {workloadData.metrics.pending.tasksInProgress}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Pending Tasks:</span>
                      <span className="font-semibold">{workloadData.metrics.pending.tasksPending}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Total Assigned:</span>
                      <span className="font-semibold">
                        {workloadData.metrics.pending.tasksPending + workloadData.metrics.pending.tasksInProgress + workloadData.metrics.completed.tasksCompleted}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Card 3: Overdue / Action Needed */}
            <div
              className={`rounded-xl border p-5 shadow-xs ${
                (isSales
                  ? workloadData.metrics.overdue.leadsOverdueFollowUp + workloadData.metrics.overdue.tasksOverdue
                  : workloadData.metrics.overdue.tasksOverdue) > 0
                  ? 'border-rose-200 bg-rose-50/50 dark:border-rose-900/60 dark:bg-rose-950/20'
                  : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-800 uppercase tracking-wider dark:text-rose-300">
                  {isSales ? 'Overdue / Follow-up SLA' : 'Deadline Breaches (Overdue)'}
                </span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300">
                  <AlertTriangle className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-rose-900 dark:text-rose-100">
                  {isSales
                    ? workloadData.metrics.overdue.leadsOverdueFollowUp + workloadData.metrics.overdue.tasksOverdue
                    : workloadData.metrics.overdue.tasksOverdue}
                </span>
                <span className="text-xs text-rose-700 dark:text-rose-400 font-medium">
                  {isSales ? 'Items requiring action' : 'Tasks past deadline'}
                </span>
              </div>

              <div className="mt-3 space-y-1.5 border-t border-rose-200/60 pt-2.5 text-xs text-rose-900 dark:border-rose-900/40 dark:text-rose-200">
                {isSales ? (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 dark:text-slate-400">Overdue Follow-ups:</span>
                      <span
                        className={`font-bold ${
                          workloadData.metrics.overdue.leadsOverdueFollowUp > 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-slate-600'
                        }`}
                      >
                        {workloadData.metrics.overdue.leadsOverdueFollowUp}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 dark:text-slate-400">Overdue Deadlines:</span>
                      <span
                        className={`font-bold ${
                          workloadData.metrics.overdue.tasksOverdue > 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-slate-600'
                        }`}
                      >
                        {workloadData.metrics.overdue.tasksOverdue}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 dark:text-slate-400">Tasks Past Deadline:</span>
                      <span
                        className={`font-bold ${
                          workloadData.metrics.overdue.tasksOverdue > 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-emerald-600'
                        }`}
                      >
                        {workloadData.metrics.overdue.tasksOverdue}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 dark:text-slate-400">Tasks On Schedule:</span>
                      <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                        {Math.max(0, workloadData.metrics.pending.tasksPending + workloadData.metrics.pending.tasksInProgress - workloadData.metrics.overdue.tasksOverdue)}
                      </span>
                    </div>
                  </>
                )}
                <div className="pt-2 text-[11px] text-slate-500">
                  {(isSales
                    ? workloadData.metrics.overdue.leadsOverdueFollowUp + workloadData.metrics.overdue.tasksOverdue
                    : workloadData.metrics.overdue.tasksOverdue) > 0 ? (
                    <span className="text-rose-700 font-medium dark:text-rose-400">
                      ⚠️ SLA deadline exceeded
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-medium dark:text-emerald-400">
                      ✓ No overdue bottlenecks
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Card 4: Commercial Performance OR Operational SLA (With 0 Task Rate Fix) */}
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-5 shadow-xs dark:border-indigo-900/60 dark:bg-indigo-950/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-800 uppercase tracking-wider dark:text-indigo-300">
                  {isSales ? 'Commercial Pipeline & Value' : isOps ? 'Operational SLA & Delivery' : 'Task Efficiency & SLA'}
                </span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
                  <TrendingUp className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                {isSales ? (
                  <>
                    <span className="text-2xl font-extrabold text-indigo-900 dark:text-indigo-100">
                      {formatCurrency(workloadData.metrics.performance.wonContractValuePaise)}
                    </span>
                    <span className="text-xs text-indigo-700 dark:text-indigo-400 font-medium">
                      Won Deals
                    </span>
                  </>
                ) : totalAssignedTasks === 0 ? (
                  <>
                    <span className="text-3xl font-extrabold text-slate-400 dark:text-slate-500">
                      —
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      No tasks assigned
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-3xl font-extrabold text-indigo-900 dark:text-indigo-100">
                      {workloadData.metrics.performance.taskCompletionRate}%
                    </span>
                    <span className="text-xs text-indigo-700 dark:text-indigo-400 font-medium">
                      Completion Rate
                    </span>
                  </>
                )}
              </div>

              <div className="mt-3 space-y-1.5 border-t border-indigo-200/60 pt-2.5 text-xs text-indigo-900 dark:border-indigo-900/40 dark:text-indigo-200">
                {isSales ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Pipeline In-Flight:</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {formatCurrency(workloadData.metrics.performance.pipelineValuePaise)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Lead Conversion Rate:</span>
                      <span className="font-bold text-indigo-700 dark:text-indigo-300">
                        {workloadData.metrics.performance.leadConversionRate}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Task Completion Rate:</span>
                      <span className="font-bold text-indigo-700 dark:text-indigo-300">
                        {totalAssignedTasks === 0 ? '—' : `${workloadData.metrics.performance.taskCompletionRate}%`}
                      </span>
                    </div>
                  </>
                ) : isOps ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Installation / Mounting:</span>
                      <span className="font-bold text-indigo-700 dark:text-indigo-300">
                        {workloadData.metrics.ops?.tasksByType.installation ?? 0} tasks
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Printing Deliverables:</span>
                      <span className="font-semibold">
                        {workloadData.metrics.ops?.tasksByType.printing ?? 0} tasks
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Verification / Audits:</span>
                      <span className="font-semibold">
                        {workloadData.metrics.ops?.tasksByType.verification ?? 0} tasks
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Completed Tasks:</span>
                      <span className="font-bold text-indigo-700 dark:text-indigo-300">
                        {workloadData.metrics.completed.tasksCompleted}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Total Assigned:</span>
                      <span className="font-semibold">
                        {totalAssignedTasks}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">System Activity Records:</span>
                      <span className="font-semibold">{workloadData.metrics.completed.totalAuditActions}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 3. 2-Column Split: Role-Specific Work Queue & Staff Activity History */}
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Left Column (7 cols): Assigned Work Queue */}
            <div className="lg:col-span-7 space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
                {/* Header & Sub-Tabs */}
                <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/40">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-[#8B2424]" />
                    <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider dark:text-white">
                      {isSales
                        ? 'Assigned Sales & Leads Queue'
                        : isOps
                        ? 'Assigned Operations Execution Queue'
                        : 'Assigned Tasks & Deliverables'}
                    </h2>
                  </div>

                  {/* ──────────────────────────────────────────────────────────
                      ROLE-SPECIFIC QUEUE FILTER PILLS
                     ────────────────────────────────────────────────────────── */}

                  {/* A. If SALES AGENT: Show Leads, Quotations, Sales Tasks */}
                  {isSales && (
                    <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-900">
                      <button
                        type="button"
                        onClick={() => setSalesQueueTab('leads')}
                        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition cursor-pointer ${
                          salesQueueTab === 'leads'
                            ? 'bg-[#8B2424] text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                        }`}
                      >
                        <Users className="h-3 w-3" />
                        <span>Leads ({workloadData.pendingItems.leads.length})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSalesQueueTab('quotes')}
                        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition cursor-pointer ${
                          salesQueueTab === 'quotes'
                            ? 'bg-[#8B2424] text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                        }`}
                      >
                        <FileText className="h-3 w-3" />
                        <span>Quotations ({workloadData.pendingItems.quotations.length})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSalesQueueTab('tasks')}
                        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition cursor-pointer ${
                          salesQueueTab === 'tasks'
                            ? 'bg-[#8B2424] text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                        }`}
                      >
                        <Clock className="h-3 w-3" />
                        <span>Tasks ({workloadData.pendingItems.tasks.length})</span>
                      </button>
                    </div>
                  )}

                  {/* B. If OPERATIONS: Show Operations Task Filters (NO Leads, NO Quotes!) */}
                  {isOps && (
                    <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-900">
                      <button
                        type="button"
                        onClick={() => setOpsTaskFilter('ALL')}
                        className={`rounded-md px-2.5 py-1 text-xs transition cursor-pointer ${
                          opsTaskFilter === 'ALL'
                            ? 'bg-[#8B2424] text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                        }`}
                      >
                        All ({workloadData.pendingItems.tasks.length})
                      </button>

                      <button
                        type="button"
                        onClick={() => setOpsTaskFilter('Installation')}
                        className={`rounded-md px-2 py-1 text-xs transition cursor-pointer ${
                          opsTaskFilter === 'Installation'
                            ? 'bg-[#8B2424] text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                        }`}
                      >
                        Mounting ({workloadData.metrics.ops?.tasksByType.installation ?? 0})
                      </button>

                      <button
                        type="button"
                        onClick={() => setOpsTaskFilter('Printing')}
                        className={`rounded-md px-2 py-1 text-xs transition cursor-pointer ${
                          opsTaskFilter === 'Printing'
                            ? 'bg-[#8B2424] text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                        }`}
                      >
                        Printing ({workloadData.metrics.ops?.tasksByType.printing ?? 0})
                      </button>

                      <button
                        type="button"
                        onClick={() => setOpsTaskFilter('Verification')}
                        className={`rounded-md px-2 py-1 text-xs transition cursor-pointer ${
                          opsTaskFilter === 'Verification'
                            ? 'bg-[#8B2424] text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                        }`}
                      >
                        Verification ({workloadData.metrics.ops?.tasksByType.verification ?? 0})
                      </button>

                      {workloadData.metrics.overdue.tasksOverdue > 0 && (
                        <button
                          type="button"
                          onClick={() => setOpsTaskFilter('OVERDUE')}
                          className={`rounded-md px-2 py-1 text-xs transition cursor-pointer ${
                            opsTaskFilter === 'OVERDUE'
                              ? 'bg-rose-600 text-white shadow-2xs'
                              : 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                          }`}
                        >
                          ⚠️ Overdue ({workloadData.metrics.overdue.tasksOverdue})
                        </button>
                      )}
                    </div>
                  )}

                  {/* C. If FINANCE / HR / ADMIN / GENERAL: Show Status Filters (NO Leads, NO Quotes!) */}
                  {!isSales && !isOps && (
                    <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-900">
                      <button
                        type="button"
                        onClick={() => setGeneralTaskFilter('ALL')}
                        className={`rounded-md px-2.5 py-1 text-xs transition cursor-pointer ${
                          generalTaskFilter === 'ALL'
                            ? 'bg-[#8B2424] text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                        }`}
                      >
                        All Tasks ({workloadData.pendingItems.tasks.length})
                      </button>

                      <button
                        type="button"
                        onClick={() => setGeneralTaskFilter('InProgress')}
                        className={`rounded-md px-2.5 py-1 text-xs transition cursor-pointer ${
                          generalTaskFilter === 'InProgress'
                            ? 'bg-[#8B2424] text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                        }`}
                      >
                        In Progress ({workloadData.metrics.pending.tasksInProgress})
                      </button>

                      <button
                        type="button"
                        onClick={() => setGeneralTaskFilter('Pending')}
                        className={`rounded-md px-2.5 py-1 text-xs transition cursor-pointer ${
                          generalTaskFilter === 'Pending'
                            ? 'bg-[#8B2424] text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                        }`}
                      >
                        Pending ({workloadData.metrics.pending.tasksPending})
                      </button>

                      {workloadData.metrics.overdue.tasksOverdue > 0 && (
                        <button
                          type="button"
                          onClick={() => setGeneralTaskFilter('OVERDUE')}
                          className={`rounded-md px-2.5 py-1 text-xs transition cursor-pointer ${
                            generalTaskFilter === 'OVERDUE'
                              ? 'bg-rose-600 text-white shadow-2xs'
                              : 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                          }`}
                        >
                          Overdue ({workloadData.metrics.overdue.tasksOverdue})
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* ──────────────────────────────────────────────────────────
                    QUEUE CONTENT RENDERING
                   ────────────────────────────────────────────────────────── */}

                {/* 1. SALES: Leads Tab */}
                {isSales && salesQueueTab === 'leads' && (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {workloadData.pendingItems.leads.length === 0 ? (
                      <div className="py-12 text-center text-xs text-slate-500">
                        <FileText className="mx-auto mb-2 h-6 w-6 text-slate-300 dark:text-slate-600" />
                        <p className="font-semibold text-slate-900 dark:text-white">
                          No Active Leads Assigned
                        </p>
                        <p className="mt-1 text-slate-400">All customer inquiries are up-to-date or closed.</p>
                      </div>
                    ) : (
                      workloadData.pendingItems.leads.map((lead) => (
                        <div
                          key={lead._id}
                          className="flex items-center justify-between p-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-xs text-slate-900 dark:text-white">
                                {lead.companyName}
                              </span>
                              <span
                                className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                                  lead.status === 'Won'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : lead.status === 'New'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}
                              >
                                {lead.status}
                              </span>
                              {lead.isOverdue && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300">
                                  <AlertTriangle className="h-2.5 w-2.5" />
                                  Follow-up Overdue
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500">
                              Contact: {lead.contactPerson} ({lead.mobile})
                              {lead.city ? ` • ${lead.city}` : ''}
                            </p>
                            {lead.nextActionDate && (
                              <p className="text-[10px] text-slate-400">
                                Scheduled Follow-up:{' '}
                                <span
                                  className={
                                    lead.isOverdue
                                      ? 'font-bold text-rose-600'
                                      : 'text-slate-600 dark:text-slate-300'
                                  }
                                >
                                  {new Date(lead.nextActionDate).toLocaleDateString('en-IN', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                  })}
                                </span>
                              </p>
                            )}
                          </div>

                          <Link
                            href="/leads"
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition"
                          >
                            <span>Open</span>
                            <ArrowUpRight className="h-3 w-3" />
                          </Link>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* 2. SALES: Quotations Tab */}
                {isSales && salesQueueTab === 'quotes' && (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {workloadData.pendingItems.quotations.length === 0 ? (
                      <div className="py-12 text-center text-xs text-slate-500">
                        <FileText className="mx-auto mb-2 h-6 w-6 text-slate-300 dark:text-slate-600" />
                        <p className="font-semibold text-slate-900 dark:text-white">
                          No Open Quotations
                        </p>
                        <p className="mt-1 text-slate-400">All quotes have been closed or finalized.</p>
                      </div>
                    ) : (
                      workloadData.pendingItems.quotations.map((quote) => (
                        <div
                          key={quote._id}
                          className="flex items-center justify-between p-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-[#8B2424] dark:text-rose-400">
                                {quote.quoteNumber}
                              </span>
                              <span className="font-semibold text-xs text-slate-900 dark:text-white">
                                {quote.clientName}
                              </span>
                              <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                {quote.status}
                              </span>
                            </div>
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                              {formatCurrency(quote.totalPaise)}
                            </p>
                            {quote.validUntil && (
                              <p className="text-[10px] text-slate-400">
                                Valid until:{' '}
                                {new Date(quote.validUntil).toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </p>
                            )}
                          </div>

                          <Link
                            href="/quotations"
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition"
                          >
                            <span>Open</span>
                            <ArrowUpRight className="h-3 w-3" />
                          </Link>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* 3. SALES: Tasks Tab */}
                {isSales && salesQueueTab === 'tasks' && (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {workloadData.pendingItems.tasks.length === 0 ? (
                      <div className="py-12 text-center text-xs text-slate-500">
                        <FileText className="mx-auto mb-2 h-6 w-6 text-slate-300 dark:text-slate-600" />
                        <p className="font-semibold text-slate-900 dark:text-white">
                          No Pending Sales Tasks
                        </p>
                        <p className="mt-1 text-slate-400">Zero active tasks assigned to this agent.</p>
                      </div>
                    ) : (
                      workloadData.pendingItems.tasks.map((task) => (
                        <div
                          key={task._id}
                          className="flex items-center justify-between p-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-xs text-slate-900 dark:text-white">
                                {task.title}
                              </span>
                              <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                {task.type}
                              </span>
                              {task.isOverdue && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300">
                                  <AlertTriangle className="h-2.5 w-2.5" />
                                  Overdue
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-[10px] text-slate-400">
                              <span>Status: {task.status}</span>
                              {task.deadline && (
                                <span>
                                  Deadline:{' '}
                                  <span
                                    className={
                                      task.isOverdue
                                        ? 'font-bold text-rose-600'
                                        : 'text-slate-600 dark:text-slate-300'
                                    }
                                  >
                                    {new Date(task.deadline).toLocaleDateString('en-IN', {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric',
                                    })}
                                  </span>
                                </span>
                              )}
                            </div>
                          </div>

                          <Link
                            href="/tasks"
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition"
                          >
                            <span>Open</span>
                            <ArrowUpRight className="h-3 w-3" />
                          </Link>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* 4. OPERATIONS: Task Execution Queue */}
                {isOps && (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {displayedOpsTasks.length === 0 ? (
                      <div className="py-12 text-center text-xs text-slate-500">
                        <FileText className="mx-auto mb-2 h-6 w-6 text-slate-300 dark:text-slate-600" />
                        <p className="font-semibold text-slate-900 dark:text-white">
                          No Operations Tasks in This Filter
                        </p>
                        <p className="mt-1 text-slate-400">
                          {opsTaskFilter === 'ALL'
                            ? 'Zero active field deliverables assigned to this operations staff.'
                            : `No pending ${opsTaskFilter} tasks.`}
                        </p>
                      </div>
                    ) : (
                      displayedOpsTasks.map((task) => (
                        <div
                          key={task._id}
                          className="flex items-center justify-between p-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-xs text-slate-900 dark:text-white">
                                {task.title}
                              </span>
                              <span className="inline-flex items-center rounded-md border border-[#8B2424]/20 bg-[#8B2424]/5 px-2 py-0.5 text-[10px] font-bold text-[#8B2424] dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                                {task.type}
                              </span>
                              <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                {task.status}
                              </span>
                              {task.isOverdue && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300">
                                  <AlertTriangle className="h-2.5 w-2.5" />
                                  Deadline Breached
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-[10px] text-slate-400">
                              {task.deadline && (
                                <span>
                                  Due Date:{' '}
                                  <span
                                    className={
                                      task.isOverdue
                                        ? 'font-bold text-rose-600'
                                        : 'text-slate-600 dark:text-slate-300'
                                    }
                                  >
                                    {new Date(task.deadline).toLocaleDateString('en-IN', {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric',
                                    })}
                                  </span>
                                </span>
                              )}
                            </div>
                          </div>

                          <Link
                            href="/tasks"
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition"
                          >
                            <span>Manage Task</span>
                            <ArrowUpRight className="h-3 w-3" />
                          </Link>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* 5. FINANCE / HR / ADMIN / GENERAL: Tasks Queue */}
                {!isSales && !isOps && (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {displayedGeneralTasks.length === 0 ? (
                      <div className="py-12 text-center text-xs text-slate-500">
                        <FileText className="mx-auto mb-2 h-6 w-6 text-slate-300 dark:text-slate-600" />
                        <p className="font-semibold text-slate-900 dark:text-white">
                          No Active Tasks in This Status
                        </p>
                        <p className="mt-1 text-slate-400">
                          {generalTaskFilter === 'ALL'
                            ? 'All caught up! Zero active deliverables assigned to this staff member.'
                            : `No tasks found under ${generalTaskFilter}.`}
                        </p>
                      </div>
                    ) : (
                      displayedGeneralTasks.map((task) => (
                        <div
                          key={task._id}
                          className="flex items-center justify-between p-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-xs text-slate-900 dark:text-white">
                                {task.title}
                              </span>
                              <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                {task.type}
                              </span>
                              <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                {task.status}
                              </span>
                              {task.isOverdue && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300">
                                  <AlertTriangle className="h-2.5 w-2.5" />
                                  Overdue
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-[10px] text-slate-400">
                              {task.deadline && (
                                <span>
                                  Deadline:{' '}
                                  <span
                                    className={
                                      task.isOverdue
                                        ? 'font-bold text-rose-600'
                                        : 'text-slate-600 dark:text-slate-300'
                                    }
                                  >
                                    {new Date(task.deadline).toLocaleDateString('en-IN', {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric',
                                    })}
                                  </span>
                                </span>
                              )}
                            </div>
                          </div>

                          <Link
                            href="/tasks"
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition"
                          >
                            <span>Open Task</span>
                            <ArrowUpRight className="h-3 w-3" />
                          </Link>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column (5 cols): Staff Activity Ledger / Audit Log Stream */}
            <div className="lg:col-span-5 space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
                <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-emerald-600" />
                    <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider dark:text-white">
                      Staff Activity History
                    </h2>
                  </div>
                  <span className="text-[11px] text-slate-400">Audit mutations</span>
                </div>

                <div className="p-4">
                  {workloadData.recentActivities.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-500">
                      <Clock className="mx-auto mb-2 h-6 w-6 text-slate-300 dark:text-slate-600" />
                      <p className="font-semibold text-slate-900 dark:text-white">
                        No Recent Activity Records
                      </p>
                      <p className="mt-1 text-slate-400">
                        No system actions logged in the selected timeframe.
                      </p>
                    </div>
                  ) : (
                    <div className="relative border-l border-slate-200 pl-4 space-y-4 dark:border-slate-800 max-h-[480px] overflow-y-auto pr-2">
                      {workloadData.recentActivities.map((act) => (
                        <div key={act._id} className="relative">
                          {/* Dot indicator */}
                          <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#8B2424] dark:border-slate-900" />

                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-xs font-bold capitalize text-slate-800 dark:text-slate-200">
                              {act.action} on {act.entity}
                            </span>
                            <span className="text-[10px] text-slate-400 whitespace-nowrap">
                              {new Date(act.createdAt).toLocaleString('en-IN', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })}
                            </span>
                          </div>

                          {act.path && (
                            <p className="mt-0.5 font-mono text-[10px] text-slate-500 truncate" title={act.path}>
                              {act.path}
                            </p>
                          )}

                          {act.entityId && (
                            <p className="mt-0.5 font-mono text-[10px] text-slate-400 truncate">
                              Record: #{act.entityId.slice(-8)}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
