'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useLead } from '@/modules/leads/hooks/use-leads';
import { leadsApi } from '@/modules/leads/api';
import {
  LeadQualification,
  LocationPreference,
  LeadStatus,
  STATUS_TRANSITIONS,
  ActivityItem,
  LogCallValues,
} from '@/modules/leads/types';
import { Card, Badge, Spinner, Button, Field, Alert, Modal, TextAreaField } from '@/shared/ui';
import { LeadsSelect } from '@/modules/leads/components/leads-select';
import LogCallModal from '@/modules/leads/component/log-call-modal';
import { useAuth } from '@/shared/auth/auth-context';

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

const FOLLOW_UP_ICONS: Record<string, string> = {
  Call: '📞',
  Meeting: '🤝',
  WhatsApp: '💬',
  Email: '✉️',
  Visit: '📍',
  Other: '📝',
};

export default function LeadDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { user } = useAuth();
  const isManagerOrAdmin = ['admin', 'manager'].includes(user?.role?.toLowerCase() || '');
  const { lead, isLoading, error, mutate } = useLead(id);

  const [activeTab, setActiveTab] = useState<'info' | 'qualification' | 'activity' | 'documents'>('info');

  const [isQualifying, setIsQualifying] = useState(false);
  const [qualifyError, setQualifyError] = useState('');

  // Status transition & Lost modal state
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [lostModalOpen, setLostModalOpen] = useState(false);
  const [lostReasonInput, setLostReasonInput] = useState('');

  // Log Follow-up (ATR) Modal state
  const [logModalOpen, setLogModalOpen] = useState(false);

  // Manager Approval Box state
  const [managerRemarks, setManagerRemarks] = useState('');
  const [isApprovingManager, setIsApprovingManager] = useState(false);
  const [approvalMessage, setApprovalMessage] = useState<string | null>(null);

  // Re-assign Agent state
  const [agentsList, setAgentsList] = useState<{ _id: string; name: string; email: string; role: string }[]>([]);
  const [isReassigning, setIsReassigning] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState('');

  const openReassignModal = async () => {
    setSelectedAgentId(lead?.assignedTo?._id || '');
    try {
      const res = await leadsApi.listAgents();
      setAgentsList(res.agents || []);
    } catch {
      // ignore
    }
    setShowReassignModal(true);
  };

  const handleReassignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;
    setIsReassigning(true);
    try {
      await leadsApi.updateLead(lead._id || lead.id, {
        assignedTo: selectedAgentId || null,
      });
      setShowReassignModal(false);
      mutate();
      alert('Lead successfully re-assigned!');
    } catch (err: any) {
      alert(err.message || 'Failed to re-assign lead');
    } finally {
      setIsReassigning(false);
    }
  };

  // Activity timeline state
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  useEffect(() => {
    if (activeTab === 'activity' && id) {
      setLoadingActivities(true);
      leadsApi
        .getActivity(id)
        .then((res) => setActivities(res.activities || []))
        .catch(() => setActivities([]))
        .finally(() => setLoadingActivities(false));
    }
  }, [activeTab, id, lead?.status]);

  if (isLoading) return <div className="py-12 flex justify-center"><Spinner label="Loading lead details..." /></div>;
  if (error || !lead) return <Alert tone="error" title="Error">Failed to load lead</Alert>;

  const ALL_STATUSES: LeadStatus[] = [
    'New',
    'Contacted',
    'Interested',
    'Qualified',
    'Proposal Sent',
    'Negotiation',
    'Won',
    'Lost',
  ];

  const availableNextStatuses: LeadStatus[] = isManagerOrAdmin
    ? ALL_STATUSES.filter((s) => s !== lead.status)
    : STATUS_TRANSITIONS[lead.status] || [];

  // Calculate Lead Aging (Days since creation)
  const createdDate = new Date(lead.createdAt || lead.receivedAt || Date.now());
  const agingDays = Math.max(0, Math.floor((Date.now() - createdDate.getTime()) / (24 * 60 * 60 * 1000)));

  // Check if Next Action is overdue
  const isOverdue = lead.nextActionDate && new Date(lead.nextActionDate).getTime() < Date.now();

  const handleQualify = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsQualifying(true);
    setQualifyError('');

    const formData = new FormData(e.currentTarget);
    const data: LeadQualification = {
      city: (formData.get('city') as string) || undefined,
      locationPreference: (formData.get('locationPreference') as LocationPreference) || undefined,
      campaignDuration: (formData.get('campaignDuration') as string) || undefined,
      budget: formData.get('budget') ? Number(formData.get('budget')) : undefined,
      targetAudience: (formData.get('targetAudience') as string) || undefined,
      campaignObjective: (formData.get('campaignObjective') as string) || undefined,
      creativeRequirements: (formData.get('creativeRequirements') as string) || undefined,
      notes: (formData.get('notes') as string) || undefined,
    };

    try {
      await leadsApi.qualifyLead(lead._id || lead.id, data);
      mutate();
    } catch (err: unknown) {
      setQualifyError(err instanceof Error ? err.message : 'Failed to qualify lead');
    } finally {
      setIsQualifying(false);
    }
  };

  const executeStatusChange = async (newStatus: LeadStatus, reason?: string) => {
    setIsUpdatingStatus(true);
    setStatusError('');
    try {
      await leadsApi.changeStatus(lead._id || lead.id, {
        status: newStatus,
        lostReason: reason,
      });
      setLostModalOpen(false);
      setLostReasonInput('');
      await mutate();
    } catch (err: unknown) {
      setStatusError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleStatusSelect = (newStatus: LeadStatus) => {
    if (newStatus === 'Lost') {
      setLostModalOpen(true);
      return;
    }
    executeStatusChange(newStatus);
  };

  const submitLogFollowUp = async (payload: LogCallValues) => {
    try {
      await leadsApi.logFollowUp(lead._id || lead.id, payload);
      setLogModalOpen(false);
      await mutate();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to save action record');
    }
  };

  const handleManagerApprove = async (approved: boolean) => {
    setIsApprovingManager(true);
    setApprovalMessage(null);
    try {
      await leadsApi.managerApprove(lead._id || lead.id, {
        approved,
        remarks: managerRemarks.trim() || undefined,
      });
      setApprovalMessage(approved ? 'Lead approved successfully!' : 'Lead marked as reviewed.');
      await mutate();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to submit manager review');
    } finally {
      setIsApprovingManager(false);
    }
  };

  // Convert budget from paise to rupees for form input display
  const budgetInRupees = lead.qualification?.budget ? lead.qualification.budget / 100 : undefined;

  return (
    <div className="space-y-6 py-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {lead.companyName}
            </h1>
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                STATUS_STYLES[lead.status] ?? 'border-slate-200 bg-slate-50 text-slate-700'
              }`}
            >
              {lead.status}
            </span>
            <span className="inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-400">
              ⏱️ Lead Duration: {agingDays}d
            </span>
            {lead.nextActionDate && (
              <span
                className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                  isOverdue
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                    : 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                }`}
              >
                🕒 Next Action: {new Date(lead.nextActionDate).toLocaleDateString()}{' '}
                {isOverdue && '(Overdue)'}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {lead.contactPerson} • {lead.mobile} {lead.email ? `• ${lead.email}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-start lg:justify-end gap-2.5">
          {/* Valid Next Steps Dropdown */}
          {availableNextStatuses.length > 0 && (
            <div className="flex items-center gap-2">
              <label htmlFor="nextStatus" className="text-xs font-medium text-slate-500 whitespace-nowrap">
                Move to:
              </label>
              <select
                id="nextStatus"
                value=""
                disabled={isUpdatingStatus}
                onChange={(e) => {
                  if (e.target.value) handleStatusSelect(e.target.value as LeadStatus);
                }}
                aria-label="Next lead status transition"
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:border-red-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="" disabled>Select next status...</option>
                {availableNextStatuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Button variant="secondary" onClick={() => setLogModalOpen(true)}>
            + Log Action / ATR
          </Button>

          <Link href={`/quotations/new?leadId=${lead._id || lead.id}`}>
            <Button variant="primary" className="bg-[#8B2424] text-white hover:bg-[#6E1D1D] shadow-sm">
              + Create Quotation
            </Button>
          </Link>
        </div>
      </div>

      {statusError && (
        <Alert tone="error" title="Status Update Error">
          {statusError}
        </Alert>
      )}

      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-200 dark:border-slate-800">
        {[
          { id: 'info', label: 'Information' },
          { id: 'qualification', label: 'Requirements' },
          { id: 'activity', label: 'Activity Timeline (ATR)' },
          { id: 'documents', label: 'Documents' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as 'info' | 'qualification' | 'activity' | 'documents')}
            className={`h-11 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-red-600 text-red-600 dark:border-red-400 dark:text-red-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Information */}
      {activeTab === 'info' && (
        <div className="space-y-6">
          <Card className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-6 p-6">
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Source</h3>
              <p className="text-base text-slate-800 dark:text-slate-200">{lead.source}</p>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">City</h3>
              <p className="text-base text-slate-800 dark:text-slate-200">{lead.city || '-'}</p>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Assigned Agent</h3>
              <div className="flex items-center gap-3">
                <p className="text-base font-medium text-slate-800 dark:text-slate-200">
                  {lead.assignedTo?.name || lead.claimedBy?.name || 'Unassigned'}
                </p>
                {isManagerOrAdmin && (
                  <button
                    type="button"
                    onClick={openReassignModal}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-xs hover:border-[#8B2424] hover:bg-[#F9DADA]/40 hover:text-[#8B2424] transition-all dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-red-500"
                  >
                    <span>🔁</span> Re-assign
                  </button>
                )}
              </div>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Received At</h3>
              <p className="text-base text-slate-800 dark:text-slate-200">
                {new Date(lead.receivedAt || lead.createdAt).toLocaleString()}
              </p>
            </div>
            {lead.nextActionDate && (
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Scheduled Next Action</h3>
                <p className="text-base font-semibold text-blue-600 dark:text-blue-400">
                  {new Date(lead.nextActionDate).toLocaleString()}
                </p>
              </div>
            )}
            {lead.firstResponseAt && (
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">First Response At</h3>
                <p className="text-base text-slate-800 dark:text-slate-200">
                  {new Date(lead.firstResponseAt).toLocaleString()}
                </p>
              </div>
            )}
            {lead.qualification &&
              (lead.qualification.budget ||
                lead.qualification.campaignDuration ||
                lead.qualification.locationPreference ||
                lead.qualification.city) && (
                <div className="sm:col-span-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    Qualification Overview
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 p-4 border border-slate-200 dark:border-slate-800">
                    <div>
                      <p className="text-xs text-slate-400">Budget</p>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {lead.qualification.budget
                          ? `₹${(lead.qualification.budget / 100).toLocaleString('en-IN')}`
                          : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Duration</p>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {lead.qualification.campaignDuration || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Location Preference</p>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {lead.qualification.locationPreference || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Campaign City</p>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {lead.qualification.city || lead.city || '-'}
                      </p>
                    </div>
                    {lead.qualification.campaignObjective && (
                      <div className="sm:col-span-2">
                        <p className="text-xs text-slate-400">Objective</p>
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          {lead.qualification.campaignObjective}
                        </p>
                      </div>
                    )}
                    {lead.qualification.targetAudience && (
                      <div className="sm:col-span-2">
                        <p className="text-xs text-slate-400">Target Audience</p>
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          {lead.qualification.targetAudience}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

            {lead.qualification?.lostReason && (
              <div className="sm:col-span-2">
                <h3 className="text-xs font-semibold text-rose-500 uppercase tracking-wider mb-1">Lost Reason</h3>
                <p className="text-base text-rose-700 dark:text-rose-300 font-medium">
                  {lead.qualification.lostReason}
                </p>
              </div>
            )}
          </Card>

          {/* Manager Review & Approval Box (ATR Card Feature) */}
          <Card className="p-6 border-l-4 border-l-amber-500">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2">
              Manager Review & Approval Sign-off
            </h3>
            {approvalMessage && (
              <div className="mb-3 text-xs text-emerald-600 font-medium">{approvalMessage}</div>
            )}

            {lead.managerApproval?.approved ? (
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 p-4 border border-emerald-200 dark:border-emerald-900">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                  <span>✓ Manager Approved</span>
                </div>
                {lead.managerApproval.remarks && (
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1 italic">
                    "{lead.managerApproval.remarks}"
                  </p>
                )}
                {lead.managerApproval.approvedAt && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-500 mt-1">
                    Approved at {new Date(lead.managerApproval.approvedAt).toLocaleString()}
                  </p>
                )}
              </div>
            ) : isManagerOrAdmin ? (
              <div className="space-y-3">
                <TextAreaField
                  label="Manager Remarks & Guidance"
                  placeholder="Enter review notes, discount approvals, or strategy instructions..."
                  value={managerRemarks}
                  onChange={(e) => setManagerRemarks(e.target.value)}
                  rows={2}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="secondary"
                    isLoading={isApprovingManager}
                    onClick={() => handleManagerApprove(true)}
                  >
                    ✓ Sign-off & Approve
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">
                Awaiting review and approval from Sales Manager / Admin.
              </p>
            )}
          </Card>
        </div>
      )}

      {/* Tab: Qualification */}
      {activeTab === 'qualification' && (
        <Card className="p-6">
          {qualifyError && (
            <div className="mb-4">
              <Alert tone="error" title="Qualification Error">{qualifyError}</Alert>
            </div>
          )}

          <form onSubmit={handleQualify} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Field
                label="City"
                name="city"
                defaultValue={lead.qualification?.city || lead.city}
                placeholder="e.g. Mumbai, Delhi"
              />
              <LeadsSelect
                label="Location Preference"
                name="locationPreference"
                options={[
                  { label: 'Airport', value: 'Airport' },
                  { label: 'Highway', value: 'Highway' },
                  { label: 'Mall', value: 'Mall' },
                  { label: 'Metro', value: 'Metro' },
                  { label: 'Other', value: 'Other' },
                ]}
                defaultValue={lead.qualification?.locationPreference}
                placeholder="Select location..."
              />
              <Field
                label="Campaign Duration"
                name="campaignDuration"
                defaultValue={lead.qualification?.campaignDuration}
                placeholder="e.g. 30 days"
              />
              <Field
                label="Budget (₹ Rupees)"
                name="budget"
                type="number"
                min="0"
                step="1"
                defaultValue={budgetInRupees}
                placeholder="e.g. 500000"
              />
              <Field
                label="Target Audience"
                name="targetAudience"
                defaultValue={lead.qualification?.targetAudience}
                placeholder="e.g. Urban professionals 25-45"
              />
              <Field
                label="Campaign Objective"
                name="campaignObjective"
                defaultValue={lead.qualification?.campaignObjective}
                placeholder="e.g. Brand awareness, product launch"
              />
              <Field
                label="Creative Requirements"
                name="creativeRequirements"
                defaultValue={lead.qualification?.creativeRequirements}
                placeholder="e.g. Dynamic LED billboards, high resolution"
              />
              <Field
                label="Notes"
                name="notes"
                defaultValue={lead.qualification?.notes}
                placeholder="Any special notes or client constraints"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <Button type="submit" isLoading={isQualifying}>
                Save Qualification Data
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Tab: Activity Timeline (ATR) */}
      {activeTab === 'activity' && (
        <Card className="p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-6">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Action Taken History (ATR)</h3>
              <p className="text-xs text-slate-500">Chained follow-up logs, status transitions, and manager approvals.</p>
            </div>
            <Button variant="secondary" onClick={() => setLogModalOpen(true)}>
              + Log Action
            </Button>
          </div>

          {loadingActivities ? (
            <div className="py-8 flex justify-center">
              <Spinner label="Loading timeline..." />
            </div>
          ) : activities.length === 0 ? (
            <div className="py-8 text-center text-slate-500">
              No activity records found for this lead yet. Click "+ Log Action" to record your first follow-up.
            </div>
          ) : (
            <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-4 space-y-6 py-2">
              {activities.map((item, idx) => {
                const icon = item.followUpType ? FOLLOW_UP_ICONS[item.followUpType] || '📝' : '📌';

                return (
                  <div key={idx} className="relative pl-6">
                    {/* Timeline dot */}
                    <div
                      className={`absolute -left-2.25 top-1 h-4 w-4 rounded-full border-2 border-white dark:border-slate-900 ${
                        item.type === 'status_change'
                          ? item.to === 'Won'
                            ? 'bg-emerald-500'
                            : item.to === 'Lost'
                            ? 'bg-rose-500'
                            : 'bg-red-500'
                          : item.type === 'manager_review'
                          ? 'bg-amber-500'
                          : 'bg-blue-500'
                      }`}
                    />

                    {item.type === 'status_change' ? (
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900 dark:text-white">
                            Status changed {item.from ? `from ${item.from}` : ''} to{' '}
                            <span className="text-red-600 dark:text-red-400">{item.to}</span>
                          </span>
                        </div>
                        {item.reason && (
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 italic">
                            Reason: "{item.reason}"
                          </p>
                        )}
                        <div className="text-xs text-slate-400 mt-1">
                          {new Date(item.timestamp).toLocaleString()}
                        </div>
                      </div>
                    ) : item.type === 'manager_review' ? (
                      <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 p-3 border border-amber-200 dark:border-amber-900">
                        <div className="text-sm font-semibold text-amber-900 dark:text-amber-300">
                          🛡️ Manager Review Sign-off
                        </div>
                        {item.remarks && (
                          <p className="text-xs text-amber-800 dark:text-amber-400 mt-1">
                            Remarks: {item.remarks}
                          </p>
                        )}
                        <div className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                          {new Date(item.timestamp).toLocaleString()}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-4 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{icon}</span>
                            <span className="text-sm font-bold text-slate-900 dark:text-white">
                              {item.followUpType || 'Action'} — {item.reason || 'Follow-up'}
                            </span>
                          </div>
                          {item.nextActionDate && (
                            <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded">
                              Next: {new Date(item.nextActionDate).toLocaleString()}
                            </span>
                          )}
                        </div>

                        {(item.remarks || item.note) && (
                          <p className="text-sm text-slate-700 dark:text-slate-300 mt-2">
                            {item.remarks || item.note}
                          </p>
                        )}

                        {item.delayResponsibility && (
                          <p className="text-xs text-rose-500 mt-1">
                            Delay Responsible: {item.delayResponsibility}
                          </p>
                        )}

                        {typeof item.durationSec === 'number' && (
                          <p className="text-xs text-slate-500 mt-1">
                            Call Duration: {item.durationSec}s
                          </p>
                        )}

                        <div className="text-xs text-slate-400 mt-2">
                          Logged at {new Date(item.timestamp).toLocaleString()}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* Tab: Documents */}
      {activeTab === 'documents' && (
        <Card className="p-6">
          <div className="text-sm text-slate-500">
            Proposal documents generated from this lead appear in the Quotations & Proposals track.
          </div>
        </Card>
      )}

      {/* Lost Reason Modal */}
      <Modal
        open={lostModalOpen}
        onClose={() => setLostModalOpen(false)}
        title="Reason for marking Lead as Lost"
      >
        <div className="space-y-4 pt-2">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Please provide a specific reason why this lead was lost (e.g. Budget mismatch, Competitor won, Changed mind).
          </p>
          <Field
            label="Lost Reason"
            placeholder="Enter mandatory lost reason..."
            value={lostReasonInput}
            onChange={(e) => setLostReasonInput(e.target.value)}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setLostModalOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!lostReasonInput.trim()}
              isLoading={isUpdatingStatus}
              onClick={() => executeStatusChange('Lost', lostReasonInput.trim())}
            >
              Confirm Lost
            </Button>
          </div>
        </div>
      </Modal>

      {/* Log Follow-up / Action Modal (ATR) */}
      <LogCallModal
        open={logModalOpen}
        onClose={() => setLogModalOpen(false)}
        onSubmit={submitLogFollowUp}
      />

      {/* Re-assign Agent Modal */}
      {showReassignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">Re-assign Lead Owner</h2>
            <p className="mb-4 text-xs text-slate-500">
              Transfer this lead to another sales agent or move it to Unassigned pool.
            </p>

            <form onSubmit={handleReassignSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Select Sales Agent / User
                </label>
                <select
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white p-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                >
                  <option value="">-- Unassigned (Move to Unclaimed Pool) --</option>
                  {agentsList.map((agent) => (
                    <option key={agent._id} value={agent._id}>
                      {agent.name} ({agent.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReassignModal(false)}
                  className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isReassigning}
                  className="rounded bg-[#8B2424] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#6E1D1D] disabled:opacity-50 shadow-sm"
                >
                  {isReassigning ? 'Transferring...' : 'Confirm Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
