'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/shared/auth/auth-context';
import { useLeads } from '@/modules/leads/hooks/use-leads';
import { leadsApi } from '@/modules/leads/api';
import { LeadStatus, LeadSource, Lead, LogCallValues } from '@/modules/leads/types';
import { Card, Button, Badge, Spinner, Field, SelectField, Alert } from '@/shared/ui';
import LogCallModal from '@/modules/leads/component/log-call-modal';

const STATUS_STYLES: Record<string, string> = {
  New: 'border-sky-200 bg-sky-50 text-sky-700',
  Contacted: 'border-amber-200 bg-amber-50 text-amber-700',
  Interested: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  Qualified: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  'Proposal Sent': 'border-indigo-200 bg-indigo-50 text-indigo-700',
  Negotiation: 'border-orange-200 bg-orange-50 text-orange-700',
  Won: 'border-green-200 bg-green-50 text-green-700',
  Lost: 'border-rose-200 bg-rose-50 text-rose-700',
  Duplicate: 'border-red-200 bg-red-50 text-red-700',
  duplicate: 'border-red-200 bg-red-50 text-red-700',
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

function SlaCountdown({ end }: { end?: string | null }) {
  const [now, setNow] = useState(Date.now());

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
        ⏱️ {hours}h {minutes}m
      </span>
    );
  }

  return (
    <span className="ml-2 inline-flex items-center text-xs font-medium text-[#8B2424] dark:text-red-400">
      ⏱️ {minutes}m {String(seconds).padStart(2, '0')}s
    </span>
  );
}

export default function LeadsPage() {
  const { user } = useAuth();
  const isManagerOrAdmin = ['admin', 'manager'].includes(user?.role?.toLowerCase() || '');
  const [activeTab, setActiveTab] = useState<'my-leads' | 'unclaimed' | 'all'>('my-leads');

  // Filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<LeadStatus | ''>('');
  const [city, setCity] = useState('');
  const [source, setSource] = useState<LeadSource | ''>('');
  const [page, setPage] = useState(1);

  const [claimedIds, setClaimedIds] = useState<string[]>([]);
  const [toastList, setToastList] = useState<Array<{ id: number; message: string; type?: 'success' | 'error' }>>([]);

  const [logModalOpen, setLogModalOpen] = useState(false);
  const [logTargetId, setLogTargetId] = useState<string | null>(null);

  const filters = {
    search,
    status,
    city,
    source,
    page,
    limit: 25,
    ...(activeTab === 'unclaimed' ? { unassigned: true } : {}),
    ...(activeTab === 'my-leads' ? { assignedToMe: true } : {}),
  };

  const pollInterval = activeTab === 'unclaimed' ? 15000 : undefined;

  const { data, isLoading, error, mutate } = useLeads(filters, pollInterval);

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    const id = Date.now() + Math.floor(Math.random() * 1000);
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

  const displayedLeads = (data?.data ?? []).filter((l) => !claimedIds.includes(l._id || l.id));

  return (
    <div className="space-y-6 py-8">
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
                  <th className="px-4 py-3 font-medium">Next Action</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-4 py-3 font-medium">Agent</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {displayedLeads.map((lead: Lead) => {
                  const isOverdue = lead.nextActionDate && new Date(lead.nextActionDate).getTime() < Date.now();

                  return (
                    <tr key={lead._id || lead.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900 dark:text-white">
                          <Link href={`/leads/${lead._id || lead.id}`} className="hover:underline">
                            {lead.companyName}
                          </Link>
                        </div>
                        <div className="text-xs">{lead.city}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div>{lead.contactPerson}</div>
                        <div className="text-xs">{lead.mobile}</div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={lead.status} />
                        {((lead.status === 'New' || lead.status === 'Contacted') && !lead.firstResponseAt && !lead.firstCallAt) && (
                          <SlaCountdown end={lead.slaTimerEnd || (lead.createdAt ? new Date(new Date(lead.createdAt).getTime() + 24 * 60 * 60 * 1000).toISOString() : null)} />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {lead.nextActionDate ? (
                          <span
                            className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                              isOverdue
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {new Date(lead.nextActionDate).toLocaleDateString()}
                            {isOverdue && ' (Overdue)'}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">{lead.source}</td>
                      <td className="px-4 py-3">{lead.assignedTo?.name || lead.claimedBy?.name || 'Unassigned'}</td>
                      <td className="px-4 py-3">
                        {activeTab === 'unclaimed' ? (
                          <div className="flex items-center gap-2">
                            <Button variant="secondary" onClick={() => handleClaim(lead._id || lead.id)}>
                              Claim
                            </Button>
                            <Button
                              variant="ghost"
                              className="bg-[#F9DADA] text-primary hover:bg-[#F2CACA]"
                              onClick={() => openLogModal(lead._id || lead.id)}
                            >
                              Log Action
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Link href={`/leads/${lead._id || lead.id}`}>
                              <Button variant="ghost">View</Button>
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
      <LogCallModal open={logModalOpen} onClose={() => setLogModalOpen(false)} onSubmit={submitLogFollowUp} />

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
