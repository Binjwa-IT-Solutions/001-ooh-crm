'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  Download,
  Calendar,
  Phone,
  Mail,
  User,
  Briefcase,
  FileText,
  Pencil,
  Check,
  X,
  Upload,
  AlertCircle,
  Clock,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Layers,
} from 'lucide-react';
import { Button, Card, cx, Dropdown } from '@/shared/ui';
import { useAuth } from '@/shared/auth/auth-context';
import { usePageSubTitle } from '@/shared/layout/page-header-context';
import { candidatesApi } from '@/modules/hr/api';
import { api } from '@/shared/api/client';
import type { Candidate, CandidateStatus, InterviewRound } from '@/modules/hr/types';

function toDatetimeLocalString(dateStr: string | Date | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

interface EditFormState {
  name: string;
  email: string;
  mobile: string;
  position: string;
  interviewDate: string;
  interviewedBy: string;
  status: CandidateStatus;
  notes: string;
}

interface RoundFormState {
  roundName: string;
  interviewDate: string;
  interviewedBy: string;
  status: string;
  notes: string;
}

const ROUND_PRESETS = [
  'Round 1 - Screening',
  'Round 2 - Technical Interview',
  'Coding Assessment',
  'System Design',
  'Managerial Discussion',
  'HR / Culture Fit',
  'Final Discussion',
];

const ROUND_STATUSES = [
  { value: 'Scheduled', label: 'Scheduled' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Passed', label: 'Passed / Cleared' },
  { value: 'Rejected', label: 'Rejected' },
  { value: 'On Hold', label: 'On Hold' },
];

export default function CandidateDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { hasPermission, user } = useAuth();
  usePageSubTitle('Candidate Details');

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Edit Mode State for General Candidate Details
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditFormState>({
    name: '',
    email: '',
    mobile: '',
    position: '',
    interviewDate: '',
    interviewedBy: '',
    status: 'Scheduled',
    notes: '',
  });

  // Separate file upload state for replacing resume
  const [newResumeFile, setNewResumeFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Available interviewers list
  const [interviewerOptions, setInterviewerOptions] = useState<Array<{ id: string; name: string; role?: string }>>([]);

  // =========================================================================
  // MULTIPLE INTERVIEW ROUNDS STATE
  // =========================================================================
  const [isAddRoundOpen, setIsAddRoundOpen] = useState(false);
  const [editingRoundId, setEditingRoundId] = useState<string | null>(null);
  const [savingRound, setSavingRound] = useState(false);
  const [deletingRoundId, setDeletingRoundId] = useState<string | null>(null);

  const [roundForm, setRoundForm] = useState<RoundFormState>({
    roundName: '',
    interviewDate: '',
    interviewedBy: '',
    status: 'Scheduled',
    notes: '',
  });

  // Fetch candidate details
  useEffect(() => {
    async function fetchCandidate() {
      try {
        const res = await candidatesApi.getById(id);
        const c = res.data;
        setCandidate(c);

        const interviewerId =
          typeof c.interviewedBy === 'object' && c.interviewedBy
            ? c.interviewedBy._id
            : (c.interviewedBy || '');

        setEditForm({
          name: c.name || '',
          email: c.email || '',
          mobile: c.mobile || '',
          position: c.position || '',
          interviewDate: toDatetimeLocalString(c.interviewDate),
          interviewedBy: interviewerId,
          status: c.status,
          notes: c.notes || '',
        });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to fetch candidate');
      } finally {
        setLoading(false);
      }
    }
    fetchCandidate();
  }, [id]);

  // Fetch active users for interviewer dropdown
  useEffect(() => {
    async function loadUsers() {
      try {
        const res = await api.get<{ users: Array<{ _id?: string; id?: string; name: string; role?: string }> }>(
          '/api/auth/users?pageSize=100'
        );
        if (res?.users) {
          setInterviewerOptions(
            res.users.map((u) => ({
              id: u._id || u.id || '',
              name: u.name,
              role: u.role,
            }))
          );
        }
      } catch {
        // Non-fatal if user does not have users.view permission
      }
    }
    loadUsers();
  }, []);

  const handleStartEditing = () => {
    if (!candidate) return;
    const interviewerId =
      typeof candidate.interviewedBy === 'object' && candidate.interviewedBy
        ? candidate.interviewedBy._id
        : (candidate.interviewedBy || '');

    setEditForm({
      name: candidate.name || '',
      email: candidate.email || '',
      mobile: candidate.mobile || '',
      position: candidate.position || '',
      interviewDate: toDatetimeLocalString(candidate.interviewDate),
      interviewedBy: interviewerId,
      status: candidate.status,
      notes: candidate.notes || '',
    });
    setNewResumeFile(null);
    setError('');
    setIsEditing(true);
  };

  const handleCancelEditing = () => {
    if (!candidate) return;
    const interviewerId =
      typeof candidate.interviewedBy === 'object' && candidate.interviewedBy
        ? candidate.interviewedBy._id
        : (candidate.interviewedBy || '');

    setEditForm({
      name: candidate.name || '',
      email: candidate.email || '',
      mobile: candidate.mobile || '',
      position: candidate.position || '',
      interviewDate: toDatetimeLocalString(candidate.interviewDate),
      interviewedBy: interviewerId,
      status: candidate.status,
      notes: candidate.notes || '',
    });
    setNewResumeFile(null);
    setError('');
    setIsEditing(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
      if (!validTypes.includes(selectedFile.type)) {
        setError('Only PDF, JPG, and PNG files are allowed for resumes.');
        return;
      }
      if (selectedFile.size > 5 * 1024 * 1024) {
        setError('Resume size must not exceed 5MB.');
        return;
      }
      setNewResumeFile(selectedFile);
      setError('');
    }
  };

  // Save General Candidate Details
  const handleSaveDetails = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editForm.name.trim()) {
      setError('Candidate name is required.');
      return;
    }
    if (!editForm.email.trim()) {
      setError('Candidate email is required.');
      return;
    }
    if (!/^[6-9][0-9]{9}$/.test(editForm.mobile.trim())) {
      setError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }
    if (!editForm.position.trim()) {
      setError('Applied position is required.');
      return;
    }
    if (!editForm.interviewDate) {
      setError('Interview date and time is required.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccessMessage('');

    try {
      let res;
      if (newResumeFile) {
        const formData = new FormData();
        formData.append('name', editForm.name.trim());
        formData.append('email', editForm.email.trim().toLowerCase());
        formData.append('mobile', editForm.mobile.trim());
        formData.append('position', editForm.position.trim());
        formData.append('interviewDate', new Date(editForm.interviewDate).toISOString());
        if (editForm.interviewedBy) {
          formData.append('interviewedBy', editForm.interviewedBy);
        }
        formData.append('status', editForm.status);
        formData.append('notes', editForm.notes);
        formData.append('resume', newResumeFile);

        res = await candidatesApi.update(id, formData);
      } else {
        const payload: Record<string, any> = {
          name: editForm.name.trim(),
          email: editForm.email.trim().toLowerCase(),
          mobile: editForm.mobile.trim(),
          position: editForm.position.trim(),
          interviewDate: new Date(editForm.interviewDate).toISOString(),
          status: editForm.status,
          notes: editForm.notes,
        };
        if (editForm.interviewedBy) {
          payload.interviewedBy = editForm.interviewedBy;
        }

        res = await candidatesApi.update(id, payload);
      }

      setCandidate(res.data);
      setNewResumeFile(null);
      setIsEditing(false);
      setSuccessMessage('Candidate details updated successfully.');
      setTimeout(() => setSuccessMessage(''), 4500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update candidate details.');
    } finally {
      setSaving(false);
    }
  };

  // =========================================================================
  // INTERVIEW ROUNDS HANDLERS
  // =========================================================================
  const handleOpenAddRound = () => {
    const existingCount = candidate?.interviewRounds?.length || 0;
    const defaultInterviewer =
      user?.id ||
      (interviewerOptions[0]?.id || '') ||
      (typeof candidate?.interviewedBy === 'object' && candidate?.interviewedBy ? candidate.interviewedBy._id : (typeof candidate?.interviewedBy === 'string' ? candidate.interviewedBy : ''));

    setRoundForm({
      roundName: `Round ${existingCount + 1}`,
      interviewDate: toDatetimeLocalString(new Date()),
      interviewedBy: defaultInterviewer,
      status: 'Scheduled',
      notes: '',
    });
    setEditingRoundId(null);
    setIsAddRoundOpen(true);
    setError('');
  };

  const handleOpenEditRound = (round: InterviewRound) => {
    const interviewerId =
      typeof round.interviewedBy === 'object' && round.interviewedBy
        ? round.interviewedBy._id
        : (round.interviewedBy || '');

    setRoundForm({
      roundName: round.roundName || `Round ${round.roundNumber || 1}`,
      interviewDate: toDatetimeLocalString(round.interviewDate),
      interviewedBy: interviewerId,
      status: round.status || 'Scheduled',
      notes: round.notes || '',
    });
    setEditingRoundId(round._id || null);
    setIsAddRoundOpen(true);
    setError('');
  };

  const handleCloseRoundModal = () => {
    setIsAddRoundOpen(false);
    setEditingRoundId(null);
    setRoundForm({
      roundName: '',
      interviewDate: '',
      interviewedBy: '',
      status: 'Scheduled',
      notes: '',
    });
  };

  const handleSaveRound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roundForm.interviewDate) {
      setError('Interview date and time is required.');
      return;
    }
    if (!roundForm.interviewedBy) {
      setError('Interviewer is required.');
      return;
    }

    setSavingRound(true);
    setError('');
    setSuccessMessage('');

    try {
      let res;
      if (editingRoundId) {
        // Update existing round
        res = await candidatesApi.updateRound(id, editingRoundId, {
          roundName: roundForm.roundName.trim() || undefined,
          interviewDate: new Date(roundForm.interviewDate).toISOString(),
          interviewedBy: roundForm.interviewedBy,
          status: roundForm.status,
          notes: roundForm.notes,
        });
        setSuccessMessage('Interview round updated successfully.');
      } else {
        // Add new round
        res = await candidatesApi.addRound(id, {
          roundName: roundForm.roundName.trim() || undefined,
          interviewDate: new Date(roundForm.interviewDate).toISOString(),
          interviewedBy: roundForm.interviewedBy,
          status: roundForm.status,
          notes: roundForm.notes,
        });
        setSuccessMessage('New interview round added successfully.');
      }

      setCandidate(res.data);
      handleCloseRoundModal();
      setTimeout(() => setSuccessMessage(''), 4500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save interview round.');
    } finally {
      setSavingRound(false);
    }
  };

  const handleDeleteRound = async (roundId: string) => {
    if (!window.confirm('Are you sure you want to delete this interview round?')) {
      return;
    }

    setDeletingRoundId(roundId);
    setError('');
    setSuccessMessage('');

    try {
      const res = await candidatesApi.deleteRound(id, roundId);
      setCandidate(res.data);
      setSuccessMessage('Interview round removed successfully.');
      setTimeout(() => setSuccessMessage(''), 4500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete interview round.');
    } finally {
      setDeletingRoundId(null);
    }
  };

  const handleDownloadResume = async () => {
    if (!candidate?.resumeUrl) return;
    setDownloading(true);
    try {
      const blob = await api.getBlob(candidate.resumeUrl);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const lowerKey = (candidate.resumeFileKey || '').toLowerCase();
      const ext = lowerKey.endsWith('.png')
        ? '.png'
        : lowerKey.endsWith('.jpg') || lowerKey.endsWith('.jpeg')
          ? '.jpg'
          : '.pdf';
      const cleanName = candidate.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `${cleanName}_Resume${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to download resume');
    } finally {
      setDownloading(false);
    }
  };

  if (!hasPermission('candidates.view')) {
    return (
      <div className="p-8 text-center text-red-500">
        You do not have permission to view this candidate.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="h-8 w-8 animate-spin text-[#6E1D1D]" />
      </div>
    );
  }

  if (error && !candidate) {
    return (
      <div className="p-8 text-center text-red-500 font-medium">
        {error || 'Candidate not found.'}
      </div>
    );
  }

  if (!candidate) return null;

  const STATUS_COLORS: Record<string, string> = {
    Scheduled: 'bg-blue-50 text-blue-700 border-blue-200',
    Interviewed: 'bg-amber-50 text-amber-700 border-amber-200',
    Completed: 'bg-purple-50 text-purple-700 border-purple-200',
    Selected: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Passed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Rejected: 'bg-rose-50 text-rose-700 border-rose-200',
    'On Hold': 'bg-slate-50 text-slate-700 border-slate-200',
  };

  const rounds: InterviewRound[] = candidate.interviewRounds || [];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/candidates')}
            className="p-2 -ml-2 text-slate-500 hover:text-slate-900 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
            title="Back to candidates list"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">{candidate.name}</h2>
              <span
                className={cx(
                  'px-2.5 py-0.5 rounded-full text-xs font-bold border',
                  STATUS_COLORS[candidate.status] || 'bg-slate-100 text-slate-700 border-slate-200'
                )}
              >
                {candidate.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Applied for <span className="font-semibold text-slate-700">{candidate.position}</span> · Multiple interview rounds evaluation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasPermission('candidates.manage') && (
            <>
              <button
                type="button"
                onClick={handleOpenAddRound}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-[#6E1D1D] text-white hover:bg-[#882424] transition-all cursor-pointer shadow-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Interview Round</span>
              </button>

              <button
                type="button"
                onClick={isEditing ? handleCancelEditing : handleStartEditing}
                className={cx(
                  'inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer shadow-2xs',
                  isEditing
                    ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    : 'border-[#6E1D1D]/30 bg-[#F8E6E6] text-[#6E1D1D] hover:bg-[#6E1D1D] hover:text-white'
                )}
              >
                {isEditing ? (
                  <>
                    <X className="h-3.5 w-3.5" />
                    <span>Cancel Edit</span>
                  </>
                ) : (
                  <>
                    <Pencil className="h-3.5 w-3.5" />
                    <span>Edit Profile</span>
                  </>
                )}
              </button>
            </>
          )}

          {candidate.resumeUrl && (
            <button
              type="button"
              onClick={handleDownloadResume}
              disabled={downloading}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 rounded-xl transition-colors border border-slate-200 cursor-pointer disabled:opacity-50 shadow-2xs"
            >
              {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              <span>Resume</span>
            </button>
          )}
        </div>
      </div>

      {/* Success Notification Banner */}
      {successMessage && (
        <div className="flex items-center gap-2 p-3.5 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 text-xs font-medium animate-in fade-in duration-200">
          <Check className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Error Notification Banner */}
      {error && (
        <div className="flex items-center gap-2 p-3.5 bg-rose-50 text-rose-800 rounded-xl border border-rose-200 text-xs font-medium animate-in fade-in duration-200">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* ================================================================= */}
          {/* 1. CANDIDATE PROFILE INFORMATION CARD                             */}
          {/* ================================================================= */}
          <Card className="p-6 rounded-2xl border border-slate-200 shadow-xs bg-white">
            <div className="flex items-center justify-between mb-5 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#F8E6E6] text-[#6E1D1D] flex items-center justify-center font-bold text-xs border border-[#6E1D1D]/20">
                  <User className="h-4 w-4" />
                </div>
                <h3 className="text-base font-bold text-slate-800">
                  {isEditing ? 'Edit Candidate Details' : 'Candidate Information'}
                </h3>
              </div>

              {hasPermission('candidates.manage') && !isEditing && (
                <button
                  type="button"
                  onClick={handleStartEditing}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[#6E1D1D] hover:bg-[#F8E6E6] rounded-lg transition-colors cursor-pointer"
                >
                  <Pencil className="h-3 w-3" />
                  <span>Edit</span>
                </button>
              )}
            </div>

            {/* EDIT MODE FORM */}
            {isEditing ? (
              <form onSubmit={handleSaveDetails} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Name */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Full Name *</label>
                    <input
                      required
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6E1D1D]/20 focus:border-[#6E1D1D] transition-colors"
                      placeholder="Candidate Name"
                    />
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Email Address *</label>
                    <input
                      required
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6E1D1D]/20 focus:border-[#6E1D1D] transition-colors"
                      placeholder="candidate@example.com"
                    />
                  </div>

                  {/* Mobile */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Mobile Number *</label>
                    <input
                      required
                      type="tel"
                      value={editForm.mobile}
                      onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })}
                      pattern="[6-9][0-9]{9}"
                      title="10-digit Indian mobile number starting with 6-9"
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6E1D1D]/20 focus:border-[#6E1D1D] transition-colors"
                      placeholder="9876543210"
                    />
                  </div>

                  {/* Position */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Applied Position *</label>
                    <input
                      required
                      type="text"
                      value={editForm.position}
                      onChange={(e) => setEditForm({ ...editForm, position: e.target.value })}
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6E1D1D]/20 focus:border-[#6E1D1D] transition-colors"
                      placeholder="e.g. MERN stack developer"
                    />
                  </div>

                  {/* Initial Interview Date & Time */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Primary Interview Date *</label>
                    <input
                      required
                      type="datetime-local"
                      value={editForm.interviewDate}
                      onChange={(e) => setEditForm({ ...editForm, interviewDate: e.target.value })}
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#6E1D1D]/20 focus:border-[#6E1D1D] transition-colors"
                    />
                  </div>

                  {/* Lead Interviewer */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Lead Interviewer</label>
                    {interviewerOptions.length > 0 ? (
                      <select
                        value={editForm.interviewedBy}
                        onChange={(e) => setEditForm({ ...editForm, interviewedBy: e.target.value })}
                        className="w-full h-9 px-3 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#6E1D1D]/20 focus:border-[#6E1D1D] transition-colors cursor-pointer"
                      >
                        <option value="">Select Interviewer</option>
                        {interviewerOptions.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} {u.role ? `(${u.role})` : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="h-9 px-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center text-xs text-slate-700">
                        {typeof candidate.interviewedBy === 'object' && candidate.interviewedBy
                          ? candidate.interviewedBy.name
                          : (candidate.interviewedBy || 'Assigned')}
                      </div>
                    )}
                  </div>

                  {/* Status in Edit Form */}
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-700">Overall Status</label>
                    <div className="w-full">
                      <Dropdown
                        showArrow={false}
                        value={editForm.status}
                        onChange={(val) => setEditForm({ ...editForm, status: val as CandidateStatus })}
                        options={[
                          { value: 'Scheduled', label: 'Scheduled' },
                          { value: 'Interviewed', label: 'Interviewed' },
                          { value: 'Selected', label: 'Selected' },
                          { value: 'Rejected', label: 'Rejected' },
                          { value: 'On Hold', label: 'On Hold' },
                        ]}
                        triggerClassName="h-9 px-3 text-xs font-medium"
                      />
                    </div>
                  </div>
                </div>

                {/* Notes in Edit Form */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-semibold text-slate-700">Overall Assessment Notes</label>
                  <textarea
                    rows={3}
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    placeholder="Candidate feedback, general remarks..."
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6E1D1D]/20 focus:border-[#6E1D1D] resize-none"
                  />
                </div>

                {/* Resume Replacement Section */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <label className="text-xs font-semibold text-slate-700">Candidate Resume</label>
                  {candidate.resumeUrl && !newResumeFile && (
                    <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                      <div className="flex items-center gap-2 text-slate-700">
                        <FileText className="h-4 w-4 text-[#6E1D1D]" />
                        <span>Current resume attached</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleDownloadResume}
                        className="text-xs font-semibold text-[#6E1D1D] hover:underline cursor-pointer"
                      >
                        Download Current
                      </button>
                    </div>
                  )}

                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-200 hover:border-[#6E1D1D]/40 rounded-xl p-4 flex flex-col items-center justify-center bg-slate-50/60 hover:bg-[#F8E6E6]/20 transition-all cursor-pointer text-center"
                  >
                    <Upload className="h-6 w-6 text-slate-400 mb-1" />
                    <p className="text-xs font-semibold text-slate-700">
                      {candidate.resumeUrl ? 'Click to replace existing resume' : 'Click to upload resume'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">PDF, JPG or PNG (max. 5MB)</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,image/jpeg,image/jpg,image/png"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </div>

                  {newResumeFile && (
                    <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <FileText className="h-4 w-4 text-emerald-700 shrink-0" />
                        <span className="font-semibold text-emerald-900 truncate">{newResumeFile.name}</span>
                        <span className="text-[10px] text-emerald-600">
                          ({(newResumeFile.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNewResumeFile(null)}
                        className="p-1 text-emerald-700 hover:text-red-600 rounded cursor-pointer"
                        title="Remove file"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Edit Form Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleCancelEditing}
                    disabled={saving}
                    className="h-9 px-4 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={saving}
                    className="h-9 px-5 text-xs font-semibold gap-1.5 cursor-pointer"
                  >
                    {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <span>Save Changes</span>
                  </Button>
                </div>
              </form>
            ) : (
              /* VIEW MODE DETAILS */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-slate-50 rounded-xl border border-slate-100 text-slate-400">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500">Email Address</p>
                    <p className="text-sm font-semibold text-slate-900 mt-0.5">{candidate.email}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 bg-slate-50 rounded-xl border border-slate-100 text-slate-400">
                    <Phone className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500">Mobile Number</p>
                    <p className="text-sm font-semibold text-slate-900 mt-0.5">{candidate.mobile}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 bg-slate-50 rounded-xl border border-slate-100 text-slate-400">
                    <Briefcase className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500">Applied Position</p>
                    <p className="text-sm font-semibold text-slate-900 mt-0.5">{candidate.position}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 bg-slate-50 rounded-xl border border-slate-100 text-slate-400">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500">Interview Date</p>
                    <p className="text-sm font-semibold text-slate-900 mt-0.5">
                      {new Date(candidate.interviewDate).toLocaleString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 bg-slate-50 rounded-xl border border-slate-100 text-slate-400">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500">Interviewed By</p>
                    <p className="text-sm font-semibold text-slate-900 mt-0.5">
                      {typeof candidate.interviewedBy === 'object' && candidate.interviewedBy
                        ? candidate.interviewedBy.name
                        : (candidate.interviewedBy || 'Not specified')}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 bg-slate-50 rounded-xl border border-slate-100 text-slate-400">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500">Resume Document</p>
                    {candidate.resumeUrl ? (
                      <button
                        type="button"
                        onClick={handleDownloadResume}
                        className="text-xs font-bold text-[#6E1D1D] hover:underline mt-0.5 cursor-pointer flex items-center gap-1"
                      >
                        <span>Download Resume</span>
                        <Download className="h-3 w-3" />
                      </button>
                    ) : (
                      <p className="text-xs text-slate-400 mt-0.5">No resume uploaded</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* ================================================================= */}
          {/* 2. MULTIPLE INTERVIEW ROUNDS TRACKER & EVALUATION                */}
          {/* ================================================================= */}
          <Card className="p-6 rounded-2xl border border-slate-200 shadow-xs bg-white space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#F8E6E6] text-[#6E1D1D] flex items-center justify-center font-bold text-xs border border-[#6E1D1D]/20">
                  <Layers className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">Interview Rounds</h3>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#F8E6E6] text-[#6E1D1D] border border-[#6E1D1D]/20">
                      {rounds.length} {rounds.length === 1 ? 'Round' : 'Rounds'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Save interview date, feedback notes, and interviewer for each round
                  </p>
                </div>
              </div>

              {hasPermission('candidates.manage') && (
                <Button
                  onClick={handleOpenAddRound}
                  className="gap-1.5 text-xs h-9 cursor-pointer shadow-xs self-start sm:self-auto"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Round</span>
                </Button>
              )}
            </div>

            {/* ROUNDS LIST */}
            {rounds.length === 0 ? (
              <div className="p-8 text-center bg-slate-50/60 rounded-2xl border border-dashed border-slate-200 space-y-2">
                <Clock className="h-8 w-8 text-slate-300 mx-auto" />
                <p className="text-sm font-semibold text-slate-700">No interview rounds recorded yet</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Record multiple interview stages (Screening, Technical, Managerial, HR) with dates, notes, and interviewers.
                </p>
                {hasPermission('candidates.manage') && (
                  <Button
                    onClick={handleOpenAddRound}
                    variant="secondary"
                    className="mt-3 text-xs h-8 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Record First Round
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {rounds.map((round, idx) => {
                  const interviewerName =
                    typeof round.interviewedBy === 'object' && round.interviewedBy
                      ? round.interviewedBy.name
                      : (round.interviewedBy || 'Interviewer');
                  const interviewerRole =
                    typeof round.interviewedBy === 'object' && round.interviewedBy && (round.interviewedBy as any).role
                      ? `(${(round.interviewedBy as any).role})`
                      : '';

                  const roundNumber = round.roundNumber || idx + 1;
                  const roundTitle = round.roundName || `Round ${roundNumber}`;

                  return (
                    <div
                      key={round._id || `round-${idx}`}
                      className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-all shadow-2xs space-y-3 relative group"
                    >
                      {/* Round Header */}
                      <div className="flex flex-wrap items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#6E1D1D] text-white text-xs font-bold shadow-xs">
                            {roundNumber}
                          </span>
                          <div>
                            <h4 className="text-sm font-bold text-slate-900">{roundTitle}</h4>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-0.5">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                <span className="font-medium text-slate-700">
                                  {new Date(round.interviewDate).toLocaleString('en-GB', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </span>
                              <span>·</span>
                              <span className="flex items-center gap-1">
                                <User className="h-3.5 w-3.5 text-slate-400" />
                                <span className="font-semibold text-slate-800">
                                  {interviewerName}
                                </span>{' '}
                                <span className="text-[11px] text-slate-400">{interviewerRole}</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={cx(
                              'px-2.5 py-0.5 rounded-full text-xs font-bold border',
                              STATUS_COLORS[round.status || 'Scheduled'] || 'bg-slate-100 text-slate-700 border-slate-200'
                            )}
                          >
                            {round.status || 'Scheduled'}
                          </span>

                          {hasPermission('candidates.manage') && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenEditRound(round)}
                                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                                title="Edit round details"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              {rounds.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => round._id && handleDeleteRound(round._id)}
                                  disabled={deletingRoundId === round._id}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-50"
                                  title="Delete round"
                                >
                                  {deletingRoundId === round._id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Notes / Feedback */}
                      {round.notes ? (
                        <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100 text-xs text-slate-700 leading-relaxed space-y-1">
                          <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block">
                            Interview Feedback & Notes:
                          </span>
                          <p className="whitespace-pre-wrap">{round.notes}</p>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">
                          No specific notes recorded for this round.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Status & Rounds Summary Overview */}
        <div className="lg:col-span-1 space-y-6">
          {/* CURRENT STATUS */}
          <Card className="p-6 rounded-2xl border border-slate-200 shadow-xs bg-white">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              CURRENT STATUS
            </h3>
            <div
              className={cx(
                'py-3.5 px-4 rounded-xl text-center font-bold text-base border shadow-2xs',
                STATUS_COLORS[candidate.status] || 'bg-slate-50 text-slate-700 border-slate-200'
              )}
            >
              {candidate.status}
            </div>

            {/* Rounds Progress Counter */}
            <div className="mt-5 pt-4 border-t border-slate-100 space-y-2.5">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                <span>Rounds Summary</span>
                <span className="font-semibold text-slate-700">{rounds.length} Total</span>
              </h4>

              <div className="space-y-2">
                {rounds.map((r, i) => (
                  <div
                    key={r._id || i}
                    className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50 border border-slate-100"
                  >
                    <span className="font-medium text-slate-700 truncate max-w-[140px]">
                      {r.roundName || `Round ${i + 1}`}
                    </span>
                    <span
                      className={cx(
                        'px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0',
                        STATUS_COLORS[r.status || 'Scheduled'] || 'bg-slate-100 text-slate-600 border-slate-200'
                      )}
                    >
                      {r.status || 'Scheduled'}
                    </span>
                  </div>
                ))}
              </div>

              {hasPermission('candidates.manage') && (
                <button
                  type="button"
                  onClick={handleOpenAddRound}
                  className="w-full mt-2 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl border border-dashed border-[#6E1D1D]/30 text-xs font-semibold text-[#6E1D1D] hover:bg-[#F8E6E6]/40 transition-colors cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Another Round</span>
                </button>
              )}
            </div>

            {/* Resume Overview */}
            <div className="mt-5 pt-4 border-t border-slate-100 space-y-2.5">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Resume Overview
              </h4>
              {candidate.resumeUrl ? (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                    <FileText className="h-4 w-4 text-[#6E1D1D]" />
                    <span>Resume Document</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Uploaded document is attached to this candidate profile.
                  </p>
                  <button
                    type="button"
                    onClick={handleDownloadResume}
                    disabled={downloading}
                    className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                  >
                    {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    <span>Download Resume</span>
                  </button>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center space-y-1.5">
                  <FileText className="h-7 w-7 text-slate-300 mx-auto" />
                  <p className="text-xs font-medium text-slate-600">No resume uploaded</p>
                  {hasPermission('candidates.manage') && !isEditing && (
                    <button
                      type="button"
                      onClick={handleStartEditing}
                      className="text-xs font-semibold text-[#6E1D1D] hover:underline cursor-pointer"
                    >
                      + Upload Resume
                    </button>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* ADD / EDIT INTERVIEW ROUND MODAL                                      */}
      {/* ===================================================================== */}
      {isAddRoundOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#F8E6E6] text-[#6E1D1D] flex items-center justify-center font-bold text-sm border border-[#6E1D1D]/20">
                  <Layers className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingRoundId ? 'Edit Interview Round' : 'Add Interview Round'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Candidate: <span className="font-semibold text-slate-700">{candidate.name}</span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseRoundModal}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveRound} className="p-4 sm:p-5 space-y-4 overflow-y-auto">
              {/* Quick Presets */}
              {!editingRoundId && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Quick Preset Names:
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {ROUND_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setRoundForm({ ...roundForm, roundName: preset })}
                        className={cx(
                          'px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer',
                          roundForm.roundName === preset
                            ? 'bg-[#6E1D1D] text-white border-[#6E1D1D]'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        )}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Round Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Round Title / Stage *</label>
                <input
                  required
                  type="text"
                  value={roundForm.roundName}
                  onChange={(e) => setRoundForm({ ...roundForm, roundName: e.target.value })}
                  placeholder="e.g. Round 2 - Technical Interview"
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6E1D1D]/20 focus:border-[#6E1D1D] transition-colors"
                />
              </div>

              {/* Date and Time */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Interview Date & Time *</label>
                <input
                  required
                  type="datetime-local"
                  value={roundForm.interviewDate}
                  onChange={(e) => setRoundForm({ ...roundForm, interviewDate: e.target.value })}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#6E1D1D]/20 focus:border-[#6E1D1D] transition-colors"
                />
              </div>

              {/* Interviewed By */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Interviewed By (Interviewer) *</label>
                {interviewerOptions.length > 0 ? (
                  <select
                    required
                    value={roundForm.interviewedBy}
                    onChange={(e) => setRoundForm({ ...roundForm, interviewedBy: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#6E1D1D]/20 focus:border-[#6E1D1D] transition-colors cursor-pointer"
                  >
                    <option value="">Select Interviewer</option>
                    {interviewerOptions.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} {u.role ? `(${u.role})` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    required
                    type="text"
                    value={roundForm.interviewedBy}
                    onChange={(e) => setRoundForm({ ...roundForm, interviewedBy: e.target.value })}
                    placeholder="Interviewer User ID"
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 text-xs text-slate-800"
                  />
                )}
              </div>

              {/* Round Status */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Round Status</label>
                <select
                  value={roundForm.status}
                  onChange={(e) => setRoundForm({ ...roundForm, status: e.target.value })}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#6E1D1D]/20 focus:border-[#6E1D1D] transition-colors cursor-pointer"
                >
                  {ROUND_STATUSES.map((st) => (
                    <option key={st.value} value={st.value}>
                      {st.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes & Feedback */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Interview Notes & Evaluation Remarks</label>
                <textarea
                  rows={4}
                  value={roundForm.notes}
                  onChange={(e) => setRoundForm({ ...roundForm, notes: e.target.value })}
                  placeholder="Record topics covered, candidate strengths, weaknesses, coding questions asked, and recommendation..."
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6E1D1D]/20 focus:border-[#6E1D1D] resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleCloseRoundModal}
                  disabled={savingRound}
                  className="h-9 px-4 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={savingRound}
                  className="h-9 px-5 text-xs font-semibold gap-1.5 cursor-pointer"
                >
                  {savingRound && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{editingRoundId ? 'Update Round' : 'Save Round'}</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
