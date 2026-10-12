'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Search,
  Filter,
  Loader2,
  FileText,
  ChevronRight,
  Download,
  ExternalLink,
  X,
  Eye,
  Calendar,
  Briefcase,
  AlertCircle,
} from 'lucide-react';
import { Button, cx, Card, Dropdown } from '@/shared/ui';
import { useAuth } from '@/shared/auth/auth-context';
import { usePageSubTitle } from '@/shared/layout/page-header-context';
import { candidatesApi } from '@/modules/hr/api';
import { api } from '@/shared/api/client';
import type { Candidate, CandidateStatus } from '@/modules/hr/types';

export default function CandidatesListPage() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  usePageSubTitle('List');

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [statusFilter, setStatusFilter] = useState<CandidateStatus | ''>('');
  const [positionFilter, setPositionFilter] = useState('');
  const [resumeFilter, setResumeFilter] = useState<'all' | 'available' | 'none'>('all');

  // Resume In-App Preview Modal State
  const [selectedCandidateForResume, setSelectedCandidateForResume] = useState<Candidate | null>(null);
  const [resumeModalOpen, setResumeModalOpen] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [resumeBlobUrl, setResumeBlobUrl] = useState<string | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [resumeIsPdf, setResumeIsPdf] = useState(true);
  const [downloadingResume, setDownloadingResume] = useState(false);

  useEffect(() => {
    async function fetchCandidates() {
      setLoading(true);
      setError('');
      try {
        const res = await candidatesApi.list({
          status: statusFilter || undefined,
          position: positionFilter || undefined,
        });
        setCandidates(res.data || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to fetch candidates');
      } finally {
        setLoading(false);
      }
    }
    fetchCandidates();
  }, [statusFilter, positionFilter]);

  // Clean up object URLs when modal closes or unmounts
  const cleanupBlobUrl = useCallback(() => {
    if (resumeBlobUrl) {
      URL.revokeObjectURL(resumeBlobUrl);
      setResumeBlobUrl(null);
    }
  }, [resumeBlobUrl]);

  const handleCloseResumeModal = useCallback(() => {
    cleanupBlobUrl();
    setResumeModalOpen(false);
    setSelectedCandidateForResume(null);
    setResumeError(null);
    setResumeLoading(false);
  }, [cleanupBlobUrl]);

  // Open candidate resume in modal
  const handleOpenResume = useCallback(
    async (candidate: Candidate) => {
      setSelectedCandidateForResume(candidate);
      setResumeModalOpen(true);
      setResumeLoading(true);
      setResumeError(null);
      cleanupBlobUrl();

      try {
        let resumeUrl = candidate.resumeUrl;

        // Fallback: If resumeUrl is not populated in list, fetch full candidate record
        if (!resumeUrl) {
          const detailRes = await candidatesApi.getById(candidate._id);
          resumeUrl = detailRes.data?.resumeUrl;
        }

        if (!resumeUrl) {
          throw new Error('Resume file is not available for this candidate.');
        }

        // Detect file type
        const lowerKey = (candidate.resumeFileKey || resumeUrl).toLowerCase();
        const isPdf = lowerKey.endsWith('.pdf') || !lowerKey.match(/\.(jpg|jpeg|png|webp)$/);
        setResumeIsPdf(isPdf);

        // Fetch via authenticated API client to obtain blob URL
        const blob = await api.getBlob(resumeUrl);
        const objectUrl = window.URL.createObjectURL(blob);
        setResumeBlobUrl(objectUrl);
      } catch (err: unknown) {
        console.error('Failed to load resume:', err);
        setResumeError(err instanceof Error ? err.message : 'Failed to load candidate resume.');
      } finally {
        setResumeLoading(false);
      }
    },
    [cleanupBlobUrl]
  );

  // Download resume file
  const handleDownloadResume = useCallback(async (candidate: Candidate) => {
    if (!candidate) return;
    setDownloadingResume(true);
    try {
      let resumeUrl = candidate.resumeUrl;
      if (!resumeUrl) {
        const detailRes = await candidatesApi.getById(candidate._id);
        resumeUrl = detailRes.data?.resumeUrl;
      }
      if (!resumeUrl) {
        throw new Error('Resume file is not available.');
      }

      const blob = await api.getBlob(resumeUrl);
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
      setDownloadingResume(false);
    }
  }, []);

  // Filter candidates by resume availability
  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      const hasResume = Boolean(c.resumeFileKey || c.resumeUrl);
      if (resumeFilter === 'available') return hasResume;
      if (resumeFilter === 'none') return !hasResume;
      return true;
    });
  }, [candidates, resumeFilter]);

  if (!hasPermission('candidates.view')) {
    return (
      <div className="p-8 text-center text-red-500">
        You do not have permission to view candidates.
      </div>
    );
  }

  const STATUS_COLORS: Record<string, string> = {
    Scheduled: 'bg-blue-50 text-blue-700 border-blue-200',
    Interviewed: 'bg-amber-50 text-amber-700 border-amber-200',
    Selected: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Rejected: 'bg-rose-50 text-rose-700 border-rose-200',
    'On Hold': 'bg-slate-50 text-slate-700 border-slate-200',
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Interviews</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Recruitment pipeline, scheduled interviews, and candidate evaluations
          </p>
        </div>

        {hasPermission('candidates.manage') && (
          <Button onClick={() => router.push('/candidates/new')} className="gap-2 cursor-pointer shadow-xs">
            <Plus className="h-4 w-4" />
            Add Candidate
          </Button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
            <Filter className="h-4 w-4 text-[#6E1D1D]" />
            <span>Filters:</span>
          </div>

          {/* Status Filter */}
          <div className="w-36">
            <Dropdown
              showArrow={false}
              value={statusFilter}
              onChange={(val) => setStatusFilter(val as CandidateStatus | '')}
              options={[
                { value: '', label: 'All Statuses' },
                { value: 'Scheduled', label: 'Scheduled' },
                { value: 'Interviewed', label: 'Interviewed' },
                { value: 'Selected', label: 'Selected' },
                { value: 'Rejected', label: 'Rejected' },
                { value: 'On Hold', label: 'On Hold' },
              ]}
              triggerClassName="h-9 px-3 text-xs font-semibold"
            />
          </div>

          {/* Resume Availability Filter */}
          <div className="w-44">
            <Dropdown
              showArrow={false}
              value={resumeFilter}
              onChange={(val) => setResumeFilter(val as 'all' | 'available' | 'none')}
              options={[
                { value: 'all', label: 'All Candidates' },
                { value: 'available', label: 'Resume Available' },
                { value: 'none', label: 'No Resume' },
              ]}
              triggerClassName="h-9 px-3 text-xs font-semibold"
            />
          </div>

          {/* Position Search */}
          <div className="relative w-52 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search position..."
              className="h-9 w-full pl-9 pr-3 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6E1D1D]/20 focus:border-[#6E1D1D] transition-colors"
              value={positionFilter}
              onChange={(e) => setPositionFilter(e.target.value)}
            />
          </div>
        </div>

        <div className="text-xs font-medium text-slate-500">
          Showing <span className="font-bold text-slate-800">{filteredCandidates.length}</span> of {candidates.length} Candidates
        </div>
      </div>

      {/* Candidates Table */}
      <Card className="rounded-2xl border border-slate-200 shadow-xs overflow-hidden bg-white">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Candidate</th>
                <th className="px-5 py-3.5">Applied Position</th>
                <th className="px-5 py-3.5">Interview Date</th>
                <th className="px-5 py-3.5 text-center">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-[#6E1D1D] mb-2" />
                    <p className="font-medium">Loading candidates...</p>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-red-500 font-medium">
                    {error}
                  </td>
                </tr>
              ) : filteredCandidates.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                    No candidates found matching the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredCandidates.map((c) => {
                  const hasResume = Boolean(c.resumeFileKey || c.resumeUrl);

                  return (
                    <tr
                      key={c._id}
                      className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                      onClick={() => router.push(`/candidates/${c._id}`)}
                    >
                      {/* Candidate Name & Contact */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[#F8E6E6] text-[#6E1D1D] flex items-center justify-center font-bold text-xs border border-[#6E1D1D]/20 shrink-0">
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 group-hover:text-[#6E1D1D] transition-colors">
                                {c.name}
                              </span>
                              {hasResume && (
                                <span
                                  className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200"
                                  title="Resume uploaded and available"
                                >
                                  <FileText className="h-3 w-3" />
                                  Resume
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {c.email} · {c.mobile}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Position */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                          <Briefcase className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>{c.position}</span>
                        </div>
                      </td>

                      {/* Interview Date */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="font-semibold text-slate-800">
                            {new Date(c.interviewDate).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="px-5 py-3.5 text-center">
                        <span
                          className={cx(
                            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border',
                            STATUS_COLORS[c.status] || 'bg-slate-100 text-slate-700 border-slate-200'
                          )}
                        >
                          {c.status}
                        </span>
                      </td>

                      {/* Action Area */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          {hasResume ? (
                            <button
                              type="button"
                              onClick={() => handleOpenResume(c)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[#6E1D1D] bg-[#F8E6E6] hover:bg-[#6E1D1D] hover:text-white rounded-lg border border-[#6E1D1D]/30 transition-all shadow-2xs cursor-pointer"
                              title="View Candidate Resume"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              <span>View Resume</span>
                            </button>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-slate-400 bg-slate-50 rounded-lg border border-slate-200 select-none"
                              title="No resume uploaded"
                            >
                              No Resume
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => router.push(`/candidates/${c._id}`)}
                            className="inline-flex items-center gap-1 p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                            title="View Candidate Details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <ChevronRight className="h-3.5 w-3.5 -ml-1 text-slate-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ===================================================================== */}
      {/* IN-APP RESUME PREVIEW MODAL                                           */}
      {/* ===================================================================== */}
      {resumeModalOpen && selectedCandidateForResume && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 bg-slate-50/70">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#F8E6E6] text-[#6E1D1D] flex items-center justify-center font-bold text-sm border border-[#6E1D1D]/20 shrink-0">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 truncate">
                      Resume — {selectedCandidateForResume.name}
                    </h3>
                    <span
                      className={cx(
                        'px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0',
                        STATUS_COLORS[selectedCandidateForResume.status] || 'bg-slate-100 text-slate-700 border-slate-200'
                      )}
                    >
                      {selectedCandidateForResume.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    Applied for <span className="font-semibold text-slate-700">{selectedCandidateForResume.position}</span> ·{' '}
                    Interview on{' '}
                    {new Date(selectedCandidateForResume.interviewDate).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>

              {/* Action Buttons in Modal Header */}
              <div className="flex items-center gap-2 shrink-0">
                {resumeBlobUrl && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleDownloadResume(selectedCandidateForResume)}
                      disabled={downloadingResume}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                      title="Download resume to computer"
                    >
                      {downloadingResume ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5 text-[#6E1D1D]" />
                      )}
                      <span className="hidden sm:inline">Download</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => window.open(resumeBlobUrl, '_blank')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                      title="Open in new browser tab"
                    >
                      <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                      <span className="hidden sm:inline">Open in Tab</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={handleCloseResumeModal}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200/60 transition-colors cursor-pointer ml-1"
                  title="Close resume preview"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body / Viewer */}
            <div className="flex-1 overflow-auto p-4 bg-slate-100/50 flex flex-col items-center justify-center min-h-[420px] max-h-[72vh]">
              {resumeLoading ? (
                <div className="flex flex-col items-center justify-center p-12 gap-3 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-[#6E1D1D]" />
                  <p className="text-xs font-semibold text-slate-600">Loading candidate resume...</p>
                  <p className="text-[11px] text-slate-400">Fetching document from secure storage</p>
                </div>
              ) : resumeError ? (
                <div className="max-w-md w-full bg-white rounded-2xl p-6 border border-red-200 text-center shadow-xs space-y-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">Resume Preview Unavailable</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">{resumeError}</p>
                  <Button
                    onClick={() => handleOpenResume(selectedCandidateForResume)}
                    className="mt-2 text-xs cursor-pointer"
                  >
                    Retry Loading
                  </Button>
                </div>
              ) : resumeBlobUrl ? (
                resumeIsPdf ? (
                  <iframe
                    src={resumeBlobUrl}
                    className="w-full h-full min-h-[580px] rounded-xl border border-slate-200 bg-white shadow-xs"
                    title={`Resume for ${selectedCandidateForResume.name}`}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center overflow-auto p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={resumeBlobUrl}
                      alt={`Resume for ${selectedCandidateForResume.name}`}
                      className="max-h-[68vh] max-w-full object-contain rounded-xl border border-slate-200 shadow-sm bg-white"
                    />
                  </div>
                )
              ) : (
                <div className="text-center p-8 text-slate-400 text-xs">No resume document loaded.</div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 sm:p-4 border-t border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3 text-slate-500">
                <span>
                  Email: <span className="font-semibold text-slate-700">{selectedCandidateForResume.email}</span>
                </span>
                <span>·</span>
                <span>
                  Phone: <span className="font-semibold text-slate-700">{selectedCandidateForResume.mobile}</span>
                </span>
              </div>

              <div className="flex items-center gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    handleCloseResumeModal();
                    router.push(`/candidates/${selectedCandidateForResume._id}`);
                  }}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs cursor-pointer shadow-2xs transition-colors"
                >
                  Candidate Profile →
                </button>
                <button
                  type="button"
                  onClick={handleCloseResumeModal}
                  className="px-4 py-1.5 rounded-xl bg-[#6E1D1D] hover:bg-[#882424] text-white font-semibold text-xs cursor-pointer shadow-xs transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
