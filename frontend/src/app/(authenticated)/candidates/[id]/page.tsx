'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Loader2, Download, Calendar, Phone, Mail, User, Briefcase, FileText } from 'lucide-react';
import { Button, Card, cx } from '@/shared/ui';
import { useAuth } from '@/shared/auth/auth-context';
import { usePageSubTitle } from '@/shared/layout/page-header-context';
import { candidatesApi } from '@/modules/hr/api';
import { api } from '@/shared/api/client';
import type { Candidate, CandidateStatus } from '@/modules/hr/types';

export default function CandidateDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  
  const { hasPermission } = useAuth();
  usePageSubTitle('Candidate Details');

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  
  const [status, setStatus] = useState<CandidateStatus | ''>('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    async function fetchCandidate() {
      try {
        const res = await candidatesApi.getById(id);
        setCandidate(res.data);
        setStatus(res.data.status);
        setNotes(res.data.notes || '');
      } catch (err: any) {
        setError(err.message || 'Failed to fetch candidate');
      } finally {
        setLoading(false);
      }
    }
    fetchCandidate();
  }, [id]);

  const handleUpdate = async () => {
    if (!status) return;
    setSaving(true);
    setError('');
    try {
      const res = await candidatesApi.update(id, { 
        status: status as CandidateStatus, 
        notes 
      });
      setCandidate(res.data);
      alert('Candidate updated successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to update candidate');
    } finally {
      setSaving(false);
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
      const ext = candidate.resumeFileKey?.endsWith('.jpg') || candidate.resumeFileKey?.endsWith('.jpeg') ? '.jpg' : '.pdf';
      const cleanName = candidate.name.replace(/[^a-zA-Z0-9]/g, '_');
      a.download = `${cleanName}_Resume${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Failed to download resume');
    } finally {
      setDownloading(false);
    }
  };

  if (!hasPermission('candidates.view')) {
    return <div className="p-8 text-center text-red-500">You do not have permission to view this candidate.</div>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (error || !candidate) {
    return (
      <div className="p-8 text-center text-red-500">
        {error || 'Candidate not found.'}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/candidates')}
            className="p-2 -ml-2 text-slate-500 hover:text-slate-900 rounded-full hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-xl font-semibold text-slate-800">{candidate.name}</h2>
        </div>
        
        {candidate.resumeUrl && (
          <button
            type="button"
            onClick={handleDownloadResume}
            disabled={downloading}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-brand-600 bg-brand-50 hover:bg-brand-100 rounded-lg transition-colors border border-brand-200 cursor-pointer disabled:opacity-50"
          >
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download Resume
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-medium text-slate-800 mb-4 border-b border-slate-100 pb-2">Candidate Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-slate-500">Email Address</p>
                  <p className="text-slate-800">{candidate.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-slate-500">Mobile Number</p>
                  <p className="text-slate-800">{candidate.mobile}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Briefcase className="h-5 w-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-slate-500">Applied Position</p>
                  <p className="text-slate-800">{candidate.position}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-slate-500">Interview Date</p>
                  <p className="text-slate-800">
                    {new Date(candidate.interviewDate).toLocaleString('en-GB', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-slate-500">Interviewed By</p>
                  <p className="text-slate-800">
                    {typeof candidate.interviewedBy === 'object' && candidate.interviewedBy
                      ? candidate.interviewedBy.name
                      : (candidate.interviewedBy || 'Unknown')}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {hasPermission('candidates.manage') && (
            <Card className="p-6">
              <h3 className="text-lg font-medium text-slate-800 mb-4 border-b border-slate-100 pb-2">Update Status & Notes</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Interview Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as CandidateStatus)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-500/20 outline-none bg-white"
                  >
                    <option value="Scheduled">Scheduled</option>
                    <option value="Interviewed">Interviewed</option>
                    <option value="Selected">Selected</option>
                    <option value="Rejected">Rejected</option>
                    <option value="On Hold">On Hold</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Interview Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-500/20 outline-none resize-none"
                    placeholder="Add your comments here..."
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <Button onClick={handleUpdate} disabled={saving || (status === candidate.status && notes === (candidate.notes || ''))}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Save Changes
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>

        <div className="md:col-span-1 space-y-6">
          <Card className="p-6">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Current Status</h3>
            <div className={cx(
              "p-4 rounded-xl text-center font-medium text-lg border",
              candidate.status === 'Scheduled' && 'bg-blue-50 text-blue-700 border-blue-200',
              candidate.status === 'Interviewed' && 'bg-amber-50 text-amber-700 border-amber-200',
              candidate.status === 'Selected' && 'bg-emerald-50 text-emerald-700 border-emerald-200',
              candidate.status === 'Rejected' && 'bg-rose-50 text-rose-700 border-rose-200',
              candidate.status === 'On Hold' && 'bg-slate-50 text-slate-700 border-slate-200'
            )}>
              {candidate.status}
            </div>
            
            {!candidate.resumeUrl && (
              <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-100 text-center">
                <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No resume uploaded</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
