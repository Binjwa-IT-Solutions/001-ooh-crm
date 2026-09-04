'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Search, Filter, Loader2, FileText, ChevronRight } from 'lucide-react';
import { Button, cx, Card } from '@/shared/ui';
import { useAuth } from '@/shared/auth/auth-context';
import { usePageSubTitle } from '@/shared/layout/page-header-context';
import { candidatesApi } from '@/modules/hr/api';
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
      } catch (err: any) {
        setError(err.message || 'Failed to fetch candidates');
      } finally {
        setLoading(false);
      }
    }
    fetchCandidates();
  }, [statusFilter, positionFilter]);

  if (!hasPermission('candidates.view')) {
    return <div className="p-8 text-center text-red-500">You do not have permission to view candidates.</div>;
  }

  const STATUS_COLORS: Record<string, string> = {
    'Scheduled': 'bg-blue-50 text-blue-700 border-blue-200',
    'Interviewed': 'bg-amber-50 text-amber-700 border-amber-200',
    'Selected': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Rejected': 'bg-rose-50 text-rose-700 border-rose-200',
    'On Hold': 'bg-slate-50 text-slate-700 border-slate-200',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-slate-800">Interviews</h2>

        {hasPermission('candidates.manage') && (
          <Button onClick={() => router.push('/candidates/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Candidate
          </Button>
        )}
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-700">Filters:</span>
        </div>

        <select
          className="h-9 px-3 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-brand-500/20"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as CandidateStatus | '')}
        >
          <option value="">All Statuses</option>
          <option value="Scheduled">Scheduled</option>
          <option value="Interviewed">Interviewed</option>
          <option value="Selected">Selected</option>
          <option value="Rejected">Rejected</option>
          <option value="On Hold">On Hold</option>
        </select>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search position..."
            className="h-9 pl-9 pr-3 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-brand-500/20"
            value={positionFilter}
            onChange={(e) => setPositionFilter(e.target.value)}
          />
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
              <tr>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Position</th>
                <th className="px-6 py-4">Interview Date</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-brand-500 mb-2" />
                    <p>Loading candidates...</p>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-red-500">{error}</td>
                </tr>
              ) : candidates.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    No candidates found.
                  </td>
                </tr>
              ) : (
                candidates.map((c) => (
                  <tr key={c._id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => router.push(`/candidates/${c._id}`)}>
                    <td className="px-6 py-4 font-medium text-slate-800">{c.name}</td>
                    <td className="px-6 py-4 text-slate-600">{c.position}</td>
                    <td className="px-6 py-4 text-slate-600">
                      {new Date(c.interviewDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4">
                      <span className={cx(
                        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
                        STATUS_COLORS[c.status] || 'bg-slate-100 text-slate-700 border-slate-200'
                      )}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <ChevronRight className="h-5 w-5 text-slate-400 inline-block" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
