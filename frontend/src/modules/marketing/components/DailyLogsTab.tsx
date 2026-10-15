'use client';

import { useState, useEffect } from 'react';
import {
  Clock,
  Plus,
  RefreshCw,
  ExternalLink,
  Users,
  AlertCircle,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { useAuth } from '@/shared/auth/auth-context';
import { marketingApi } from '../api';
import type { DailyLogItem } from '../types';

export default function DailyLogsTab() {
  const { user } = useAuth();
  const userRole = (user?.role || '').toLowerCase();
  const isManagerOrAdmin = ['admin', 'superadmin', 'managing_director', 'manager'].includes(userRole);

  const [logs, setLogs] = useState<DailyLogItem[]>([]);
  const [managerSummary, setManagerSummary] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'my' | 'manager'>('my');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));

  // Form state
  const [showLogModal, setShowLogModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [category, setCategory] = useState('Planned task');
  const [customCategory, setCustomCategory] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [hoursSpent, setHoursSpent] = useState<number>(2);
  const [description, setDescription] = useState('');
  const [outputLink, setOutputLink] = useState('');
  const [statusAfterToday, setStatusAfterToday] = useState('Done');

  const loadLogs = async () => {
    try {
      setLoading(true);
      if (viewMode === 'my') {
        const res = await marketingApi.getDailyLogs({ date: selectedDate, userId: user?.id });
        setLogs(res.data || []);
      } else {
        const res = await marketingApi.getManagerDailySummary(selectedDate);
        setManagerSummary(res.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, selectedDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle || hoursSpent <= 0 || !description) return;

    try {
      setSubmitting(true);
      const finalCategory = category === 'Other' && customCategory.trim() ? customCategory.trim() : category;
      await marketingApi.submitDailyLog({
        date: selectedDate,
        category: finalCategory,
        taskTitle,
        hoursSpent: Number(hoursSpent),
        description,
        outputLink: outputLink || undefined,
        statusAfterToday,
      });

      // Reset form
      setTaskTitle('');
      setDescription('');
      setOutputLink('');
      setCategory('Planned task');
      setCustomCategory('');
      setHoursSpent(2);
      setShowLogModal(false);
      loadLogs();
      alert('Daily log submitted successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to submit log');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode('my')}
            className={`rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
              viewMode === 'my'
                ? 'bg-[#8B2424] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            My Daily Logs
          </button>
          {isManagerOrAdmin && (
            <button
              type="button"
              onClick={() => setViewMode('manager')}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'manager'
                  ? 'bg-[#8B2424] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Team Overview (Manager View)</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-[#8B2424] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          />

          <button
            type="button"
            onClick={() => setShowLogModal(true)}
            className="flex items-center gap-1.5 rounded-xl bg-[#8B2424] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#721c1c] transition cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Log Daily Work</span>
          </button>
        </div>
      </div>

      {/* View Mode: MY LOGS */}
      {viewMode === 'my' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
            Logs for {new Date(selectedDate).toLocaleDateString('en-IN', { dateStyle: 'long' })}
          </h3>

          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading daily logs...</div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              <Clock className="mx-auto mb-2 h-6 w-6 text-slate-300 dark:text-slate-600" />
              No work logged yet for this date. Click &quot;Log Daily Work&quot; to submit.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {logs.map((log) => (
                <div key={log._id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900 dark:text-white">{log.taskTitle}</span>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {log.category}
                      </span>
                      {log.isBackdated && (
                        <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                          Backdated
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{log.description}</p>
                    {log.outputLink && (
                      <a
                        href={log.outputLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        <span>View Deliverable Output (Drive/Figma/Link)</span>
                      </a>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-right">
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                      {log.hoursSpent} hrs
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        log.statusAfterToday === 'Done'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                      }`}
                    >
                      {log.statusAfterToday}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* View Mode: MANAGER TEAM VIEW */}
      {viewMode === 'manager' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Team Accountability &amp; Hours Rollup
              </h3>
              <p className="text-[11px] text-slate-400">All members logged on {selectedDate}</p>
            </div>
            <span className="text-xs font-semibold text-slate-500">{managerSummary.length} Members Logged</span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading team summary...</div>
          ) : managerSummary.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No team members have submitted logs for this date.
            </div>
          ) : (
            <div className="space-y-4">
              {managerSummary.map((item, idx) => (
                <div key={idx} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5 dark:border-slate-700">
                    <div>
                      <span className="font-bold text-xs text-slate-900 dark:text-white">{item.user?.name}</span>
                      <span className="ml-2 text-[11px] text-slate-400">({item.user?.role})</span>
                    </div>
                    <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-extrabold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                      Total: {item.totalHours} Hours
                    </span>
                  </div>

                  <div className="mt-2.5 space-y-1.5">
                    {item.logs?.map((l: any, lIdx: number) => (
                      <div key={lIdx} className="text-xs text-slate-600 dark:text-slate-300 flex items-center justify-between">
                        <span>&bull; {l.taskTitle} ({l.category})</span>
                        <span className="font-semibold">{l.hoursSpent}h</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: Fast Log Form */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Log Today&apos;s Work (Takes &lt; 2 Mins)
            </h3>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Work Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[#8B2424] dark:border-slate-700 dark:bg-slate-800 dark:text-white cursor-pointer"
                >
                  <option value="Planned task">Planned task</option>
                  <option value="Ad-hoc / Urgent">Ad-hoc / Urgent</option>
                  <option value="Meeting">Meeting</option>
                  <option value="Shoot / Production">Shoot / Production</option>
                  <option value="Learning / Research">Learning / Research</option>
                  <option value="Event Planning">Event Planning</option>
                  <option value="Other">Other</option>
                </select>

                {category === 'Other' && (
                  <div className="mt-2.5 space-y-1">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase">
                      Specify Category (Optional)
                    </label>
                    <input
                      type="text"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      placeholder="e.g. Client Onboarding, Brand Strategy, PR (Optional)"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-800 outline-none focus:border-[#8B2424] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    />
                    <p className="text-[10px] text-slate-400">
                      Agar blank chhodenge toh &apos;Other&apos; category save hogi.
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="e.g. Edited Diwali Reel & Designed Thumbnail"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-800 outline-none focus:border-[#8B2424] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Hours Spent (Hours)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="16"
                    required
                    value={hoursSpent}
                    onChange={(e) => setHoursSpent(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-800 outline-none focus:border-[#8B2424] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Status After Today</label>
                  <select
                    value={statusAfterToday}
                    onChange={(e) => setStatusAfterToday(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[#8B2424] dark:border-slate-700 dark:bg-slate-800 dark:text-white cursor-pointer"
                  >
                    <option value="Done">Done</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Blocked">Blocked</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Description *</label>
                <textarea
                  rows={2}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Summary of what was completed today..."
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 outline-none focus:border-[#8B2424] dark:border-slate-700 dark:bg-slate-950 dark:text-white resize-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Deliverable Link (Optional)</label>
                <input
                  type="url"
                  value={outputLink}
                  onChange={(e) => setOutputLink(e.target.value)}
                  placeholder="https://drive.google.com/... or Figma link"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-800 outline-none focus:border-[#8B2424] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-[#8B2424] px-4 py-2 text-xs font-bold text-white hover:bg-[#721c1c] disabled:opacity-50 transition cursor-pointer"
                >
                  {submitting ? 'Submitting...' : 'Submit Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
