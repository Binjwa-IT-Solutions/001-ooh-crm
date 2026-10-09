'use client';

import { useState, useEffect } from 'react';
import {
  Layers,
  Plus,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  Calendar,
  Filter,
} from 'lucide-react';
import { useAuth } from '@/shared/auth/auth-context';
import { marketingApi } from '../api';
import type { MarketingTaskItem } from '../types';

const STATUS_COLUMNS = [
  { key: 'To Do', label: 'To Do', color: 'border-slate-300 bg-slate-50' },
  { key: 'In Progress', label: 'In Progress', color: 'border-blue-300 bg-blue-50/40' },
  { key: 'In Review', label: 'In Review', color: 'border-amber-300 bg-amber-50/40' },
  { key: 'Done', label: 'Done', color: 'border-emerald-300 bg-emerald-50/40' },
] as const;

export default function TasksContentTab() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<MarketingTaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterContentOnly, setFilterContentOnly] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Task creation modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('Video Editing');
  const [priority, setPriority] = useState('Medium');
  const [dueDate, setDueDate] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [isContent, setIsContent] = useState(false);
  const [platform, setPlatform] = useState('Instagram');
  const [postUrl, setPostUrl] = useState('');
  const [city, setCity] = useState('All');

  const loadTasks = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await marketingApi.getTasks({
        isContent: filterContentOnly ? true : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      setTasks(res.data || []);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load marketing tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [filterContentOnly, statusFilter]);

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      setErrorMessage(null);
      await marketingApi.updateTaskStatus(taskId, newStatus);
      await loadTasks();
    } catch (err: any) {
      // Catch Anti-Incomplete / WIP limit error
      const msg = err.response?.data?.message || err.message || 'Failed to update task status';
      setErrorMessage(msg);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Please provide a task title');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);
      const targetAssignee = assignedTo.trim() || user?.id || '';
      await marketingApi.createTask({
        title,
        description,
        type,
        priority,
        dueDate: dueDate || undefined,
        assignedTo: targetAssignee,
        isContent,
        platform: isContent ? platform : undefined,
        postUrl: isContent && postUrl ? postUrl : undefined,
        city: city !== 'All' ? city : undefined,
      });

      setShowCreateModal(false);
      setTitle('');
      setDescription('');
      setPostUrl('');
      setIsContent(false);
      await loadTasks();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to create task';
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Group tasks by status for Kanban columns
  const getTasksForColumn = (columnStatus: string) => {
    if (columnStatus === 'To Do') {
      return tasks.filter((t) => t.status === 'To Do' || t.status === 'Backlog');
    }
    if (columnStatus === 'In Review') {
      return tasks.filter((t) => t.status === 'In Review' || t.status === 'Revision Needed');
    }
    return tasks.filter((t) => t.status === columnStatus);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            Marketing Work & Content Kanban
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Enforces Media Octus <strong className="text-indigo-600">Anti-Incomplete Rule</strong> (Max 3 In Progress per person) and tracks content deliverables.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Content toggle */}
          <button
            onClick={() => setFilterContentOnly(!filterContentOnly)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border flex items-center gap-1.5 transition ${
              filterContentOnly
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {filterContentOnly ? 'Content Only (Active)' : 'All Tasks'}
          </button>

          <button
            onClick={loadTasks}
            disabled={loading}
            className="p-2 text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg bg-white hover:bg-slate-50 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            Create Marketing Task
          </button>
        </div>
      </div>

      {/* Error or WIP Limit Banner */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border-l-4 border-rose-500 rounded-r-xl flex items-start gap-3 text-rose-800 text-sm animate-fadeIn">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Work-In-Progress (WIP) or Validation Notice</p>
            <p className="text-xs mt-0.5">{errorMessage}</p>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-xs text-rose-500 hover:text-rose-700 font-medium underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Kanban Board Columns */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {STATUS_COLUMNS.map((col) => {
          const colTasks = getTasksForColumn(col.key);
          return (
            <div
              key={col.key}
              className={`rounded-xl border ${col.color} p-3 min-h-[500px] flex flex-col`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200/60">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-800">{col.label}</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600">
                    {colTasks.length}
                  </span>
                </div>
                {col.key === 'In Progress' && (
                  <span className="text-[10px] text-indigo-700 font-semibold bg-indigo-100/70 px-1.5 py-0.5 rounded">
                    Max 3/user
                  </span>
                )}
              </div>

              {/* Column Tasks */}
              <div className="space-y-3 flex-1 overflow-y-auto">
                {colTasks.length === 0 ? (
                  <div className="text-center py-10 text-xs text-slate-400">
                    No tasks in {col.label.toLowerCase()}
                  </div>
                ) : (
                  colTasks.map((task) => (
                    <div
                      key={task._id}
                      className="bg-white p-3.5 rounded-lg border border-slate-200/80 shadow-xs hover:shadow-md transition space-y-2.5"
                    >
                      {/* Tags row */}
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                          {task.type}
                        </span>

                        <div className="flex items-center gap-1">
                          {task.priority === 'Urgent' && (
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">
                              URGENT
                            </span>
                          )}
                          {task.priority === 'High' && (
                            <span className="text-[10px] font-medium text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                              HIGH
                            </span>
                          )}
                          {task.staleAlert && (
                            <span
                              className="text-[10px] font-bold text-amber-800 bg-amber-200 px-1.5 py-0.5 rounded flex items-center gap-0.5"
                              title="Stale: >3 days without updates"
                            >
                              <AlertTriangle className="w-2.5 h-2.5" />
                              STALE
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Title & Description */}
                      <h4 className="text-xs font-bold text-slate-900 leading-snug">
                        {task.title}
                      </h4>
                      {task.description && (
                        <p className="text-[11px] text-slate-600 line-clamp-2">
                          {task.description}
                        </p>
                      )}

                      {/* Content specific meta */}
                      {task.isContent && (
                        <div className="p-2 bg-slate-50 rounded border border-slate-100 text-[11px] space-y-1">
                          <div className="flex items-center justify-between text-slate-600 font-medium">
                            <span>Platform: {task.platform || 'General'}</span>
                            {task.city && <span>City: {task.city}</span>}
                          </div>
                          {task.postUrl && (
                            <a
                              href={task.postUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-semibold truncate"
                            >
                              <ExternalLink className="w-3 h-3 shrink-0" />
                              View Post / Asset Link
                            </a>
                          )}
                        </div>
                      )}

                      {/* Assignee & Dates */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                        <span className="font-medium text-slate-700 truncate max-w-[110px]">
                          👤 {task.assignedTo?.name || 'Assigned'}
                        </span>
                        {task.dueDate && (
                          <span
                            className={`flex items-center gap-0.5 font-medium ${
                              task.isPastDue ? 'text-rose-600 font-bold' : ''
                            }`}
                          >
                            <Clock className="w-3 h-3" />
                            {task.dueDate.slice(5, 10)}
                          </span>
                        )}
                      </div>

                      {/* Quick Status Action Dropdown */}
                      <div className="pt-1 flex items-center justify-between gap-1">
                        <label className="text-[10px] font-semibold text-slate-400">Move:</label>
                        <select
                          value={task.status}
                          onChange={(e) => handleStatusChange(task._id, e.target.value)}
                          className="text-[11px] bg-slate-50 border border-slate-200 rounded px-2 py-0.5 font-medium text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                        >
                          <option value="To Do">To Do</option>
                          <option value="In Progress">In Progress (WIP)</option>
                          <option value="In Review">In Review</option>
                          <option value="Done">Done</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-600" />
                Create New Marketing Task
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Design 3 reels for Jaipur billboard festival"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description / Brief
                </label>
                <textarea
                  rows={2}
                  placeholder="Key messaging, guidelines, script or references..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Type *</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Video Editing">Video Editing</option>
                    <option value="Graphic Design">Graphic Design</option>
                    <option value="Copywriting">Copywriting</option>
                    <option value="Performance Ad">Performance Ad</option>
                    <option value="AI Content">AI Content</option>
                    <option value="Campaign Setup">Campaign Setup</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Assignee (Leave blank to assign to yourself)
                  </label>
                  <input
                    type="text"
                    placeholder={user?.name ? `Defaults to ${user.name}` : 'Assignee ID or self'}
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Content Specific toggle */}
              <div className="pt-2 border-t border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={isContent}
                    onChange={(e) => setIsContent(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    This is a published Content deliverable (Reel, Ad, Post, Carousel)
                  </span>
                </label>

                {isContent && (
                  <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Platform
                        </label>
                        <select
                          value={platform}
                          onChange={(e) => setPlatform(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="Instagram">Instagram</option>
                          <option value="LinkedIn">LinkedIn</option>
                          <option value="Facebook">Facebook</option>
                          <option value="YouTube">YouTube</option>
                          <option value="Google Ads">Google Ads</option>
                          <option value="Meta Ads">Meta Ads</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          City / Market
                        </label>
                        <select
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="All">All Markets</option>
                          <option value="Jaipur">Jaipur</option>
                          <option value="Delhi NCR">Delhi NCR</option>
                          <option value="Mumbai">Mumbai</option>
                          <option value="Bangalore">Bangalore</option>
                          <option value="Pune">Pune</option>
                          <option value="Hyderabad">Hyderabad</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Live Post URL or Google Drive Output
                      </label>
                      <input
                        type="url"
                        placeholder="https://instagram.com/reel/... or https://drive.google.com/..."
                        value={postUrl}
                        onChange={(e) => setPostUrl(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
                >
                  {submitting ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
