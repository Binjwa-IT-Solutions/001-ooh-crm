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
  LEAD_DOCUMENT_TYPES,
  type LeadDocument,
  type LeadDocumentType,
} from '@/modules/leads/types';
import { Card, Badge, Spinner, Button, Field, Alert, Modal, TextAreaField } from '@/shared/ui';
import { LeadsSelect } from '@/modules/leads/components/leads-select';
import LogCallModal from '@/modules/leads/component/log-call-modal';
import EditLeadModal from '@/modules/leads/component/edit-lead-modal';
import { useAuth } from '@/shared/auth/auth-context';
import { sessionStore } from '@/shared/auth/session-store';
import { appConfig } from '@/shared/config';
import { getCampaigns } from '@/modules/campaigns/api';
import type { Campaign } from '@/modules/campaigns/types';
import {
  Timer,
  Clock,
  RefreshCw,
  ShieldCheck,
  Check,
  CheckCircle,
  Phone,
  Users,
  MessageSquare,
  Mail,
  MapPin,
  FileText,
  Plus,
  Pencil,
  ArrowRight,
  RotateCw,
  Layers,
  Briefcase,
  User,
  Building2,
  Upload,
  Trash2,
  Download,
  ExternalLink,
  Calendar,
  Filter,
} from 'lucide-react';

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
};

const STATUS_DOT_COLORS: Record<string, string> = {
  New: 'bg-sky-500',
  Contacted: 'bg-amber-500',
  Interested: 'bg-cyan-500',
  Qualified: 'bg-purple-500',
  'Proposal Sent': 'bg-indigo-500',
  Negotiation: 'bg-orange-500',
  Won: 'bg-emerald-500',
  Lost: 'bg-rose-500',
  Duplicate: 'bg-red-500',
  duplicate: 'bg-red-500',
};

const STATUS_TEXT_COLORS: Record<string, string> = {
  New: 'text-sky-600 dark:text-sky-400',
  Contacted: 'text-amber-600 dark:text-amber-400',
  Interested: 'text-cyan-600 dark:text-cyan-400',
  Qualified: 'text-purple-600 dark:text-purple-400',
  'Proposal Sent': 'text-indigo-600 dark:text-indigo-400',
  Negotiation: 'text-orange-600 dark:text-orange-400',
  Won: 'text-emerald-600 dark:text-emerald-400',
  Lost: 'text-rose-600 dark:text-rose-400',
  Duplicate: 'text-red-600 dark:text-red-400',
  duplicate: 'text-red-600 dark:text-red-400',
};

const DOC_TYPE_BADGES: Record<string, string> = {
  'GST Certificate': 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
  'PAN Card': 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300',
  'Purchase Order (PO)': 'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950/50 dark:text-purple-300',
  'Client Agreement': 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300',
  'Creative Artwork': 'border-pink-200 bg-pink-50 text-pink-700 dark:border-pink-800 dark:bg-pink-950/50 dark:text-pink-300',
  'Brand Guidelines': 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  'Payment Proof': 'border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-800 dark:bg-teal-950/50 dark:text-teal-300',
  Other: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-300',
};

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function renderFollowUpIcon(type?: string) {
  switch (type) {
    case 'Call':
      return <Phone className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />;
    case 'Meeting':
      return <Users className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />;
    case 'WhatsApp':
      return <MessageSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />;
    case 'Email':
      return <Mail className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />;
    case 'Visit':
      return <MapPin className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />;
    case 'Other':
    default:
      return <FileText className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400 shrink-0" />;
  }
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

function formatDate(dateStr?: string | Date | null) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDuration(seconds?: number | null): string {
  if (typeof seconds !== 'number' || seconds <= 0) return '';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0 && secs > 0) return `${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m`;
  return `${secs}s`;
}

export default function LeadDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { user, hasPermission } = useAuth();
  const isManagerOrAdmin = ['admin', 'manager'].includes(user?.role?.toLowerCase() || '');
  const canManageCampaigns = Boolean(
    hasPermission?.('campaigns.manage') ||
      isManagerOrAdmin ||
      user?.role?.toLowerCase() === 'ops'
  );
  const { lead, isLoading, error, mutate } = useLead(id);

  const [activeTab, setActiveTab] = useState<'info' | 'qualification' | 'campaigns' | 'activity' | 'documents'>('info');

  const [isQualifying, setIsQualifying] = useState(false);
  const [qualifyError, setQualifyError] = useState('');
  const [qualifySuccess, setQualifySuccess] = useState('');

  // Status transition & Lost modal state
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [lostModalOpen, setLostModalOpen] = useState(false);
  const [lostReasonInput, setLostReasonInput] = useState('');

  // Log Follow-up (ATR) Modal state
  const [logModalOpen, setLogModalOpen] = useState(false);

  // Edit Lead Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

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

  // Document upload & management state
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<LeadDocumentType>('GST Certificate');
  const [docTitle, setDocTitle] = useState('');
  const [docNotes, setDocNotes] = useState('');
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [docError, setDocError] = useState('');
  const [docSuccess, setDocSuccess] = useState('');

  const handleOpenDocModal = () => {
    setDocFile(null);
    setDocType('GST Certificate');
    setDocTitle('');
    setDocNotes('');
    setDocError('');
    setDocModalOpen(true);
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;
    if (!docFile) {
      setDocError('Please select a file to upload');
      return;
    }
    if (!docTitle.trim()) {
      setDocError('Please provide a document title or label');
      return;
    }

    setIsUploadingDoc(true);
    setDocError('');
    try {
      const formData = new FormData();
      formData.append('file', docFile);
      formData.append('documentType', docType);
      formData.append('title', docTitle.trim());
      if (docNotes.trim()) {
        formData.append('notes', docNotes.trim());
      }

      await leadsApi.uploadDocument(lead._id || lead.id, formData);
      setDocSuccess('Document uploaded successfully!');
      setDocModalOpen(false);
      await mutate();
      setTimeout(() => setDocSuccess(''), 4000);
    } catch (err: any) {
      setDocError(err.message || 'Failed to upload document');
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const handleDeleteDocument = async (docId: string, title: string) => {
    if (!lead) return;
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;
    setDeletingDocId(docId);
    try {
      await leadsApi.deleteDocument(lead._id || lead.id, docId);
      await mutate();
    } catch (err: any) {
      alert(err.message || 'Failed to delete document');
    } finally {
      setDeletingDocId(null);
    }
  };

  // Linked Campaigns state
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [selectedTimelineCampaign, setSelectedTimelineCampaign] = useState<string>('all');
  const [selectedActivityType, setSelectedActivityType] = useState<'all' | 'follow_ups' | 'status' | 'quotations' | 'approvals'>('all');

  useEffect(() => {
    const leadId = (lead?._id || lead?.id || id) as string;
    if (!leadId) return;
    setLoadingCampaigns(true);
    getCampaigns({ leadId })
      .then((res) => setCampaigns(res.data || []))
      .catch(() => setCampaigns([]))
      .finally(() => setLoadingCampaigns(false));
  }, [id, lead?._id, lead?.id]);

  // Activity timeline state
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [isClaimingLead, setIsClaimingLead] = useState(false);

  const refreshActivities = async () => {
    if (!id) return;
    setLoadingActivities(true);
    try {
      const res = await leadsApi.getActivity(id);
      setActivities(res.activities || []);
    } catch {
      setActivities([]);
    } finally {
      setLoadingActivities(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'activity' && id) {
      refreshActivities();
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

  // Check if Next Action is overdue (only applicable for active, unclosed leads)
  const isClosed = lead.status === 'Won' || lead.status === 'Lost' || lead.status === 'Rejected';
  const isOverdue = !isClosed && Boolean(lead.nextActionDate && (() => {
    const d = new Date(lead.nextActionDate);
    d.setHours(23, 59, 59, 999);
    return d.getTime() < Date.now();
  })());

  const handleQualify = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsQualifying(true);
    setQualifyError('');
    setQualifySuccess('');
    setStatusError('');

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
      await mutate();
      setQualifySuccess('Requirements saved successfully! You can now move status to Qualified.');
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
      await refreshActivities();
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
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 flex-wrap">
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
            {Boolean(lead.cycle && lead.cycle > 1) && (
              <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 text-xs font-semibold text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800 shadow-2xs">
                <RotateCw className="w-3 h-3 shrink-0" />
                Repeat Client ({lead.cycle}x)
              </span>
            )}
            {lead.status === 'New' && !lead.claimedBy && !lead.assignedTo && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-950/60 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-300 border border-amber-300/80 dark:border-amber-800 shadow-2xs">
                Unclaimed Pool
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-400">
              <Timer className="w-3.5 h-3.5 shrink-0" />
              Lead: {agingDays}d
            </span>
            {lead.nextActionDate && (
              <span
                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${
                  isOverdue
                    ? 'bg-rose-50 text-rose-700 border border-rose-200/80 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-900'
                    : 'bg-blue-50 text-blue-700 border border-blue-200/80 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900'
                }`}
              >
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>Next: {formatDate(lead.nextActionDate)}</span>
                {isOverdue && (
                  <span className="ml-0.5 rounded bg-rose-200 px-1 py-0.1 text-[10px] font-bold text-rose-800 dark:bg-rose-900 dark:text-rose-200">
                    Overdue
                  </span>
                )}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {lead.contactPerson}
              {lead.designation ? ` (${lead.designation})` : ''}
            </span>
            {' • '}
            <span>{lead.mobile}</span>
            {lead.email ? ` • ${lead.email}` : ''}
          </p>
        </div>

        <div className="flex items-center justify-start lg:justify-end gap-2 shrink-0 flex-nowrap">
          {/* Claim Lead Button (When in Unclaimed Pool) */}
          {lead.status === 'New' && !lead.claimedBy && !lead.assignedTo && (
            <Button
              variant="primary"
              isLoading={isClaimingLead}
              onClick={async () => {
                setIsClaimingLead(true);
                try {
                  await leadsApi.claimLead(lead._id || lead.id);
                  await mutate();
                } catch (err: unknown) {
                  alert(err instanceof Error ? err.message : 'Failed to claim lead');
                } finally {
                  setIsClaimingLead(false);
                }
              }}
              className="!h-9 !px-3 inline-flex items-center gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs !text-xs font-semibold"
            >
              <CheckCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Claim Lead</span>
            </Button>
          )}

          {/* Re-open Lead Button (When Closed / Won / Lost) vs Normal Stage Dropdown */}
          {['Won', 'Lost'].includes(lead.status) ? (
            <Button
              variant="secondary"
              isLoading={isUpdatingStatus}
              onClick={() => executeStatusChange('Interested', 'Re-opened for new campaign inquiry')}
              className="!h-9 !px-3 inline-flex items-center gap-1.5 border border-purple-300 bg-purple-50 text-purple-800 hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-300 !text-xs font-semibold shadow-2xs"
            >
              <RotateCw className="w-3.5 h-3.5 shrink-0" />
              <span>Re-open Lead</span>
            </Button>
          ) : (
            availableNextStatuses.length > 0 && (
              <div className="h-9 flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-xs hover:border-slate-400 hover:bg-slate-50 focus-within:border-[#8B2424] focus-within:ring-1 focus-within:ring-[#8B2424] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors">
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-slate-500 whitespace-nowrap">Move to:</span>
                <select
                  id="nextStatus"
                  value=""
                  disabled={isUpdatingStatus}
                  onChange={(e) => {
                    if (e.target.value) handleStatusSelect(e.target.value as LeadStatus);
                  }}
                  aria-label="Next lead status transition"
                  className="bg-transparent font-semibold text-slate-800 dark:text-slate-100 outline-none cursor-pointer pr-1"
                >
                  <option value="" disabled className="text-slate-400">Select stage...</option>
                  {availableNextStatuses.map((s) => (
                    <option key={s} value={s} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            )
          )}

          <Button
            variant="secondary"
            onClick={() => setIsEditModalOpen(true)}
            className="!h-9 !px-3 inline-flex items-center gap-1.5 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 !text-xs font-semibold shadow-2xs"
          >
            <Pencil className="w-3.5 h-3.5 shrink-0 text-slate-500" />
            <span>Edit Lead</span>
          </Button>

          <Button
            variant="ghost"
            onClick={() => setLogModalOpen(true)}
            className="!h-9 !px-3 inline-flex items-center gap-1.5 bg-[#F9DADA] text-[#8B2424] hover:bg-[#F2CACA] !text-xs font-semibold border border-[#F2CACA]/80 shadow-2xs dark:bg-red-950/40 dark:text-red-300 dark:border-red-900"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span>Log Action</span>
            <span className="ml-0.5 rounded bg-white/70 px-1 py-0.2 text-[10px] font-bold text-[#8B2424] dark:bg-red-900/60 dark:text-red-200">
              ATR
            </span>
          </Button>

          <Link href={`/quotations/new?leadId=${lead._id || lead.id}`}>
            <Button variant="primary" className="!h-9 !px-3 inline-flex items-center gap-1.5 bg-[#8B2424] text-white hover:bg-[#6E1D1D] shadow-2xs !text-xs font-semibold">
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>Create Quotation</span>
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
          { id: 'campaigns', label: `Campaigns (${campaigns.length})` },
          { id: 'activity', label: 'Activity Timeline (ATR)' },
          { id: 'documents', label: `Documents (${lead.documents?.length || 0})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as 'info' | 'qualification' | 'campaigns' | 'activity' | 'documents')}
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
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Primary Concern Person</h3>
              <p className="text-base font-semibold text-slate-800 dark:text-slate-100">
                {lead.contactPerson}
                {lead.designation && (
                  <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ml-1.5">
                    ({lead.designation})
                  </span>
                )}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {lead.mobile} {lead.email ? `• ${lead.email}` : ''}
              </p>
            </div>

            {lead.secondaryContactPerson ? (
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Secondary Concern Person</h3>
                <p className="text-base font-semibold text-slate-800 dark:text-slate-100">
                  {lead.secondaryContactPerson}
                  {lead.secondaryDesignation && (
                    <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ml-1.5">
                      ({lead.secondaryDesignation})
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {lead.secondaryMobile || 'No Alternate Phone'}
                </p>
              </div>
            ) : (
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Source</h3>
                <p className="text-base text-slate-800 dark:text-slate-200">{lead.source}</p>
              </div>
            )}

            {lead.secondaryContactPerson && (
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Source</h3>
                <p className="text-base text-slate-800 dark:text-slate-200">{lead.source}</p>
              </div>
            )}

            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">City & Location</h3>
              <p className="text-base text-slate-800 dark:text-slate-200">
                {lead.city || '-'}
                {lead.companyLocation ? ` • ${lead.companyLocation}` : ''}
              </p>
              {lead.companyAddress && (
                <p className="text-xs text-slate-500 mt-0.5">{lead.companyAddress}</p>
              )}
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
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-xs hover:border-[#8B2424] hover:bg-[#F9DADA]/40 hover:text-[#8B2424] transition-all dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-red-500"
                  >
                    <RefreshCw className="w-3 h-3 shrink-0" />
                    <span>Re-assign</span>
                  </button>
                )}
              </div>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Received At</h3>
              <p className="text-base text-slate-800 dark:text-slate-200">
                {formatDateTime(lead.receivedAt || lead.createdAt)}
              </p>
            </div>
            {lead.nextActionDate && (
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Scheduled Next Action</h3>
                <p className="text-base font-semibold text-blue-600 dark:text-blue-400">
                  {formatDate(lead.nextActionDate)}
                </p>
              </div>
            )}
            {lead.firstResponseAt && (
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">First Response At</h3>
                <p className="text-base text-slate-800 dark:text-slate-200">
                  {formatDateTime(lead.firstResponseAt)}
                </p>
              </div>
            )}
            {lead.qualification &&
              (lead.qualification.budget ||
                lead.qualification.campaignDuration ||
                lead.qualification.locationPreference ||
                lead.qualification.city ||
                lead.qualification.notes ||
                lead.qualification.creativeRequirements) && (
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
                    {lead.qualification.creativeRequirements && (
                      <div className="col-span-2 sm:col-span-4 pt-2 border-t border-slate-200/80 dark:border-slate-800">
                        <p className="text-xs text-slate-400 font-medium">Creative Requirements</p>
                        <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5">
                          {lead.qualification.creativeRequirements}
                        </p>
                      </div>
                    )}
                    {lead.qualification.notes && (
                      <div className="col-span-2 sm:col-span-4 pt-2 border-t border-slate-200/80 dark:border-slate-800">
                        <p className="text-xs text-slate-400 mb-1 font-medium">Client Requirements & Notes</p>
                        <p className="text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 rounded-lg p-3 border border-slate-200 dark:border-slate-800 whitespace-pre-line leading-relaxed">
                          {lead.qualification.notes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

            {lead.status === 'Lost' && lead.qualification?.lostReason && (
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
                <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                  <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Manager Approved</span>
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
                    <span className="inline-flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 shrink-0" />
                      Sign-off & Approve
                    </span>
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
          {qualifySuccess && (
            <div className="mb-4">
              <Alert tone="success" title="Requirements Saved">
                {qualifySuccess}
              </Alert>
            </div>
          )}

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
              <div className="md:col-span-2">
                <TextAreaField
                  label="Client Requirements & Special Notes"
                  name="notes"
                  rows={4}
                  defaultValue={lead.qualification?.notes}
                  placeholder="Enter detailed client requirements, multi-city/area preferences, site specifications, or campaign constraints..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <Button type="submit" isLoading={isQualifying}>
                Save Qualification Data
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Tab: Linked Campaigns */}
      {activeTab === 'campaigns' && (
        <Card className="p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-6 flex-wrap gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-[#8B2424] shrink-0" />
                <span>Linked Campaigns ({campaigns.length})</span>
              </h3>
              <p className="text-xs text-slate-500">
                Independent parallel outdoor campaigns running or planned for this client.
              </p>
            </div>
            {canManageCampaigns && (
              <Link href={`/campaigns?leadId=${lead._id || lead.id}&create=true`}>
                <Button variant="primary" className="!h-9 !px-3 inline-flex items-center gap-1.5 bg-[#8B2424] text-white hover:bg-[#6E1D1D] shadow-2xs !text-xs font-semibold">
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span>Launch New Campaign</span>
                </Button>
              </Link>
            )}
          </div>

          {loadingCampaigns ? (
            <div className="py-8 flex justify-center">
              <Spinner label="Loading campaigns..." />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="py-10 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                <Briefcase className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                No campaigns launched for this lead yet.
              </p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Once a client inquiry matures, you can launch multiple parallel campaigns (e.g. City-specific launches, DOOH, or Highways).
              </p>
              {canManageCampaigns && (
                <Link href={`/campaigns?leadId=${lead._id || lead.id}&create=true`}>
                  <Button variant="secondary" className="!text-xs mt-2">
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Create First Campaign
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="pb-3 px-3">Campaign Code</th>
                    <th className="pb-3 px-3">Campaign Name</th>
                    <th className="pb-3 px-3">City</th>
                    <th className="pb-3 px-3">Dates</th>
                    <th className="pb-3 px-3">Contract Value</th>
                    <th className="pb-3 px-3">Status</th>
                    <th className="pb-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {campaigns.map((c) => {
                    const statusColors: Record<string, string> = {
                      Draft: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300',
                      Approved: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300',
                      InProgress: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300',
                      Completed: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300',
                      Cancelled: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300',
                    };

                    return (
                      <tr key={c._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="py-3 px-3 font-mono text-xs font-semibold text-slate-900 dark:text-white">
                          {c.campaignCode}
                        </td>
                        <td className="py-3 px-3 font-medium text-slate-800 dark:text-slate-200">
                          {c.name}
                        </td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                          {c.city}
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-500">
                          {formatDateTime(c.startDate)} → {formatDateTime(c.endDate)}
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white">
                          ₹{((c.contractedValue || 0) / 100).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold border ${statusColors[c.status] || 'bg-slate-100 text-slate-700'}`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <Link href={`/campaigns?search=${encodeURIComponent(c.campaignCode || c.name)}`}>
                            <Button variant="ghost" className="!h-8 !px-2.5 !text-xs text-blue-600 hover:text-blue-800">
                              View
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Tab: Activity Timeline (ATR) */}
      {activeTab === 'activity' && (() => {
        // Counts for filter pills
        const followUpsCount = activities.filter((a) => a.type === 'follow_up' || a.type === 'call_log').length;
        const statusCount = activities.filter((a) => a.type === 'status_change').length;
        const quotationCount = activities.filter((a) => a.type === 'quotation').length;
        const campaignEventCount = activities.filter((a) => a.type === 'campaign_event').length;
        const managerReviewCount = activities.filter((a) => a.type === 'manager_review').length;
        const dealsCount = quotationCount + campaignEventCount;

        const filteredActivities = activities.filter((item) => {
          if (selectedTimelineCampaign !== 'all' && item.campaignId !== selectedTimelineCampaign) {
            return false;
          }
          if (selectedActivityType === 'follow_ups') {
            return item.type === 'follow_up' || item.type === 'call_log';
          }
          if (selectedActivityType === 'status') {
            return item.type === 'status_change';
          }
          if (selectedActivityType === 'quotations') {
            return item.type === 'quotation' || item.type === 'campaign_event';
          }
          if (selectedActivityType === 'approvals') {
            return item.type === 'manager_review';
          }
          return true;
        });

        // Check for upcoming / next follow-up
        const nextActionDate = lead.nextActionDate ? new Date(lead.nextActionDate) : null;
        const isNextActionOverdue = lead.nextActionDate ? (() => {
          const d = new Date(lead.nextActionDate);
          d.setHours(23, 59, 59, 999);
          return d.getTime() < Date.now();
        })() : false;

        return (
          <Card className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-5 flex-wrap gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Action Taken History (ATR)</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    {activities.length} total
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Chronological interactions, call logs, quotations, campaigns, and manager approvals.
                </p>
              </div>
              <Button
                variant="primary"
                onClick={() => setLogModalOpen(true)}
                className="!h-9 !px-3 inline-flex items-center gap-1.5 bg-[#8B2424] text-white hover:bg-[#6E1D1D] !text-xs font-semibold shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span>Log Action</span>
              </Button>
            </div>

            {/* Pinned Next Action Banner */}
            {nextActionDate && (
              <div className={`mb-6 rounded-xl border p-4 shadow-2xs transition-colors ${
                isNextActionOverdue
                  ? 'border-rose-200 bg-rose-50/60 dark:border-rose-900/50 dark:bg-rose-950/30'
                  : 'border-blue-200 bg-blue-50/60 dark:border-blue-900/50 dark:bg-blue-950/30'
              }`}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${
                      isNextActionOverdue
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300'
                    }`}>
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-bold uppercase tracking-wider ${
                          isNextActionOverdue
                            ? 'text-rose-800 dark:text-rose-300'
                            : 'text-blue-800 dark:text-blue-300'
                        }`}>
                          Next Scheduled Follow-up
                        </span>
                        {isNextActionOverdue ? (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold bg-rose-200 text-rose-800 dark:bg-rose-900 dark:text-rose-200">
                            Overdue
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            Upcoming
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                        {formatDate(lead.nextActionDate)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => setLogModalOpen(true)}
                    className="!h-8 !px-3 !text-xs font-semibold"
                  >
                    Log Outcome
                  </Button>
                </div>
              </div>
            )}

            {/* Filter Pills (Activity Types) */}
            <div className="mb-4 flex items-center gap-2 flex-wrap text-xs">
              <span className="text-slate-400 font-medium mr-1 flex items-center gap-1">
                <Filter className="w-3 h-3" />
                <span>Filter:</span>
              </span>

              <button
                type="button"
                onClick={() => setSelectedActivityType('all')}
                className={`px-3 py-1 rounded-full font-semibold transition-all ${
                  selectedActivityType === 'all'
                    ? 'bg-[#8B2424] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                All ({activities.length})
              </button>

              <button
                type="button"
                onClick={() => setSelectedActivityType('follow_ups')}
                className={`px-3 py-1 rounded-full font-semibold transition-all flex items-center gap-1.5 ${
                  selectedActivityType === 'follow_ups'
                    ? 'bg-[#8B2424] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <Phone className="w-3 h-3" />
                <span>Calls & Notes ({followUpsCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedActivityType('status')}
                className={`px-3 py-1 rounded-full font-semibold transition-all flex items-center gap-1.5 ${
                  selectedActivityType === 'status'
                    ? 'bg-[#8B2424] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <RefreshCw className="w-3 h-3" />
                <span>Status Changes ({statusCount})</span>
              </button>

              {dealsCount > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedActivityType('quotations')}
                  className={`px-3 py-1 rounded-full font-semibold transition-all flex items-center gap-1.5 ${
                    selectedActivityType === 'quotations'
                      ? 'bg-[#8B2424] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  <FileText className="w-3 h-3" />
                  <span>Quotes & Campaigns ({dealsCount})</span>
                </button>
              )}

              {managerReviewCount > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedActivityType('approvals')}
                  className={`px-3 py-1 rounded-full font-semibold transition-all flex items-center gap-1.5 ${
                    selectedActivityType === 'approvals'
                      ? 'bg-[#8B2424] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  <ShieldCheck className="w-3 h-3" />
                  <span>Approvals ({managerReviewCount})</span>
                </button>
              )}
            </div>

            {/* Campaign Filter Pills (if any campaigns exist) */}
            {campaigns.length > 0 && (
              <div className="mb-6 flex items-center gap-2 flex-wrap text-xs pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <span className="text-slate-400 font-medium mr-1 flex items-center gap-1">
                  <Briefcase className="w-3 h-3" />
                  <span>Campaign:</span>
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedTimelineCampaign('all')}
                  className={`px-2.5 py-0.5 rounded-full font-medium transition-colors ${
                    selectedTimelineCampaign === 'all'
                      ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  All Campaigns
                </button>
                {campaigns.map((c) => {
                  const count = activities.filter((a) => a.campaignId === c._id).length;
                  return (
                    <button
                      key={c._id}
                      type="button"
                      onClick={() => setSelectedTimelineCampaign(c._id)}
                      className={`px-2.5 py-0.5 rounded-full font-medium transition-colors ${
                        selectedTimelineCampaign === c._id
                          ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {c.name} ({count})
                    </button>
                  );
                })}
              </div>
            )}

            {/* Content Area */}
            {loadingActivities ? (
              <div className="py-12 flex justify-center">
                <Spinner label="Loading timeline..." />
              </div>
            ) : filteredActivities.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <div className="w-10 h-10 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                  <Clock className="w-5 h-5" />
                </div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {activities.length === 0
                    ? 'No activity records found for this lead yet.'
                    : 'No activities match the selected filter.'}
                </p>
                <p className="text-xs text-slate-400">
                  {activities.length === 0
                    ? 'Click "+ Log Action" to record your first follow-up or client interaction.'
                    : 'Try selecting "All" or a different filter to see other events.'}
                </p>
              </div>
            ) : (
              <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-4 space-y-5 py-2">
                {filteredActivities.map((item, idx) => {
                  const isCycleRestart = Boolean(item.type === 'status_change' && item.from && ['Won', 'Lost'].includes(item.from));

                  // Extract user/author name
                  const authorName =
                    typeof item.user === 'object' && item.user?.name
                      ? item.user.name
                      : typeof item.changedBy === 'object' && item.changedBy?.name
                      ? item.changedBy.name
                      : null;

                  const durationText = formatDuration(item.durationSec);

                  return (
                    <div key={idx} className="space-y-3">
                      <div className="relative pl-6">
                        {/* Timeline dot */}
                        <div
                          className={`absolute -left-[9px] top-1.5 h-4 w-4 rounded-full border-2 border-white dark:border-slate-900 shadow-2xs ${
                            item.type === 'status_change'
                              ? (item.to ? STATUS_DOT_COLORS[item.to] || 'bg-blue-500' : 'bg-blue-500')
                              : item.type === 'manager_review'
                              ? 'bg-amber-500'
                              : item.type === 'quotation'
                              ? 'bg-indigo-500'
                              : item.type === 'campaign_event'
                              ? 'bg-emerald-500'
                              : 'bg-blue-500'
                          }`}
                        />

                        {/* 1. Status Change */}
                        {item.type === 'status_change' ? (
                          <div className="rounded-lg border border-slate-200/90 bg-white dark:bg-slate-900/60 dark:border-slate-800 p-3 shadow-2xs hover:border-slate-300 transition-colors">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-semibold text-slate-500">Stage Update:</span>
                                {item.from && item.from !== item.to ? (
                                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold">
                                    <span className={`px-2 py-0.5 rounded ${STATUS_STYLES[item.from as LeadStatus] || 'bg-slate-100 text-slate-700'}`}>
                                      {item.from}
                                    </span>
                                    <ArrowRight className="w-3 h-3 text-slate-400" />
                                    <span className={`px-2 py-0.5 rounded ${STATUS_STYLES[item.to as LeadStatus] || 'bg-slate-100 text-slate-700'}`}>
                                      {item.to}
                                    </span>
                                  </div>
                                ) : (
                                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${STATUS_STYLES[item.to as LeadStatus] || 'bg-slate-100 text-slate-700'}`}>
                                    {item.to || 'Stage Recorded'}
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                {formatDateTime(item.timestamp)}
                              </span>
                            </div>

                            {item.reason && (
                              <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 bg-slate-50 dark:bg-slate-800/50 rounded-md px-2.5 py-1.5 italic">
                                Reason: "{item.reason}"
                              </p>
                            )}

                            {authorName && (
                              <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5">
                                <span className="w-3.5 h-3.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center text-[9px] font-bold">
                                  {authorName.charAt(0).toUpperCase()}
                                </span>
                                <span>Updated by {authorName}</span>
                              </div>
                            )}
                          </div>
                        ) : item.type === 'quotation' ? (
                          /* 2. Quotation Milestone */
                          <div className="rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 p-4 border border-indigo-200/80 dark:border-indigo-900 shadow-2xs">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2.5">
                                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 shrink-0">
                                  <FileText className="w-4 h-4" />
                                </span>
                                <div>
                                  <span className="text-sm font-bold text-indigo-950 dark:text-indigo-200">
                                    {item.reason || `Quotation #${item.referenceCode}`}
                                  </span>
                                </div>
                              </div>
                              {typeof item.amount === 'number' && (
                                <span className="text-xs font-bold text-indigo-800 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900 px-2.5 py-1 rounded-md">
                                  Value: ₹{((item.amount || 0) / 100).toLocaleString('en-IN')}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-indigo-600 dark:text-indigo-400 mt-2.5 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              <span>{formatDateTime(item.timestamp)}</span>
                            </div>
                          </div>
                        ) : item.type === 'campaign_event' ? (
                          /* 3. Campaign Milestone */
                          <div className="rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 p-4 border border-emerald-200/80 dark:border-emerald-900 shadow-2xs">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2.5">
                                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 shrink-0">
                                  <Briefcase className="w-4 h-4" />
                                </span>
                                <div>
                                  <span className="text-sm font-bold text-emerald-950 dark:text-emerald-200">
                                    {item.reason || `Campaign: ${item.campaignName}`}
                                  </span>
                                </div>
                              </div>
                              {typeof item.amount === 'number' && item.amount > 0 && (
                                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900 px-2.5 py-1 rounded-md">
                                  Contract: ₹{((item.amount || 0) / 100).toLocaleString('en-IN')}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-2.5 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              <span>{formatDateTime(item.timestamp)}</span>
                            </div>
                          </div>
                        ) : item.type === 'manager_review' ? (
                          /* 4. Manager Approval */
                          <div className="rounded-xl bg-amber-50/80 dark:bg-amber-950/40 p-4 border border-amber-200/90 dark:border-amber-900 shadow-2xs">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2 text-sm font-bold text-amber-900 dark:text-amber-300">
                                <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                                <span>Manager Review Sign-off</span>
                              </div>
                              <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                                {formatDateTime(item.timestamp)}
                              </span>
                            </div>
                            {item.remarks && (
                              <p className="text-xs text-amber-800 dark:text-amber-300 mt-2 bg-amber-100/50 dark:bg-amber-900/30 rounded-md p-2 font-medium">
                                Remarks: "{item.remarks}"
                              </p>
                            )}
                            {authorName && (
                              <div className="text-[11px] text-amber-700/80 dark:text-amber-400 mt-2 flex items-center gap-1">
                                <User className="w-3 h-3" />
                                <span>Reviewed by {authorName}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          /* 5. Follow-up / Client Interaction */
                          <div className="rounded-xl border border-slate-200 bg-white dark:bg-slate-900/80 dark:border-slate-800 p-4 shadow-2xs hover:border-slate-300 transition-colors">
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0">
                                  {renderFollowUpIcon(item.followUpType)}
                                </span>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                                      {item.followUpType || 'Interaction'}
                                    </span>
                                    {item.reason && (
                                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                                        • {item.reason}
                                      </span>
                                    )}
                                    {item.campaignName && (
                                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
                                        Campaign: {item.campaignName}
                                      </span>
                                    )}
                                    {item.contactedPerson && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-[#8B2424] border border-[#F2CACA] dark:bg-red-950/60 dark:text-red-300 dark:border-red-900">
                                        <User className="w-3 h-3 shrink-0" />
                                        With: {item.contactedPerson}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {item.nextActionDate && (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 px-2.5 py-1 rounded-lg">
                                  <Clock className="w-3 h-3 shrink-0" />
                                  <span>Next: {formatDate(item.nextActionDate)}</span>
                                </span>
                              )}
                            </div>

                            {(item.remarks || item.note) && (
                              <div className="mt-3 text-sm text-slate-800 dark:text-slate-200 bg-slate-50/80 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-100 dark:border-slate-800 leading-relaxed">
                                {item.remarks || item.note}
                              </div>
                            )}

                            <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-400 flex-wrap pt-2 border-t border-slate-100 dark:border-slate-800/80">
                              <div className="flex items-center gap-3 flex-wrap">
                                {authorName && (
                                  <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                                    <span className="w-4 h-4 rounded-full bg-[#8B2424] text-white flex items-center justify-center text-[9px] font-bold">
                                      {authorName.charAt(0).toUpperCase()}
                                    </span>
                                    <span>{authorName}</span>
                                  </span>
                                )}
                                {durationText && (
                                  <span className="text-slate-500">
                                    Duration: <span className="font-semibold text-slate-700 dark:text-slate-300">{durationText}</span>
                                  </span>
                                )}
                                {item.delayResponsibility && (
                                  <span className="text-rose-600 font-medium">
                                    Delay: {item.delayResponsibility}
                                  </span>
                                )}
                              </div>
                              <span className="font-medium text-slate-400">{formatDateTime(item.timestamp)}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Cycle Restart Banner */}
                      {isCycleRestart && (
                        <div className="my-2 -ml-6 flex items-center gap-2">
                          <div className="h-px flex-1 bg-purple-200 dark:bg-purple-900" />
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-2.5 py-0.5 text-[11px] font-bold text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shadow-2xs">
                            <RotateCw className="w-3 h-3 shrink-0" />
                            <span>Cycle #{item.cycle || 2}: Re-opened Inquiry</span>
                          </span>
                          <div className="h-px flex-1 bg-purple-200 dark:bg-purple-900" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        );
      })()}

      {/* Tab: Documents */}
      {activeTab === 'documents' && (
        <div className="space-y-4">
          {docSuccess && (
            <Alert tone="success" title="Success">
              {docSuccess}
            </Alert>
          )}

          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Attached Lead Documents ({lead.documents?.length || 0})
              </h2>
              <p className="text-xs text-slate-500">
                Official documents, GST/PAN certificates, client POs, agreements, and creative assets.
              </p>
            </div>
            <Button
              variant="primary"
              onClick={handleOpenDocModal}
              className="!h-9 !px-3 inline-flex items-center gap-1.5 bg-[#8B2424] text-white hover:bg-[#6E1D1D] shadow-2xs !text-xs font-semibold"
            >
              <Upload className="w-3.5 h-3.5 shrink-0" />
              <span>Upload Document</span>
            </Button>
          </div>

          {(!lead.documents || lead.documents.length === 0) ? (
            <Card className="p-8 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">No documents attached yet</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Upload GST, PAN cards, purchase orders, client agreements, or creative artwork relevant to this lead.
              </p>
              <Button
                variant="secondary"
                onClick={handleOpenDocModal}
                className="mt-4 !h-8 !text-xs inline-flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload First Document</span>
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {lead.documents.map((doc: LeadDocument) => {
                const docId = doc._id || doc.id || '';
                const token = sessionStore.getAccessToken();
                const baseFileUrl = doc.fileUrl || (doc.fileKey ? `${appConfig.apiUrl}/api/files/${encodeURIComponent(doc.fileKey)}` : '');
                const viewUrl = baseFileUrl
                  ? `${baseFileUrl}${baseFileUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token || '')}`
                  : '';

                return (
                  <Card key={docId} className="p-4 flex flex-col justify-between space-y-3 hover:shadow-md transition-shadow">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium mb-1.5 ${
                              DOC_TYPE_BADGES[doc.documentType] || DOC_TYPE_BADGES.Other
                            }`}
                          >
                            {doc.documentType}
                          </span>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate" title={doc.title}>
                            {doc.title}
                          </h4>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {viewUrl && (
                            <a
                              href={viewUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold text-[#8B2424] bg-red-50 hover:bg-[#8B2424] hover:text-white dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-[#8B2424] dark:hover:text-white transition-all shadow-2xs"
                              title="Open & View document in new tab"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>View</span>
                            </a>
                          )}
                          <button
                            type="button"
                            disabled={deletingDocId === docId}
                            onClick={() => handleDeleteDocument(docId, doc.title)}
                            className="p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors disabled:opacity-50"
                            title="Delete document"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="text-xs text-slate-500 space-y-1">
                        <p className="truncate" title={doc.originalName}>
                          <span className="font-medium text-slate-700 dark:text-slate-300">File:</span> {doc.originalName} ({formatFileSize(doc.fileSize)})
                        </p>
                        {doc.notes && (
                          <p className="text-slate-600 dark:text-slate-300 italic bg-slate-50 dark:bg-slate-800/60 p-2 rounded text-[11px]">
                            "{doc.notes}"
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                      <span>
                        Uploaded by {doc.uploadedBy?.name || 'User'}
                      </span>
                      <span>{formatDateTime(doc.uploadedAt)}</span>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
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
        campaigns={campaigns.map((c) => ({ id: c._id, name: c.name, campaignCode: c.campaignCode }))}
        contacts={[
          {
            name: lead.contactPerson,
            role: 'Primary Contact',
            designation: lead.designation,
            phone: lead.mobile,
          },
          ...(lead.secondaryContactPerson
            ? [
                {
                  name: lead.secondaryContactPerson,
                  role: 'Secondary Contact',
                  designation: lead.secondaryDesignation,
                  phone: lead.secondaryMobile,
                },
              ]
            : []),
        ]}
        leadDefaults={{
          budget: lead.qualification?.budget,
          companyAddress: lead.companyAddress,
          companyLocation: lead.companyLocation,
          email: lead.email,
          secondaryContactPerson: lead.secondaryContactPerson,
          secondaryDesignation: lead.secondaryDesignation,
          secondaryMobile: lead.secondaryMobile,
        }}
      />

      {/* Edit Lead Modal */}
      <EditLeadModal
        isOpen={isEditModalOpen}
        lead={lead}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={async () => {
          await mutate();
        }}
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
                  {agentsList
                    .filter((agent) =>
                      ['sales_agent', 'manager', 'admin'].includes(agent.role.toLowerCase()),
                    )
                    .map((agent) => {
                      const roleLabel =
                        agent.role.toLowerCase() === 'sales_agent'
                          ? 'Sales Agent'
                          : agent.role.toLowerCase() === 'manager'
                          ? 'Manager'
                          : 'Admin';
                      return (
                        <option key={agent._id} value={agent._id}>
                          {agent.name} ({roleLabel})
                        </option>
                      );
                    })}
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

      {/* Upload Document Modal */}
      <Modal
        open={docModalOpen}
        onClose={() => {
          if (!isUploadingDoc) setDocModalOpen(false);
        }}
        title="Upload Lead Document"
      >
        <form onSubmit={handleUploadDocument} className="space-y-4 pt-2">
          {docError && (
            <Alert tone="error" title="Upload Failed">
              {docError}
            </Alert>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Select File <span className="text-rose-500">*</span>
            </label>
            <input
              type="file"
              required
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setDocFile(file);
                if (file && !docTitle) {
                  const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
                  setDocTitle(nameWithoutExt);
                }
              }}
              className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 dark:file:bg-slate-800 dark:file:text-slate-200 cursor-pointer border border-slate-300 dark:border-slate-700 rounded-md p-1.5"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Document Type <span className="text-rose-500">*</span>
            </label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as LeadDocumentType)}
              className="w-full rounded-md border border-slate-300 bg-white p-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            >
              {LEAD_DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <Field
            label="Document Title / Label *"
            placeholder="e.g. GST Registration Certificate, Signed PO #402"
            value={docTitle}
            onChange={(e) => setDocTitle(e.target.value)}
            required
          />

          <TextAreaField
            label="Notes / Comments (Optional)"
            placeholder="e.g. Valid until Dec 2026, approved by legal team..."
            value={docNotes}
            onChange={(e) => setDocNotes(e.target.value)}
            rows={2}
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="secondary"
              disabled={isUploadingDoc}
              onClick={() => setDocModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isUploadingDoc}
              className="bg-[#8B2424] text-white hover:bg-[#6E1D1D]"
            >
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              Upload Document
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
