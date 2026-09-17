'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/shared/auth/auth-context';
import { useLeads } from '@/modules/leads/hooks/use-leads';
import { leadsApi } from '@/modules/leads/api';
import { LeadStatus, LeadSource, Lead, LogCallValues } from '@/modules/leads/types';
import { Card, Button, Badge, Spinner, Field, SelectField, Alert, Modal, TextAreaField } from '@/shared/ui';
import LogCallModal from '@/modules/leads/component/log-call-modal';
import { Timer, CheckCircle2, AlertCircle, Building2, Phone, Mail, MapPin, Info, Clock, ArrowUpDown } from 'lucide-react';

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
  duplicate: 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300',
  Rejected: 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        STATUS_STYLES[status] ?? 'border-red-200 bg-red-50 text-red-700'
      }`}
    >
      {status}
    </span>
  );
}

function formatDateTime(dateStr?: string | Date | null) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

let toastIdCounter = 0;

function getOverdueDetails(dateStr?: string | Date | null, now?: number) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const currentMs = now ?? Date.now();
  const diffMs = currentMs - d.getTime();
  if (diffMs <= 0) return null;
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d overdue`;
  if (hours > 0) return `${hours}h overdue`;
  const mins = Math.max(1, Math.floor(diffMs / (1000 * 60)));
  return `${mins}m overdue`;
}

function SlaCountdown({ end }: { end?: string | null }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!end) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [end]);

  if (!end) return null;
  const endMs = new Date(end).getTime();
  const diff = endMs - now;
  if (diff <= 0) {
    return (
      <span className="ml-2 inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
        SLA Breach
      </span>
    );
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  if (hours > 0) {
    return (
      <span className="ml-2 inline-flex items-center text-xs font-medium text-[#8B2424] dark:text-red-400">
        <Timer className="w-3.5 h-3.5 inline mr-1 shrink-0" />
        {hours}h {minutes}m
      </span>
    );
  }

  return (
    <span className="ml-2 inline-flex items-center text-xs font-medium text-[#8B2424] dark:text-red-400">
      <Timer className="w-3.5 h-3.5 inline mr-1 shrink-0" />
      {minutes}m {String(seconds).padStart(2, '0')}s
    </span>
  );
}

export default function LeadsPage() {
  const { user } = useAuth();
  const isManagerOrAdmin = ['admin', 'manager'].includes(user?.role?.toLowerCase() || '');
  const [activeTab, setActiveTab] = useState<'my-leads' | 'unclaimed' | 'all' | 'rejected'>('my-leads');

  // Filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<LeadStatus | ''>('');
  const [city, setCity] = useState('');
  const [source, setSource] = useState<LeadSource | ''>('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'nextActionDate' | 'createdAt' | ''>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);

  const [claimedIds, setClaimedIds] = useState<string[]>([]);
  const [toastList, setToastList] = useState<Array<{ id: number; message: string; type?: 'success' | 'error' }>>([]);

  const [logModalOpen, setLogModalOpen] = useState(false);
  const [logTargetId, setLogTargetId] = useState<string | null>(null);

  // Reject Modal State
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('Spam / Bot / Fake Number');
  const [rejectCustomNote, setRejectCustomNote] = useState<string>('');
  const [isRejecting, setIsRejecting] = useState(false);

  // Claim Review Modal State
  const [claimReviewLead, setClaimReviewLead] = useState<Lead | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);

  const filters = {
    search,
    status: activeTab === 'rejected' ? ('Rejected' as LeadStatus) : status,
    city,
    source,
    page,
    limit: 25,
    ...(activeTab === 'unclaimed' ? { unassigned: true } : {}),
    ...(activeTab === 'my-leads' ? { assignedToMe: true } : {}),
    ...(overdueOnly && activeTab !== 'unclaimed' && activeTab !== 'rejected' ? { overdueOnly: true } : {}),
    ...(sortBy ? { sortBy, sortDir } : {}),
  };

  const pollInterval = activeTab === 'unclaimed' ? 15000 : undefined;

  const { data, isLoading, error, mutate } = useLeads(filters, pollInterval);

  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    const id = ++toastIdCounter;
    setToastList((t) => [...t, { id, message, type }]);
    setTimeout(() => setToastList((t) => t.filter((x) => x.id !== id)), 4500);
  }

  const handleClaim = async (leadId: string) => {
    setClaimedIds((s) => Array.from(new Set([...s, leadId])));
    try {
      await leadsApi.claimLead(leadId);
      showToast('Lead claimed', 'success');
      await mutate();
    } catch (err: unknown) {
      setClaimedIds((s) => s.filter((id) => id !== leadId));
      try {
        const current = await leadsApi.getLead(leadId);
        const claimer = (current as any).assignedTo?.name || (current as any).claimedBy?.name;
        showToast(claimer ? `Already claimed by ${claimer}` : 'Conflict: Another agent claimed this lead', 'error');
      } catch {
        showToast('Conflict: Another agent has already claimed this lead.', 'error');
      }
      await mutate();
    }
  };

  const openLogModal = (leadId: string) => {
    setLogTargetId(leadId);
    setLogModalOpen(true);
  };

  const submitLogFollowUp = async (payload: LogCallValues) => {
    if (!logTargetId) return;
    try {
      await leadsApi.logFollowUp(logTargetId, payload);
      showToast('Action record saved', 'success');
      await mutate();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to save action', 'error');
    }
  };

  const openRejectModal = (leadId: string) => {
    setRejectTargetId(leadId);
    setRejectReason('Spam / Bot / Fake Number');
    setRejectCustomNote('');
    setRejectModalOpen(true);
  };

  const handleConfirmReject = async () => {
    if (!rejectTargetId) return;
    setIsRejecting(true);
    try {
      const finalReason = rejectReason === 'Other' && rejectCustomNote.trim()
        ? `Other: ${rejectCustomNote.trim()}`
        : rejectReason;
      await leadsApi.changeStatus(rejectTargetId, { status: 'Rejected', lostReason: finalReason });
      showToast('Lead marked as Rejected and moved to Rejected tab', 'success');
      setRejectModalOpen(false);
      await mutate();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to reject lead', 'error');
    } finally {
      setIsRejecting(false);
    }
  };

  const handleRestore = async (leadId: string) => {
    try {
      await leadsApi.changeStatus(leadId, { status: 'New' });
      showToast('Lead restored to Unclaimed pool', 'success');
      await mutate();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to restore lead', 'error');
    }
  };

  const displayedLeads = (data?.data ?? []).filter((l) => !claimedIds.includes(l._id || l.id));

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Leads</h1>
        <Link href="/leads/new">
          <Button>Add Lead</Button>
        </Link>
      </div>

      <div className="flex gap-4 border-b border-border-subtle">
        <button
          onClick={() => { setActiveTab('my-leads'); setPage(1); }}
          className={`h-11 px-4 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'my-leads'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          My Leads
        </button>
        <button
          onClick={() => { setActiveTab('unclaimed'); setPage(1); }}
          className={`h-11 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'unclaimed'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          Unclaimed
          <Badge>Live</Badge>
        </button>
        {isManagerOrAdmin && (
          <button
            onClick={() => { setActiveTab('all'); setPage(1); }}
            className={`h-11 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'all'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            All Leads (Team)
          </button>
        )}
        <button
          onClick={() => { setActiveTab('rejected'); setPage(1); }}
          className={`h-11 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'rejected'
              ? 'border-primary text-primary dark:border-rose-400 dark:text-rose-400 font-semibold'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          Rejected Leads
        </button>
      </div>

      <Card className="grid grid-cols-1 gap-8 p-6 md:grid-cols-2 xl:grid-cols-4">
        <Field
          label="Search"
          placeholder="Company or Mobile"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <SelectField
          label="Status"
          options={[
            { label: 'New', value: 'New' },
            { label: 'Contacted', value: 'Contacted' },
            { label: 'Interested', value: 'Interested' },
            { label: 'Qualified', value: 'Qualified' },
            { label: 'Proposal Sent', value: 'Proposal Sent' },
            { label: 'Negotiation', value: 'Negotiation' },
            { label: 'Won', value: 'Won' },
            { label: 'Lost', value: 'Lost' },
          ]}
          value={status}
          onChange={(e) => { setStatus(e.target.value as LeadStatus); setPage(1); }}
          placeholder="All Statuses"
        />
        <SelectField
          label="Source"
          options={[
            { label: 'JustDial', value: 'JustDial' },
            { label: 'Website', value: 'Website' },
            { label: 'WhatsApp', value: 'WhatsApp' },
            { label: 'Facebook', value: 'Facebook' },
            { label: 'Instagram', value: 'Instagram' },
            { label: 'Email', value: 'Email' },
            { label: 'Referral', value: 'Referral' },
            { label: 'Manual', value: 'Manual' },
          ]}
          value={source}
          onChange={(e) => { setSource(e.target.value as LeadSource); setPage(1); }}
          placeholder="All Sources"
        />
        <Field
          label="City"
          placeholder="Any City"
          value={city}
          onChange={(e) => { setCity(e.target.value); setPage(1); }}
        />
      </Card>

      {activeTab !== 'unclaimed' && activeTab !== 'rejected' && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                const nextVal = !overdueOnly;
                setOverdueOnly(nextVal);
                if (nextVal) {
                  setSortBy('nextActionDate');
                  setSortDir('asc');
                } else {
                  setSortBy('');
                }
                setPage(1);
              }}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition border shadow-xs ${
                overdueOnly
                  ? 'bg-rose-50 border-rose-300 text-rose-700 dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-300 ring-2 ring-rose-500/20 font-bold'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <AlertCircle className={`w-3.5 h-3.5 ${overdueOnly ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`} />
              <span>Missed Actions / Overdue Follow-ups</span>
              {overdueOnly && (
                <span className="text-[10px] bg-rose-200 text-rose-800 dark:bg-rose-900 dark:text-rose-200 rounded px-1.5 py-0.5 font-extrabold uppercase tracking-wide">
                  Active
                </span>
              )}
            </button>

            {sortBy === 'nextActionDate' && (
              <button
                type="button"
                onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                title="Click to toggle sort direction"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300 shadow-xs transition"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-[#8B2424] dark:text-red-400" />
                <span>Sort: {sortDir === 'asc' ? 'Closest / Overdue First (Urgent)' : 'Furthest Next Action First'}</span>
              </button>
            )}
          </div>

          {(overdueOnly || sortBy || search || status || city || source) && (
            <button
              type="button"
              onClick={() => {
                setOverdueOnly(false);
                setSortBy('');
                setSortDir('asc');
                setSearch('');
                setStatus('');
                setCity('');
                setSource('');
                setPage(1);
              }}
              className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline font-medium"
            >
              Reset All Filters
            </button>
          )}
        </div>
      )}

      {error ? (
        <Alert tone="error" title="Error Loading Leads">
          {error.message}
        </Alert>
      ) : isLoading && !data ? (
        <div className="py-12 flex justify-center"><Spinner label="Loading leads..." /></div>
      ) : data?.data.length === 0 ? (
        <div className="py-12 text-center text-slate-500">No leads found.</div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Company</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th
                    className={`px-4 py-3 font-medium ${
                      activeTab !== 'unclaimed' && activeTab !== 'rejected'
                        ? 'cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-200'
                        : ''
                    }`}
                    onClick={() => {
                      if (activeTab === 'unclaimed' || activeTab === 'rejected') return;
                      if (sortBy === 'nextActionDate') {
                        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                      } else {
                        setSortBy('nextActionDate');
                        setSortDir('asc');
                      }
                      setPage(1);
                    }}
                    title={activeTab !== 'unclaimed' && activeTab !== 'rejected' ? 'Click to sort by Next Action Date' : undefined}
                  >
                    <div className="inline-flex items-center gap-1.5">
                      <span>{activeTab === 'unclaimed' ? 'Received' : activeTab === 'rejected' ? 'Rejection Reason' : 'Next Action'}</span>
                      {activeTab !== 'unclaimed' && activeTab !== 'rejected' && (
                        <ArrowUpDown
                          className={`w-3.5 h-3.5 ${
                            sortBy === 'nextActionDate'
                              ? 'text-[#8B2424] dark:text-red-400 font-bold'
                              : 'text-slate-400 opacity-60'
                          }`}
                        />
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-4 py-3 font-medium">Agent</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {displayedLeads.map((lead: Lead) => {
                  const isOverdue = Boolean(lead.nextActionDate && new Date(lead.nextActionDate).getTime() < currentTime);

                  return (
                    <tr key={lead._id || lead.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 font-medium text-slate-900 dark:text-white">
                          <Link href={`/leads/${lead._id || lead.id}`} className="hover:underline">
                            {lead.companyName}
                          </Link>
                          {Boolean(lead.cycle && lead.cycle > 1) && (
                            <span
                              title={`Repeat Client (Cycle ${lead.cycle})`}
                              className="inline-flex items-center rounded px-1 py-0.2 text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800 shrink-0"
                            >
                              {lead.cycle}x
                            </span>
                          )}
                        </div>
                        <div className="text-xs">{lead.city}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div>{lead.contactPerson}</div>
                        <div className="text-xs">{lead.mobile}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <StatusBadge status={lead.status} />
                          {activeTab !== 'unclaimed' && activeTab !== 'rejected' && ((lead.status === 'New' || lead.status === 'Contacted') && !lead.firstResponseAt && !lead.firstCallAt) && (
                            <SlaCountdown end={lead.slaTimerEnd || (lead.createdAt ? new Date(new Date(lead.createdAt).getTime() + 24 * 60 * 60 * 1000).toISOString() : null)} />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {activeTab === 'unclaimed' ? (
                          <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                            {formatDateTime(lead.createdAt || lead.receivedAt)}
                          </span>
                        ) : activeTab === 'rejected' ? (
                          <span className="text-xs text-rose-600 dark:text-rose-400 font-medium italic">
                            {lead.qualification?.lostReason || (lead.statusHistory && lead.statusHistory.length > 0 ? lead.statusHistory[lead.statusHistory.length - 1]?.reason : undefined) || 'Junk / Irrelevant'}
                          </span>
                        ) : lead.nextActionDate ? (
                          (() => {
                            const overdueText = isOverdue ? getOverdueDetails(lead.nextActionDate, currentTime) : null;
                            return (
                              <div className="flex flex-col gap-0.5 items-start">
                                <span
                                  className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${
                                    isOverdue
                                      ? 'bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900 font-semibold'
                                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                  }`}
                                >
                                  {isOverdue && <AlertCircle className="w-3 h-3 text-rose-600 dark:text-rose-400 shrink-0" />}
                                  {formatDateTime(lead.nextActionDate)}
                                </span>
                                {overdueText && (
                                  <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 ml-0.5">
                                    {overdueText}
                                  </span>
                                )}
                              </div>
                            );
                          })()
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">{lead.source}</td>
                      <td className="px-4 py-3">{lead.assignedTo?.name || lead.claimedBy?.name || 'Unassigned'}</td>
                      <td className="px-4 py-3">
                        {activeTab === 'unclaimed' ? (
                          <div className="flex items-center gap-2">
                            <Button variant="secondary" onClick={() => setClaimReviewLead(lead)}>
                              Claim
                            </Button>
                            <Button
                              variant="ghost"
                              className="bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900"
                              onClick={() => openRejectModal(lead._id || lead.id)}
                            >
                              Reject
                            </Button>
                          </div>
                        ) : activeTab === 'rejected' ? (
                          <div className="flex items-center gap-2">
                            <Link href={`/leads/${lead._id || lead.id}`}>
                              <Button
                                variant="ghost"
                                className="bg-blue-50 text-blue-700 border border-blue-200/60 hover:bg-blue-100 hover:text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 dark:hover:bg-blue-900/50"
                              >
                                View
                              </Button>
                            </Link>
                            <Button
                              variant="secondary"
                              className="text-xs"
                              onClick={() => handleRestore(lead._id || lead.id)}
                            >
                              Restore
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Link href={`/leads/${lead._id || lead.id}`}>
                              <Button
                                variant="ghost"
                                className="bg-blue-50 text-blue-700 border border-blue-200/60 hover:bg-blue-100 hover:text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 dark:hover:bg-blue-900/50"
                              >
                                View
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              className="bg-[#F9DADA] text-primary hover:bg-[#F2CACA]"
                              onClick={() => openLogModal(lead._id || lead.id)}
                            >
                              Log Action
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data && data.meta.total > data.meta.limit && (
            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 dark:border-slate-800">
              <div className="text-sm text-slate-500">
                Showing {((page - 1) * data.meta.limit) + 1} to {Math.min(page * data.meta.limit, data.meta.total)} of {data.meta.total} results
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="secondary" 
                  disabled={page === 1} 
                  onClick={() => setPage(p => p - 1)}
                >
                  Previous
                </Button>
                <Button 
                  variant="secondary" 
                  disabled={page * data.meta.limit >= data.meta.total} 
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Log Action Modal */}
      <LogCallModal
        open={logModalOpen}
        onClose={() => setLogModalOpen(false)}
        onSubmit={submitLogFollowUp}
        contacts={
          (() => {
            const targetLead = data?.data?.find((l) => (l._id || l.id) === logTargetId);
            if (!targetLead) return [];
            return [
              {
                name: targetLead.contactPerson,
                role: 'Primary Contact',
                designation: targetLead.designation,
                phone: targetLead.mobile,
              },
              ...(targetLead.secondaryContactPerson
                ? [
                    {
                      name: targetLead.secondaryContactPerson,
                      role: 'Secondary Contact',
                      designation: targetLead.secondaryDesignation,
                      phone: targetLead.secondaryMobile,
                    },
                  ]
                : []),
            ];
          })()
        }
        leadDefaults={
          (() => {
            const targetLead = data?.data?.find((l) => (l._id || l.id) === logTargetId);
            if (!targetLead) return undefined;
            return {
              budget: targetLead.qualification?.budget,
              companyAddress: targetLead.companyAddress,
              companyLocation: targetLead.companyLocation,
              email: targetLead.email,
              secondaryContactPerson: targetLead.secondaryContactPerson,
              secondaryDesignation: targetLead.secondaryDesignation,
              secondaryMobile: targetLead.secondaryMobile,
            };
          })()
        }
      />

      {/* Reject Lead Modal */}
      <Modal
        open={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Reject Lead / Mark as Junk"
      >
        <div className="space-y-4 pt-2">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            This inquiry will be removed from the active Unclaimed pool and moved to the <strong>Rejected Leads</strong> tab.
          </p>

          <SelectField
            label="Rejection Reason *"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            options={[
              { value: 'Spam / Bot / Fake Number', label: 'Spam / Bot / Fake Number' },
              { value: 'Job / Career Inquiry', label: 'Job / Career Inquiry (Looking for job/resumé)' },
              { value: 'Irrelevant Service (Not OOH / Billboard)', label: 'Irrelevant Service (e.g. Visiting card/pamphlet printing)' },
              { value: 'Budget Too Low / Student Inquiry', label: 'Budget Too Low / Student Inquiry' },
              { value: 'Duplicate / Accidental Submission', label: 'Duplicate / Accidental Submission' },
              { value: 'Other', label: 'Other (Specify reason below)' },
            ]}
          />

          {rejectReason === 'Other' && (
            <TextAreaField
              label="Specify Reason"
              placeholder="Describe why this lead is being rejected..."
              value={rejectCustomNote}
              onChange={(e) => setRejectCustomNote(e.target.value)}
              rows={2}
            />
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button variant="secondary" onClick={() => setRejectModalOpen(false)}>
              Cancel
            </Button>
            <Button
              isLoading={isRejecting}
              className="bg-rose-600 hover:bg-rose-700 text-white"
              onClick={handleConfirmReject}
            >
              Confirm Reject
            </Button>
          </div>
        </div>
      </Modal>

      {/* Review & Confirm Claim Lead Modal */}
      <Modal
        open={Boolean(claimReviewLead)}
        onClose={() => setClaimReviewLead(null)}
        title="Review Lead Before Claiming"
      >
        {claimReviewLead && (
          <div className="space-y-4 pt-2">
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 p-3 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
              <Clock className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <span>
                <strong>SLA Notice:</strong> Claiming this lead assigns ownership to you and activates your <strong>24-Hour First Response SLA</strong> timer.
              </span>
            </div>

            {/* Profile Overview */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 bg-slate-50/50 dark:bg-slate-900/40">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white">
                    {claimReviewLead.companyName}
                  </h4>
                  <p className="text-xs text-slate-500">Contact: {claimReviewLead.contactPerson}</p>
                </div>
                <span className="inline-flex items-center rounded-full border border-slate-300 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300">
                  {claimReviewLead.source}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-semibold">{claimReviewLead.mobile || 'No Mobile'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{claimReviewLead.email || <span className="text-amber-600 italic">Email not provided</span>}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{claimReviewLead.city || <span className="text-amber-600 italic">City not specified</span>}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>Budget: {claimReviewLead.qualification?.budget ? `₹${(claimReviewLead.qualification.budget / 100).toLocaleString('en-IN')}` : <span className="text-slate-400 italic">Unspecified</span>}</span>
                </div>
              </div>
            </div>

            {/* Inbound Query Message */}
            {Boolean(claimReviewLead.qualification?.notes || (claimReviewLead.rawPayload as Record<string, string> | undefined)?.comments || (claimReviewLead.rawPayload as Record<string, string> | undefined)?.text || (claimReviewLead.rawPayload as Record<string, string> | undefined)?.message) && (
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 bg-white dark:bg-slate-900 text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Inbound Query / Message:</span>
                <p className="text-slate-600 dark:text-slate-400 italic whitespace-pre-line">
                  &ldquo;{String(claimReviewLead.qualification?.notes || (claimReviewLead.rawPayload as Record<string, string> | undefined)?.comments || (claimReviewLead.rawPayload as Record<string, string> | undefined)?.text || (claimReviewLead.rawPayload as Record<string, string> | undefined)?.message || '')}&rdquo;
                </p>
              </div>
            )}

            {/* Information Checklist */}
            <div className="text-xs space-y-1.5 bg-slate-100 dark:bg-slate-800/60 p-3 rounded-lg">
              <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Information Checklist:</span>
              <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Mobile number available ({claimReviewLead.mobile})</span>
              </div>
              {claimReviewLead.city ? (
                <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>City identified: {claimReviewLead.city}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>City not mentioned in initial inquiry</span>
                </div>
              )}
              {claimReviewLead.email ? (
                <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Email provided: {claimReviewLead.email}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  <span>Email not provided (collect during first call)</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800 flex-wrap gap-2">
              <Button
                variant="ghost"
                className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs"
                onClick={() => {
                  const targetId = claimReviewLead._id || claimReviewLead.id;
                  setClaimReviewLead(null);
                  openRejectModal(targetId);
                }}
              >
                Reject as Junk / Spam
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => setClaimReviewLead(null)}>
                  Cancel
                </Button>
                <Button
                  isLoading={isClaiming}
                  className="bg-[#8B2424] hover:bg-[#6E1D1D] text-white text-xs font-semibold"
                  onClick={async () => {
                    const targetId = claimReviewLead._id || claimReviewLead.id;
                    setIsClaiming(true);
                    try {
                      await handleClaim(targetId);
                      setClaimReviewLead(null);
                    } finally {
                      setIsClaiming(false);
                    }
                  }}
                >
                  Confirm & Claim Lead
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Toasts */}
      <div className="fixed right-6 bottom-6 flex flex-col gap-2">
        {toastList.map((t) => (
          <div key={t.id} className={`rounded px-3 py-2 text-sm ${t.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
