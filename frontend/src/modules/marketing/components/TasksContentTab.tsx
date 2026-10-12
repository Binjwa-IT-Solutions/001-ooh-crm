'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Layers,
  Plus,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  User,
  Users,
  ChevronDown,
  Check,
  Search,
  X,
  ClipboardCheck,
  History,
} from 'lucide-react';
import { useAuth } from '@/shared/auth/auth-context';
import { marketingApi } from '../api';
import type { MarketingTaskItem, MarketingTeamMember } from '../types';

const STATUS_COLUMNS = [
  { key: 'To Do', label: 'To Do', color: 'border-slate-300 bg-slate-50/70' },
  { key: 'In Progress', label: 'In Progress', color: 'border-blue-300 bg-blue-50/30' },
  { key: 'In Review', label: 'In Review', color: 'border-amber-300 bg-amber-50/30' },
  { key: 'Done', label: 'Done', color: 'border-emerald-300 bg-emerald-50/30' },
] as const;

function formatDueDate(dateStr?: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function TasksContentTab() {
  const { user } = useAuth();
  const userRole = (user?.role || '').toLowerCase();
  const isManagerOrAdmin = ['admin', 'superadmin', 'managing_director', 'manager'].includes(userRole);

  const [tasks, setTasks] = useState<MarketingTaskItem[]>([]);
  const [teamMembers, setTeamMembers] = useState<MarketingTeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterContentOnly, setFilterContentOnly] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showAllCompleted, setShowAllCompleted] = useState<boolean>(false);

  // Team Member Dropdown Filter ('all' | 'my' | memberId)
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string>('all');
  const [isTeamFilterOpen, setIsTeamFilterOpen] = useState<boolean>(false);
  const [teamFilterSearch, setTeamFilterSearch] = useState<string>('');
  const teamFilterRef = useRef<HTMLDivElement>(null);

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

  // Assignee searchable combobox state in modal
  const [isAssigneeDropdownOpen, setIsAssigneeDropdownOpen] = useState(false);
  const [assigneeSearchQuery, setAssigneeSearchQuery] = useState('');
  const comboboxRef = useRef<HTMLDivElement>(null);

  const loadTasks = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await marketingApi.getTasks({
        isContent: filterContentOnly ? true : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        assignedTo: !isManagerOrAdmin ? user?.id : undefined,
      });
      setTasks(res.data || []);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load marketing tasks');
    } finally {
      setLoading(false);
    }
  };

  const loadTeamMembers = async () => {
    try {
      const res = await marketingApi.getTeamMembers();
      const rawList = res.data || [];
      const nonMarketingRoles = ['sales_agent', 'ops', 'finance', 'hr'];
      const filtered = rawList.filter(
        (m) => !nonMarketingRoles.includes((m.role || '').toLowerCase())
      );
      setTeamMembers(filtered);
    } catch (err) {
      console.error('Failed to load team members:', err);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [filterContentOnly, statusFilter]);

  useEffect(() => {
    loadTeamMembers();
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (comboboxRef.current && !comboboxRef.current.contains(event.target as Node)) {
        setIsAssigneeDropdownOpen(false);
      }
      if (teamFilterRef.current && !teamFilterRef.current.contains(event.target as Node)) {
        setIsTeamFilterOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      setErrorMessage(null);
      await marketingApi.updateTaskStatus(taskId, newStatus);
      await loadTasks();
    } catch (err: any) {
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
      setAssignedTo('');
      setAssigneeSearchQuery('');
      await loadTasks();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to create task';
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered team members for modal combobox
  const filteredModalMembers = useMemo(() => {
    const q = assigneeSearchQuery.trim().toLowerCase();
    if (!q) return teamMembers;
    return teamMembers.filter((m) => {
      const matchName = m.name?.toLowerCase().includes(q);
      const matchRole = m.role?.toLowerCase().includes(q);
      const matchDesignation = m.designation?.toLowerCase().includes(q);
      const matchEmail = m.email?.toLowerCase().includes(q);
      return matchName || matchRole || matchDesignation || matchEmail;
    });
  }, [teamMembers, assigneeSearchQuery]);

  const selectedAssignee = useMemo(() => {
    if (!assignedTo) return null;
    return teamMembers.find((m) => m._id === assignedTo) || null;
  }, [teamMembers, assignedTo]);

  // Filtered members for toolbar dropdown
  const filteredToolbarMembers = useMemo(() => {
    const q = teamFilterSearch.trim().toLowerCase();
    if (!q) return teamMembers;
    return teamMembers.filter((m) => {
      const matchName = m.name?.toLowerCase().includes(q);
      const matchRole = m.role?.toLowerCase().includes(q);
      const matchDesignation = m.designation?.toLowerCase().includes(q);
      return matchName || matchRole || matchDesignation;
    });
  }, [teamMembers, teamFilterSearch]);

  // Active filter label
  const activeFilterMember = useMemo(() => {
    if (selectedMemberFilter === 'all') return null;
    if (selectedMemberFilter === 'my') return { name: 'My Tasks Only' };
    return teamMembers.find((m) => m._id === selectedMemberFilter) || null;
  }, [teamMembers, selectedMemberFilter]);

  // Count active tasks per member
  const memberTaskCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of tasks) {
      const id = t.assignedTo?._id;
      if (id) {
        counts[id] = (counts[id] || 0) + 1;
      }
    }
    return counts;
  }, [tasks]);

  // Count older completed tasks archived by 7-day rule
  const hiddenArchivedCount = useMemo(() => {
    let list = tasks;
    if (!isManagerOrAdmin) {
      list = list.filter((t) => t.assignedTo?._id === user?.id || t.assignedTo?.email === user?.email);
    } else if (selectedMemberFilter === 'my' && user?.id) {
      list = list.filter((t) => t.assignedTo?._id === user.id || t.assignedTo?.email === user.email);
    } else if (selectedMemberFilter !== 'all') {
      list = list.filter((t) => t.assignedTo?._id === selectedMemberFilter);
    }
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return list.filter((t) => {
      if (t.status !== 'Done') return false;
      const d = t.updatedAt || t.dueDate || t.createdAt;
      if (!d) return false;
      return new Date(d) < sevenDaysAgo;
    }).length;
  }, [tasks, selectedMemberFilter, isManagerOrAdmin, user]);

  // Group tasks by status for Kanban columns
  const getTasksForColumn = (columnStatus: string) => {
    let list = tasks;

    // 1. Assignee / Member Filter
    if (!isManagerOrAdmin) {
      // Normal marketing employee strictly sees ONLY their own assigned tasks
      list = list.filter((t) => t.assignedTo?._id === user?.id || t.assignedTo?.email === user?.email);
    } else if (selectedMemberFilter === 'my' && user?.id) {
      list = list.filter((t) => t.assignedTo?._id === user.id || t.assignedTo?.email === user.email);
    } else if (selectedMemberFilter !== 'all') {
      list = list.filter((t) => t.assignedTo?._id === selectedMemberFilter);
    }

    // 2. Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (t) =>
          t.title?.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          t.type?.toLowerCase().includes(q) ||
          t.platform?.toLowerCase().includes(q) ||
          t.assignedTo?.name?.toLowerCase().includes(q)
      );
    }

    if (columnStatus === 'To Do') {
      return list.filter((t) => t.status === 'To Do' || t.status === 'Backlog');
    }
    if (columnStatus === 'In Review') {
      return list.filter((t) => t.status === 'In Review' || t.status === 'Revision Needed');
    }
    if (columnStatus === 'Done') {
      const doneList = list.filter((t) => t.status === 'Done');
      if (showAllCompleted) {
        return doneList;
      }
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return doneList.filter((t) => {
        const d = t.updatedAt || t.dueDate || t.createdAt;
        if (!d) return true;
        return new Date(d) >= sevenDaysAgo;
      });
    }
    return list.filter((t) => t.status === columnStatus);
  };

  const emptyColumnMessages: Record<string, string> = {
    'To Do': 'No tasks in to-do',
    'In Progress': 'No tasks in progress',
    'In Review': 'No tasks under review',
    Done: 'No completed tasks yet',
  };

  return (
    <div className="space-y-5">
      {/* Kanban Board Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Title & Rule Note */}
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#8B2424]" />
              Marketing Deliverables &amp; Content Kanban
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Enforces Media Octus <strong className="text-[#8B2424]">Anti-Incomplete Rule</strong> (Max 3 In Progress per member) and tracks content deliverables.
            </p>
          </div>

          {/* Quick Search */}
          <div className="relative w-full lg:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search tasks, reels, assignees..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#8B2424] focus:bg-white transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Action Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            {/* Team Member Filter: Only for Managers and Admins */}
            {isManagerOrAdmin ? (
              <>
                <div className="relative" ref={teamFilterRef}>
                  <button
                    type="button"
                    onClick={() => setIsTeamFilterOpen(!isTeamFilterOpen)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border flex items-center gap-2 transition cursor-pointer ${
                      selectedMemberFilter !== 'all'
                        ? 'bg-[#F8E6E6] border-[#8B2424] text-[#8B2424] shadow-xs'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>
                      {selectedMemberFilter === 'all'
                        ? 'All Team Tasks'
                        : selectedMemberFilter === 'my'
                        ? '👤 My Tasks Only'
                        : `👤 ${activeFilterMember?.name || 'Member'}`}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                  </button>

                  {/* Dropdown Menu */}
                  {isTeamFilterOpen && (
                    <div className="absolute z-30 left-0 mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 space-y-1 animate-fadeIn">
                      <div className="p-1 border-b border-slate-100">
                        <input
                          type="text"
                          autoFocus
                          placeholder="Search member..."
                          value={teamFilterSearch}
                          onChange={(e) => setTeamFilterSearch(e.target.value)}
                          className="w-full px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#8B2424]"
                        />
                      </div>

                      {/* Quick Preset: All Team Tasks */}
                      <div
                        onClick={() => {
                          setSelectedMemberFilter('all');
                          setIsTeamFilterOpen(false);
                        }}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer text-xs transition ${
                          selectedMemberFilter === 'all'
                            ? 'bg-[#F8E6E6] text-[#8B2424] font-bold'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5" />
                          All Team Tasks
                        </span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          {tasks.length} total
                        </span>
                      </div>

                      {/* Quick Preset: My Tasks Only */}
                      {user?.id && (
                        <div
                          onClick={() => {
                            setSelectedMemberFilter('my');
                            setIsTeamFilterOpen(false);
                          }}
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer text-xs transition ${
                            selectedMemberFilter === 'my'
                              ? 'bg-[#F8E6E6] text-[#8B2424] font-bold'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <span className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5" />
                            My Tasks Only
                          </span>
                          {selectedMemberFilter === 'my' && (
                            <Check className="w-3.5 h-3.5 text-[#8B2424]" />
                          )}
                        </div>
                      )}

                      <div className="my-1 border-t border-slate-100 px-2 py-0.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Marketing Team
                        </span>
                      </div>

                      <div className="max-h-48 overflow-y-auto space-y-0.5">
                        {filteredToolbarMembers.length === 0 ? (
                          <div className="text-center py-2 text-xs text-slate-400">
                            No members found
                          </div>
                        ) : (
                          filteredToolbarMembers.map((member) => (
                            <div
                              key={member._id}
                              onClick={() => {
                                setSelectedMemberFilter(member._id);
                                setIsTeamFilterOpen(false);
                              }}
                              className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer text-xs transition ${
                                selectedMemberFilter === member._id
                                  ? 'bg-[#F8E6E6] text-[#8B2424] font-bold'
                                  : 'hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <div className="truncate mr-2">
                                <p className="truncate font-medium">{member.name}</p>
                                <p className="text-[10px] text-slate-400 truncate">
                                  {member.designation || member.role}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {memberTaskCounts[member._id] ? (
                                  <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded-full font-semibold">
                                    {memberTaskCounts[member._id]}
                                  </span>
                                ) : null}
                                {selectedMemberFilter === member._id && (
                                  <Check className="w-3.5 h-3.5 text-[#8B2424]" />
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Clear Filter Chip if filtered */}
                {selectedMemberFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setSelectedMemberFilter('all')}
                    className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                    title="Reset to All"
                  >
                    <X className="w-3 h-3" />
                    <span>Reset filter</span>
                  </button>
                )}
              </>
            ) : (
              /* Normal Employee View: Fixed to their own tasks */
              <div className="px-3 py-1.5 text-xs font-semibold rounded-lg border bg-[#F8E6E6] border-[#8B2424]/30 text-[#8B2424] flex items-center gap-1.5 shadow-2xs">
                <User className="w-3.5 h-3.5" />
                <span>My Assigned Tasks</span>
              </div>
            )}

            {/* Content Format Toggle */}
            <button
              type="button"
              onClick={() => setFilterContentOnly(!filterContentOnly)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border flex items-center gap-1.5 transition cursor-pointer ${
                filterContentOnly
                  ? 'bg-[#F8E6E6] border-[#8B2424] text-[#8B2424]'
                  : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{filterContentOnly ? 'Content Deliverables Only' : 'All Formats'}</span>
            </button>

            {/* Completed Tasks 7-Day Auto-Filter Toggle */}
            <button
              type="button"
              onClick={() => setShowAllCompleted(!showAllCompleted)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border flex items-center gap-1.5 transition cursor-pointer ${
                showAllCompleted
                  ? 'bg-[#F8E6E6] border-[#8B2424] text-[#8B2424] font-bold'
                  : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
              title={
                showAllCompleted
                  ? 'Showing all completed tasks history'
                  : 'Done column shows tasks completed in last 7 days. Click to view all.'
              }
            >
              <History className="w-3.5 h-3.5 text-[#8B2424]" />
              <span>{showAllCompleted ? 'All Completed Tasks' : 'Recent Done (7D)'}</span>
              {hiddenArchivedCount > 0 && !showAllCompleted && (
                <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded-full font-semibold">
                  +{hiddenArchivedCount}
                </span>
              )}
            </button>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadTasks}
              disabled={loading}
              className="p-2 text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg bg-white hover:bg-slate-50 transition cursor-pointer"
              title="Refresh Kanban"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={() => {
                if (!assignedTo && user?.id) {
                  setAssignedTo(user.id);
                }
                setShowCreateModal(true);
              }}
              className="px-3.5 py-1.5 bg-[#8B2424] hover:bg-[#721c1c] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Marketing Task</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error or WIP Limit Banner */}
      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border-l-4 border-rose-500 rounded-r-xl flex items-start gap-3 text-rose-800 text-sm animate-fadeIn">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-xs">Work-In-Progress (WIP) or Validation Notice</p>
            <p className="text-xs mt-0.5">{errorMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-xs text-rose-500 hover:text-rose-700 font-medium underline cursor-pointer"
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
              className={`rounded-xl border ${col.color} p-3 min-h-[520px] flex flex-col`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-200/60">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs uppercase tracking-wider text-slate-800">
                    {col.label}
                  </span>
                  <span className="text-[11px] font-semibold px-2 py-0.2 rounded-full bg-white border border-slate-200 text-slate-600">
                    {colTasks.length}
                  </span>
                </div>
                {col.key === 'In Progress' && (
                  <span className="text-[10px] text-blue-700 font-semibold bg-blue-100/80 px-1.5 py-0.5 rounded">
                    Max 3/person
                  </span>
                )}
                {col.key === 'Done' && (
                  <button
                    type="button"
                    onClick={() => setShowAllCompleted((prev) => !prev)}
                    className={`text-[10px] px-2 py-0.5 rounded transition flex items-center gap-1 cursor-pointer font-semibold ${
                      showAllCompleted
                        ? 'bg-[#8B2424] text-white shadow-2xs'
                        : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                    }`}
                    title={
                      showAllCompleted
                        ? 'Showing all completed tasks history. Click to show last 7 days.'
                        : 'Showing last 7 days only. Click to show all completed history.'
                    }
                  >
                    <span>{showAllCompleted ? 'All Time' : 'Last 7 Days'}</span>
                  </button>
                )}
              </div>

              {/* Column Tasks */}
              <div className="space-y-3 flex-1 overflow-y-auto">
                {colTasks.length === 0 ? (
                  <div className="text-center py-16 px-4 flex flex-col items-center justify-center text-slate-400">
                    <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center mb-2 text-slate-300">
                      <ClipboardCheck className="w-4 h-4" />
                    </div>
                    <p className="text-xs font-medium text-slate-500">
                      {emptyColumnMessages[col.key] || 'No tasks'}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Tasks will appear here automatically
                    </p>
                  </div>
                ) : (
                  colTasks.map((task) => (
                    <div
                      key={task._id}
                      className="bg-white p-3.5 rounded-lg border border-slate-200/80 shadow-xs hover:shadow-md transition space-y-2.5"
                    >
                      {/* Tags row */}
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] font-semibold text-[#8B2424] bg-[#F8E6E6] px-2 py-0.5 rounded border border-[#8B2424]/20">
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
                              className="text-[#8B2424] hover:text-[#721c1c] flex items-center gap-1 font-semibold truncate"
                            >
                              <ExternalLink className="w-3 h-3 shrink-0" />
                              View Post / Asset Link
                            </a>
                          )}
                        </div>
                      )}

                      {/* Assignee & Delegated By Info */}
                      <div className="pt-2 border-t border-slate-100 space-y-1 text-[11px]">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="text-slate-400 text-[10px]">To:</span>
                            <span className="font-bold text-slate-800 truncate" title={task.assignedTo?.name}>
                              👤 {task.assignedTo?.name || 'Unassigned'}
                            </span>
                            {task.assignedTo?.role && (
                              <span className="text-[9px] uppercase px-1 py-0.2 bg-slate-100 text-slate-600 rounded font-semibold shrink-0">
                                {task.assignedTo.role}
                              </span>
                            )}
                          </div>
                          {task.dueDate && (
                            <span
                              className={`flex items-center gap-1 font-medium shrink-0 text-[11px] ${
                                task.isPastDue ? 'text-rose-600 font-bold' : 'text-slate-500'
                              }`}
                              title={`Due Date: ${task.dueDate}`}
                            >
                              <Clock className="w-3 h-3" />
                              {formatDueDate(task.dueDate)}
                            </span>
                          )}
                        </div>

                        {/* Assigned By line */}
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                          <span className="truncate">
                            ✍️ <span className="text-slate-400">By:</span>{' '}
                            <strong className="text-slate-700 font-medium">
                              {task.assignedBy?.name ? (
                                task.assignedBy.name === task.assignedTo?.name ? 'Self' : task.assignedBy.name
                              ) : 'Admin'}
                            </strong>
                            {task.assignedBy?.role && task.assignedBy.name !== task.assignedTo?.name && (
                              <span className="text-[9px] text-slate-400 ml-1">({task.assignedBy.role})</span>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Workflow Actions Based on Column */}
                      {task.status === 'In Review' && (
                        <div className="p-2 rounded-lg bg-amber-50/70 border border-amber-200/80 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-amber-800">
                            <span>Under Review</span>
                            {isManagerOrAdmin ? (
                              <span className="text-[9px] bg-amber-200/80 text-amber-900 px-1.5 py-0.5 rounded font-bold">
                                Action Needed
                              </span>
                            ) : (
                              <span className="text-[9px] text-amber-600">Pending Manager</span>
                            )}
                          </div>
                          {isManagerOrAdmin && (
                            <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                              <button
                                type="button"
                                onClick={() => handleStatusChange(task._id, 'Done')}
                                className="flex items-center justify-center gap-1 py-1 px-2 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded transition cursor-pointer"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                Approve (Done)
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStatusChange(task._id, 'In Progress')}
                                className="flex items-center justify-center gap-1 py-1 px-2 text-[10px] font-bold bg-amber-600 hover:bg-amber-700 text-white rounded transition cursor-pointer"
                              >
                                <RefreshCw className="w-3 h-3" />
                                Needs Revision
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {task.status === 'To Do' && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(task._id, 'In Progress')}
                          className="w-full flex items-center justify-center gap-1 py-1 px-2 text-[11px] font-semibold border border-blue-200 bg-blue-50/60 hover:bg-blue-100 text-blue-700 rounded transition cursor-pointer"
                        >
                          <span>▶ Start Task</span>
                        </button>
                      )}

                      {task.status === 'In Progress' && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(task._id, 'In Review')}
                          className="w-full flex items-center justify-center gap-1 py-1 px-2 text-[11px] font-semibold border border-amber-200 bg-amber-50/60 hover:bg-amber-100 text-amber-800 rounded transition cursor-pointer"
                        >
                          <span>📤 Submit for Review</span>
                        </button>
                      )}

                      {/* Completed State Display for Done Column */}
                      {task.status === 'Done' ? (
                        <div className="pt-1 flex items-center justify-between text-[11px]">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Completed
                          </span>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(task._id, 'In Progress')}
                            className="text-[10px] text-slate-400 hover:text-slate-700 underline cursor-pointer"
                            title="Reopen this task"
                          >
                            Reopen
                          </button>
                        </div>
                      ) : (
                        /* Flexible status selector for non-done tasks */
                        <div className="pt-1 flex items-center justify-between gap-1">
                          <label className="text-[10px] font-semibold text-slate-400">Move:</label>
                          <select
                            value={task.status}
                            onChange={(e) => handleStatusChange(task._id, e.target.value)}
                            className="text-[11px] bg-slate-50 border border-slate-200 rounded px-2 py-0.5 font-medium text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-1 focus:ring-[#8B2424] cursor-pointer"
                          >
                            <option value="To Do">To Do</option>
                            <option value="In Progress">In Progress (WIP)</option>
                            <option value="In Review">In Review</option>
                            <option value="Done">Done</option>
                            <option value="Cancelled">Cancelled</option>
                          </select>
                        </div>
                      )}
                    </div>
                  ))
                )}

                {/* Indicator for older archived tasks in Done column */}
                {col.key === 'Done' && !showAllCompleted && hiddenArchivedCount > 0 && (
                  <div className="pt-2 text-center border-t border-slate-200/60 mt-1">
                    <button
                      type="button"
                      onClick={() => setShowAllCompleted(true)}
                      className="text-[11px] text-slate-500 hover:text-[#8B2424] hover:underline font-semibold cursor-pointer inline-flex items-center gap-1.5 py-1 px-2 rounded-md hover:bg-slate-50 transition"
                    >
                      <History className="w-3.5 h-3.5 text-[#8B2424]" />
                      <span>+ {hiddenArchivedCount} older completed {hiddenArchivedCount === 1 ? 'task' : 'tasks'} archived (View All)</span>
                    </button>
                  </div>
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
                <Plus className="w-5 h-5 text-[#8B2424]" />
                Create New Marketing Task
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer"
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
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B2424]"
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
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B2424]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Type *</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B2424]"
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
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B2424]"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>

              {/* Searchable Assignee Dropdown Combobox */}
              <div className="relative" ref={comboboxRef}>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Assignee (Team Member) *
                  </label>
                  {user?.id && (
                    <button
                      type="button"
                      onClick={() => {
                        setAssignedTo(user.id);
                        setIsAssigneeDropdownOpen(false);
                      }}
                      className="text-[11px] text-[#8B2424] hover:underline font-semibold cursor-pointer"
                    >
                      Assign to Myself
                    </button>
                  )}
                </div>

                {/* Combobox Trigger */}
                <div
                  onClick={() => setIsAssigneeDropdownOpen(!isAssigneeDropdownOpen)}
                  className="flex items-center justify-between w-full px-3 py-2 text-sm border border-slate-300 rounded-lg cursor-pointer bg-white hover:border-[#8B2424] transition focus-within:ring-2 focus-within:ring-[#8B2424]"
                >
                  <div className="flex items-center gap-2 truncate">
                    <User className="w-4 h-4 text-slate-400 shrink-0" />
                    {selectedAssignee ? (
                      <span className="font-medium text-slate-900 truncate">
                        {selectedAssignee.name}{' '}
                        <span className="text-xs text-slate-500 font-normal">
                          ({selectedAssignee.designation || selectedAssignee.role})
                        </span>
                      </span>
                    ) : (
                      <span className="text-slate-400">Select team member to assign...</span>
                    )}
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                </div>

                {/* Dropdown Menu with Search */}
                {isAssigneeDropdownOpen && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl p-2 max-h-64 overflow-y-auto space-y-1">
                    <div className="relative mb-2">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        autoFocus
                        placeholder="Search by name, role or designation..."
                        value={assigneeSearchQuery}
                        onChange={(e) => setAssigneeSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#8B2424]"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>

                    {filteredModalMembers.length === 0 ? (
                      <div className="text-center py-4 text-xs text-slate-400">
                        No team members found
                      </div>
                    ) : (
                      filteredModalMembers.map((member) => (
                        <div
                          key={member._id}
                          onClick={() => {
                            setAssignedTo(member._id);
                            setIsAssigneeDropdownOpen(false);
                          }}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition text-xs ${
                            assignedTo === member._id
                              ? 'bg-[#F8E6E6] text-[#8B2424] font-semibold'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div>
                            <p className="font-semibold text-slate-900">{member.name}</p>
                            <p className="text-[10px] text-slate-400">
                              {member.designation ? `${member.designation} • ` : ''}
                              {member.role} • {member.email}
                            </p>
                          </div>
                          {assignedTo === member._id && (
                            <Check className="w-4 h-4 text-[#8B2424] shrink-0" />
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B2424]"
                />
              </div>

              {/* Content Specific toggle */}
              <div className="pt-2 border-t border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={isContent}
                    onChange={(e) => setIsContent(e.target.checked)}
                    className="w-4 h-4 text-[#8B2424] rounded border-slate-300 focus:ring-[#8B2424]"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    This is a published Content deliverable (Reel, Ad, Post, Carousel)
                  </span>
                </label>

                {isContent && (
                  <div className="p-3 bg-[#F8E6E6]/40 rounded-xl border border-[#8B2424]/20 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Platform
                        </label>
                        <select
                          value={platform}
                          onChange={(e) => setPlatform(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#8B2424]"
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
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#8B2424]"
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
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#8B2424]"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[#8B2424] hover:bg-[#721c1c] text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
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
