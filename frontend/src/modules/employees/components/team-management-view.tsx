'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  Users,
  Plus,
  Search,
  ChevronRight,
  ShieldCheck,
  Mail,
  Building2,
  Calendar,
  AlertCircle,
  Pencil,
  Trash2,
  UserX,
  Briefcase,
  Layers,
  Phone,
  ArrowRight,
  ExternalLink,
  TrendingUp,
  CheckCircle2,
  Clock,
  MapPin,
  Filter,
  Check,
  X,
  FileText,
} from 'lucide-react';

import { useAuth } from '@/shared/auth/auth-context';
import { Alert, Button, Card, EmptyState, Modal, SelectField, Spinner } from '@/shared/ui';
import { toErrorMessage } from '@/shared/api/errors';

import { employeesApi } from '@/modules/employees/api';
import { formatDate, initials } from '@/modules/employees/format';
import type {
  Employee,
  ManagerOption,
  ManagerTeamsGroup,
  MemberCrmSummaryResponse,
  TeamDto,
  TeamHierarchyResponse,
  TeamMember,
} from '@/modules/employees/types';

function formatRupees(amount?: number): string {
  if (amount === undefined || amount === null) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

interface TeamManagementViewProps {
  onNavigateToUserCreation?: () => void;
}

export function TeamManagementView({ onNavigateToUserCreation }: TeamManagementViewProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';

  const [data, setData] = useState<TeamHierarchyResponse | null>(null);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [managerOptions, setManagerOptions] = useState<ManagerOption[]>([]);
  const [selectedManagerId, setSelectedManagerId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Member CRM Overview Modal state
  const [crmSummaryModalOpen, setCrmSummaryModalOpen] = useState(false);
  const [crmSummaryEmployee, setCrmSummaryEmployee] = useState<Employee | null>(null);
  const [crmSummaryData, setCrmSummaryData] = useState<MemberCrmSummaryResponse | null>(null);
  const [isLoadingCrmSummary, setIsLoadingCrmSummary] = useState(false);
  const [crmSummaryError, setCrmSummaryError] = useState<string | null>(null);
  const [crmActiveTab, setCrmActiveTab] = useState<'leads' | 'tasks' | 'attendance'>('leads');
  const [crmLeadStatusFilter, setCrmLeadStatusFilter] = useState<string>('ALL');
  const [crmLeadSearch, setCrmLeadSearch] = useState<string>('');

  // Create Team Modal state
  const [createTeamModalOpen, setCreateTeamModalOpen] = useState(false);
  const [createTeamManagerId, setCreateTeamManagerId] = useState<string>('');
  const [createTeamName, setCreateTeamName] = useState('');
  const [createTeamDescription, setCreateTeamDescription] = useState('');
  const [isSavingCreateTeam, setIsSavingCreateTeam] = useState(false);
  const [createTeamFeedback, setCreateTeamFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  // Edit Team Modal state
  const [editTeamModalOpen, setEditTeamModalOpen] = useState(false);
  const [targetTeam, setTargetTeam] = useState<TeamDto | null>(null);
  const [editTeamName, setEditTeamName] = useState('');
  const [editTeamDescription, setEditTeamDescription] = useState('');
  const [isSavingEditTeam, setIsSavingEditTeam] = useState(false);
  const [editTeamFeedback, setEditTeamFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  // Add Member Modal state
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);
  const [addMemberTeam, setAddMemberTeam] = useState<TeamDto | null>(null);
  const [selectedEmployeeIdToAdd, setSelectedEmployeeIdToAdd] = useState('');
  const [isSavingAddMember, setIsSavingAddMember] = useState(false);
  const [addMemberFeedback, setAddMemberFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  // Reassign Member Between Teams Modal state
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [reassignMember, setReassignMember] = useState<Employee | null>(null);
  const [reassignSourceTeamId, setReassignSourceTeamId] = useState<string>('');
  const [reassignTargetTeamId, setReassignTargetTeamId] = useState<string>('');
  const [reassignAvailableTeams, setReassignAvailableTeams] = useState<TeamDto[]>([]);
  const [isSavingReassign, setIsSavingReassign] = useState(false);
  const [reassignFeedback, setReassignFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [hierarchyRes, managersRes, employeesRes] = await Promise.all([
        employeesApi.teams(isManager ? undefined : selectedManagerId || undefined),
        employeesApi.managerOptions().catch(() => [] as ManagerOption[]),
        employeesApi.list({ pageSize: 100 }).catch(() => ({ employees: [] })),
      ]);
      setData(hierarchyRes);
      setManagerOptions(managersRes);
      setAllEmployees(employeesRes.employees);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [isManager, selectedManagerId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open Member CRM Summary Modal
  const openMemberCrmSummary = async (
    member: Employee,
    initialTab: 'leads' | 'tasks' | 'attendance' = 'leads',
  ) => {
    setCrmSummaryEmployee(member);
    setCrmSummaryData(null);
    setCrmSummaryError(null);
    setCrmActiveTab(initialTab);
    setCrmLeadStatusFilter('ALL');
    setCrmLeadSearch('');
    setCrmSummaryModalOpen(true);
    setIsLoadingCrmSummary(true);

    try {
      const summary = await employeesApi.getMemberCrmSummary(member.id);
      setCrmSummaryData(summary);
    } catch (err) {
      setCrmSummaryError(toErrorMessage(err));
    } finally {
      setIsLoadingCrmSummary(false);
    }
  };

  // Open Create Team Modal
  const openCreateTeamModal = (managerId?: string) => {
    setCreateTeamManagerId(managerId || selectedManagerId || '');
    setCreateTeamName('');
    setCreateTeamDescription('');
    setCreateTeamFeedback(null);
    setCreateTeamModalOpen(true);
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTeamName.trim()) return;

    setIsSavingCreateTeam(true);
    setCreateTeamFeedback(null);

    try {
      await employeesApi.createTeam({
        name: createTeamName.trim(),
        description: createTeamDescription.trim(),
        managerId: isAdmin && createTeamManagerId ? createTeamManagerId : undefined,
      });
      setCreateTeamFeedback({ tone: 'success', message: 'Team created successfully.' });
      setTimeout(() => {
        setCreateTeamModalOpen(false);
        loadData();
      }, 500);
    } catch (err) {
      setCreateTeamFeedback({ tone: 'error', message: toErrorMessage(err) });
    } finally {
      setIsSavingCreateTeam(false);
    }
  };

  // Open Edit Team Modal
  const openEditTeamModal = (team: TeamDto) => {
    setTargetTeam(team);
    setEditTeamName(team.name);
    setEditTeamDescription(team.description || '');
    setEditTeamFeedback(null);
    setEditTeamModalOpen(true);
  };

  const handleEditTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetTeam || !editTeamName.trim()) return;

    setIsSavingEditTeam(true);
    setEditTeamFeedback(null);

    try {
      await employeesApi.updateTeam(targetTeam.id, {
        name: editTeamName.trim(),
        description: editTeamDescription.trim(),
      });
      setEditTeamFeedback({ tone: 'success', message: 'Team updated successfully.' });
      setTimeout(() => {
        setEditTeamModalOpen(false);
        loadData();
      }, 500);
    } catch (err) {
      setEditTeamFeedback({ tone: 'error', message: toErrorMessage(err) });
    } finally {
      setIsSavingEditTeam(false);
    }
  };

  // Delete Team
  const handleDeleteTeam = async (team: TeamDto) => {
    if (
      !confirm(
        `Are you sure you want to delete team "${team.name}"? Members will not be deleted, and their employee profiles and reporting hierarchy will remain intact.`
      )
    ) {
      return;
    }

    try {
      await employeesApi.deleteTeam(team.id);
      loadData();
    } catch (err) {
      alert(toErrorMessage(err));
    }
  };

  // Open Add Member Modal for a Team
  const openAddMemberModal = (team: TeamDto) => {
    setAddMemberTeam(team);
    setSelectedEmployeeIdToAdd('');
    setAddMemberFeedback(null);
    setAddMemberModalOpen(true);
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addMemberTeam || !selectedEmployeeIdToAdd) return;

    setIsSavingAddMember(true);
    setAddMemberFeedback(null);

    try {
      await employeesApi.addMemberToTeam(addMemberTeam.id, selectedEmployeeIdToAdd);
      setAddMemberFeedback({ tone: 'success', message: 'Member added to team successfully.' });
      setTimeout(() => {
        setAddMemberModalOpen(false);
        loadData();
      }, 500);
    } catch (err) {
      setAddMemberFeedback({ tone: 'error', message: toErrorMessage(err) });
    } finally {
      setIsSavingAddMember(false);
    }
  };

  // Remove Member from Team
  const handleRemoveMember = async (team: TeamDto, member: Employee) => {
    if (
      !confirm(
        `Are you sure you want to remove "${member.fullName}" from "${team.name}"? This will only remove team membership and will NOT change their reporting manager.`
      )
    ) {
      return;
    }

    try {
      await employeesApi.removeMemberFromTeam(team.id, member.id);
      loadData();
    } catch (err) {
      alert(toErrorMessage(err));
    }
  };

  // Open Reassign Member Between Teams Modal
  const openReassignModal = (member: Employee, currentTeam: TeamDto, managerTeams: TeamDto[]) => {
    setReassignMember(member);
    setReassignSourceTeamId(currentTeam.id);
    setReassignAvailableTeams(managerTeams);
    const firstOther = managerTeams.find((t) => t.id !== currentTeam.id);
    setReassignTargetTeamId(firstOther ? firstOther.id : '');
    setReassignFeedback(null);
    setReassignModalOpen(true);
  };

  const handleReassign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassignMember || !reassignTargetTeamId) return;

    setIsSavingReassign(true);
    setReassignFeedback(null);

    try {
      await employeesApi.reassignTeamMember({
        sourceTeamId: reassignSourceTeamId,
        targetTeamId: reassignTargetTeamId,
        employeeId: reassignMember.id,
      });
      setReassignFeedback({ tone: 'success', message: 'Team member reassigned successfully.' });
      setTimeout(() => {
        setReassignModalOpen(false);
        loadData();
      }, 500);
    } catch (err) {
      setReassignFeedback({ tone: 'error', message: toErrorMessage(err) });
    } finally {
      setIsSavingReassign(false);
    }
  };

  // Derive manager groups
  const managerGroups: ManagerTeamsGroup[] =
    data?.managers && data.managers.length > 0
      ? data.managers
      : data?.teams
      ? [
          {
            manager: data.teams[0]?.manager,
            teams: data.teams.map((t) => ({
              id: t.id || t.manager.id,
              name: t.teamName,
              description: t.description,
              managerId: t.manager.id,
              manager: t.manager,
              members: t.members,
              memberCount: t.members.length,
              summary: t.summary,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })),
          },
        ].filter((g) => Boolean(g.manager))
      : [];

  // Filter manager groups & teams based on search query
  const filteredManagerGroups = managerGroups
    .map((group) => {
      if (!searchQuery.trim()) return group;
      const q = searchQuery.toLowerCase();
      const managerMatches =
        group.manager.fullName.toLowerCase().includes(q) ||
        group.manager.employeeCode.toLowerCase().includes(q) ||
        group.manager.department.toLowerCase().includes(q);

      const filteredTeams = group.teams
        .map((team) => {
          const teamNameMatches = team.name.toLowerCase().includes(q) || (team.description || '').toLowerCase().includes(q);
          const filteredMembers = team.members.filter(
            (m) =>
              m.fullName.toLowerCase().includes(q) ||
              m.employeeCode.toLowerCase().includes(q) ||
              m.designation.toLowerCase().includes(q) ||
              m.department.toLowerCase().includes(q)
          );
          if (teamNameMatches) return team;
          if (filteredMembers.length > 0) return { ...team, members: filteredMembers, memberCount: filteredMembers.length };
          return null;
        })
        .filter((t): t is TeamDto => t !== null);

      if (managerMatches) return group;
      if (filteredTeams.length > 0) return { ...group, teams: filteredTeams };
      return null;
    })
    .filter((g): g is ManagerTeamsGroup => g !== null);

  // Eligible employees for Add Member modal (all active employees not already in target team)
  const eligibleEmployeesForAdd = allEmployees.filter((emp) => {
    if (!addMemberTeam) return false;
    const isAlreadyMember = addMemberTeam.members.some((m) => m.id === emp.id);
    return !isAlreadyMember && emp.status === 'Active';
  });

  return (
    <div className="space-y-6">
      {/* Top Filter and Actions Toolbar */}
      <Card className="p-4 sm:p-5 border border-[#E6E8EC] shadow-sm bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            {/* Admin: Manager Filter */}
            {isAdmin && (
              <div className="w-full sm:w-64">
                <SelectField
                  label=""
                  options={[
                    { value: '', label: 'All Managers' },
                    ...managerOptions.map((m) => ({
                      value: m.id,
                      label: `${m.fullName} (${m.employeeCode})`,
                    })),
                  ]}
                  value={selectedManagerId}
                  onChange={(e) => setSelectedManagerId(e.target.value)}
                />
              </div>
            )}

            {/* Search Input */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="search"
                placeholder={isManager ? 'Search teams, members, designations…' : 'Search managers, teams, members…'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#6E1D1D]"
              />
            </div>

            {(selectedManagerId || searchQuery) && (
              <Button
                variant="secondary"
                onClick={() => {
                  setSelectedManagerId('');
                  setSearchQuery('');
                }}
                className="h-10 text-xs"
              >
                Reset
              </Button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 shrink-0">
            {(isManager || isAdmin) && (
              <Button
                onClick={() => openCreateTeamModal()}
                className="h-10 text-xs bg-[#6E1D1D] hover:bg-[#882424] text-white flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="h-4 w-4" />
                <span>Create Team</span>
              </Button>
            )}

            {isAdmin && onNavigateToUserCreation && (
              <Button variant="secondary" onClick={onNavigateToUserCreation} className="h-10 text-xs text-slate-700">
                Create User
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Error state */}
      {error && (
        <Alert tone="error" title="Could not load teams">
          <p>{error}</p>
          <div className="mt-3">
            <Button variant="secondary" onClick={loadData} className="h-9 px-3">
              Try again
            </Button>
          </div>
        </Alert>
      )}

      {/* Loading state */}
      {isLoading && !data && (
        <Card className="p-12 border border-[#E6E8EC]">
          <div className="flex justify-center">
            <Spinner label="Loading team structure…" />
          </div>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredManagerGroups.length === 0 && (
        <EmptyState
          title="No teams found"
          description={
            selectedManagerId || searchQuery
              ? 'No teams or members match your current filter criteria.'
              : isManager
              ? 'You have not created any teams yet. Click "+ Create Team" to get started.'
              : 'No manager teams have been created yet.'
          }
          action={
            selectedManagerId || searchQuery ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setSelectedManagerId('');
                  setSearchQuery('');
                }}
              >
                Clear Filters
              </Button>
            ) : isManager || isAdmin ? (
              <Button onClick={() => openCreateTeamModal()} className="bg-[#6E1D1D] text-white">
                + Create Team
              </Button>
            ) : undefined
          }
        />
      )}

      {/* Manager Hierarchy & Multiple Teams UI */}
      {!isLoading && filteredManagerGroups.length > 0 && (
        <div className="space-y-8">
          {filteredManagerGroups.map((group) => (
            <div key={group.manager.id} className="space-y-4">
              {/* Manager Header Banner */}
              <div className="bg-white rounded-xl border border-[#E6E8EC] p-4 sm:p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#6E1D1D] text-sm font-bold text-white shadow-sm">
                    {initials(group.manager.fullName)}
                  </span>
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h2 className="text-base sm:text-lg font-bold text-slate-900">{group.manager.fullName}</h2>
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                        <ShieldCheck className="h-3.5 w-3.5 text-[#6E1D1D]" />
                        Manager
                      </span>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span>{group.manager.employeeCode}</span>
                      <span>•</span>
                      <span>{group.manager.designation || 'Manager'}</span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {group.manager.department}
                      </span>
                      {group.manager.workEmail && (
                        <>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {group.manager.workEmail}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-xs font-medium text-slate-500">Named Teams</span>
                    <p className="text-base font-bold text-[#6E1D1D]">
                      {group.teams.length} {group.teams.length === 1 ? 'team' : 'teams'}
                    </p>
                  </div>

                  {(isManager || isAdmin) && (
                    <Button
                      onClick={() => openCreateTeamModal(group.manager.id)}
                      className="h-9 px-3 text-xs bg-[#6E1D1D] hover:bg-[#882424] text-white flex items-center gap-1.5 shadow-sm"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Create Team</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Multiple Named Teams Cards */}
              {group.teams.length > 0 && (
                <div className="space-y-4 pl-0 sm:pl-4">
                  {group.teams.map((team) => (
                    <Card key={team.id} className="p-0 overflow-hidden border border-[#E6E8EC] shadow-sm bg-white">
                      {/* Team Card Header */}
                      <div className="bg-[#FAFAFA] border-b border-[#E6E8EC] px-5 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F8E6E6] text-xs font-bold text-[#6E1D1D]">
                            <Users className="h-4 w-4" />
                          </span>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-sm sm:text-base font-bold text-slate-900">{team.name}</h3>
                              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                {team.members.length} {team.members.length === 1 ? 'member' : 'members'}
                              </span>
                            </div>
                            {team.description && <p className="text-xs text-slate-500 mt-0.5">{team.description}</p>}
                          </div>
                        </div>

                        {/* Team Actions: Add Member, Edit Name, Delete Team */}
                        <div className="flex items-center gap-2">
                          <Button
                            variant="secondary"
                            onClick={() => openAddMemberModal(team)}
                            className="h-8 px-2.5 text-xs text-[#6E1D1D] border-[#6E1D1D]/30 hover:bg-[#F8E6E6]"
                          >
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Add Member
                          </Button>

                          <button
                            type="button"
                            onClick={() => openEditTeamModal(team)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-2.5 py-1.5 rounded-md transition-colors"
                            title="Edit Team Name"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteTeam(team)}
                            className="inline-flex items-center justify-center text-xs font-medium text-red-600 hover:text-red-800 hover:bg-red-50 p-1.5 rounded-md transition-colors"
                            title="Delete Team"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Focused Team Member Table without Leads, Tasks, Attendance, Status */}
                      {team.members.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-400">
                          No members in this team yet. Click &quot;Add Member&quot; to assign employees.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm">
                            <thead className="border-b border-[#E6E8EC] bg-white text-xs uppercase tracking-wide text-slate-500">
                              <tr>
                                <th className="px-6 py-3 font-semibold">Team Member</th>
                                <th className="px-4 py-3 font-semibold">Role / Designation</th>
                                <th className="px-4 py-3 font-semibold">Department</th>
                                <th className="px-4 py-3 font-semibold">Joined Date</th>
                                <th className="px-6 py-3 font-semibold text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {team.members.map((member) => (
                                <tr key={member.id} className="transition-colors hover:bg-slate-50/80 group">
                                  {/* Member Info (Clicking opens Member CRM Summary Popup) */}
                                  <td className="px-6 py-3.5">
                                    <div className="flex items-center gap-3">
                                      <button
                                        type="button"
                                        onClick={() => openMemberCrmSummary(member)}
                                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F8E6E6] text-xs font-bold text-[#6E1D1D] hover:bg-[#6E1D1D] hover:text-white transition-colors"
                                        title="Click to view CRM summary"
                                      >
                                        {initials(member.fullName)}
                                      </button>
                                      <div>
                                        <button
                                          type="button"
                                          onClick={() => openMemberCrmSummary(member)}
                                          className="block font-semibold text-slate-900 hover:text-[#6E1D1D] hover:underline text-left transition-colors cursor-pointer"
                                          title="Click to view CRM summary"
                                        >
                                          {member.fullName}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => openMemberCrmSummary(member)}
                                          className="block text-xs text-slate-500 hover:text-slate-700 text-left"
                                        >
                                          {member.employeeCode} · {member.workEmail}
                                        </button>
                                      </div>
                                    </div>
                                  </td>

                                  {/* Designation */}
                                  <td className="px-4 py-3.5 text-slate-700 font-medium text-xs">
                                    {member.designation || 'Staff'}
                                  </td>

                                  {/* Department */}
                                  <td className="px-4 py-3.5 text-slate-600 text-xs">
                                    <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-slate-700">
                                      {member.department}
                                    </span>
                                  </td>

                                  {/* Joined Date */}
                                  <td className="px-4 py-3.5 text-slate-600 text-xs">
                                    {formatDate(member.dateOfJoining)}
                                  </td>

                                  {/* Actions */}
                                  <td className="px-6 py-3.5 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <Button
                                        variant="secondary"
                                        onClick={() => openMemberCrmSummary(member)}
                                        className="h-8 px-2.5 text-xs text-slate-700 hover:text-[#6E1D1D] hover:bg-[#F8E6E6]"
                                        title="View Leads, Operations & CRM Summary"
                                      >
                                        <ChevronRight className="w-3.5 h-3.5 mr-1 text-[#6E1D1D]" />
                                        View
                                      </Button>

                                      {group.teams.length > 1 && (
                                        <Button
                                          variant="secondary"
                                          onClick={() => openReassignModal(member, team, group.teams)}
                                          className="h-8 px-2.5 text-xs text-slate-700 hover:text-[#6E1D1D]"
                                          title="Move to another team under this manager"
                                        >
                                          <ArrowRight className="w-3.5 h-3.5 mr-1" />
                                          Move Team
                                        </Button>
                                      )}

                                      <Button
                                        variant="secondary"
                                        onClick={() => handleRemoveMember(team, member)}
                                        className="h-8 px-2 text-xs text-red-700 hover:bg-red-50 border-red-200"
                                        title="Remove from this team"
                                      >
                                        <UserX className="w-3.5 h-3.5" />
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal: Create Team */}
      <Modal
        open={createTeamModalOpen}
        onClose={() => !isSavingCreateTeam && setCreateTeamModalOpen(false)}
        title="Create Team"
      >
        <form onSubmit={handleCreateTeam} className="space-y-4">
          {createTeamFeedback && (
            <Alert tone={createTeamFeedback.tone} title={createTeamFeedback.tone === 'success' ? 'Success' : 'Error'}>
              {createTeamFeedback.message}
            </Alert>
          )}

          {isAdmin && (
            <div>
              <SelectField
                label="Manager *"
                options={[
                  { value: '', label: 'Select manager…' },
                  ...managerOptions.map((m) => ({
                    value: m.id,
                    label: `${m.fullName} (${m.employeeCode})`,
                  })),
                ]}
                value={createTeamManagerId}
                onChange={(e) => setCreateTeamManagerId(e.target.value)}
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
              Team Name *
            </label>
            <input
              type="text"
              required
              value={createTeamName}
              onChange={(e) => setCreateTeamName(e.target.value)}
              placeholder="e.g. Sales Alpha, Enterprise Sales, Special Projects"
              className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition-colors focus:border-[#6E1D1D]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              value={createTeamDescription}
              onChange={(e) => setCreateTeamDescription(e.target.value)}
              placeholder="Brief description of the team scope or objectives"
              className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900 outline-none transition-colors focus:border-[#6E1D1D]"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E6E8EC]">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCreateTeamModalOpen(false)}
              disabled={isSavingCreateTeam}
              className="h-10 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={isSavingCreateTeam}
              className="h-10 text-xs bg-[#6E1D1D] hover:bg-[#882424] text-white px-5"
            >
              Create Team
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Team */}
      <Modal
        open={editTeamModalOpen}
        onClose={() => !isSavingEditTeam && setEditTeamModalOpen(false)}
        title="Edit Team Name"
      >
        <form onSubmit={handleEditTeam} className="space-y-4">
          {editTeamFeedback && (
            <Alert tone={editTeamFeedback.tone} title={editTeamFeedback.tone === 'success' ? 'Success' : 'Error'}>
              {editTeamFeedback.message}
            </Alert>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
              Team Name *
            </label>
            <input
              type="text"
              required
              value={editTeamName}
              onChange={(e) => setEditTeamName(e.target.value)}
              placeholder="e.g. Sales Alpha"
              className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition-colors focus:border-[#6E1D1D]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              value={editTeamDescription}
              onChange={(e) => setEditTeamDescription(e.target.value)}
              placeholder="Brief description of the team"
              className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900 outline-none transition-colors focus:border-[#6E1D1D]"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E6E8EC]">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditTeamModalOpen(false)}
              disabled={isSavingEditTeam}
              className="h-10 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={isSavingEditTeam}
              className="h-10 text-xs bg-[#6E1D1D] hover:bg-[#882424] text-white px-5"
            >
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add Team Member */}
      <Modal
        open={addMemberModalOpen}
        onClose={() => !isSavingAddMember && setAddMemberModalOpen(false)}
        title={addMemberTeam ? `Add Member to ${addMemberTeam.name}` : 'Add Team Member'}
      >
        <form onSubmit={handleAddMember} className="space-y-4">
          {addMemberFeedback && (
            <Alert tone={addMemberFeedback.tone} title={addMemberFeedback.tone === 'success' ? 'Success' : 'Error'}>
              {addMemberFeedback.message}
            </Alert>
          )}

          <div>
            <SelectField
              label="Select Employee *"
              options={[
                { value: '', label: 'Select employee to add…' },
                ...eligibleEmployeesForAdd.map((emp) => ({
                  value: emp.id,
                  label: `${emp.fullName} — ${emp.designation || 'Staff'} (${emp.department || 'General'}, ${emp.employeeCode})`,
                })),
              ]}
              value={selectedEmployeeIdToAdd}
              onChange={(e) => setSelectedEmployeeIdToAdd(e.target.value)}
              hint="Employees can belong to multiple teams under the manager simultaneously"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E6E8EC]">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setAddMemberModalOpen(false)}
              disabled={isSavingAddMember}
              className="h-10 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!selectedEmployeeIdToAdd}
              isLoading={isSavingAddMember}
              className="h-10 text-xs bg-[#6E1D1D] hover:bg-[#882424] text-white px-5"
            >
              Add to Team
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Move / Reassign Team Member Between Teams */}
      <Modal
        open={reassignModalOpen}
        onClose={() => !isSavingReassign && setReassignModalOpen(false)}
        title="Move Team Member"
      >
        {reassignMember && (
          <form onSubmit={handleReassign} className="space-y-4">
            {reassignFeedback && (
              <Alert tone={reassignFeedback.tone} title={reassignFeedback.tone === 'success' ? 'Success' : 'Error'}>
                {reassignFeedback.message}
              </Alert>
            )}

            <div className="rounded-lg bg-slate-50 p-3.5 border border-[#E6E8EC] space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Employee:</span>
                <span className="font-bold text-slate-900">{reassignMember.fullName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Role & Department:</span>
                <span className="text-slate-700">
                  {reassignMember.department} · {reassignMember.designation}
                </span>
              </div>
            </div>

            <div>
              <SelectField
                label="Target Team *"
                options={[
                  { value: '', label: 'Select target team…' },
                  ...reassignAvailableTeams
                    .filter((t) => t.id !== reassignSourceTeamId)
                    .map((t) => ({
                      value: t.id,
                      label: `${t.name} (${t.members.length} members)`,
                    })),
                ]}
                value={reassignTargetTeamId}
                onChange={(e) => setReassignTargetTeamId(e.target.value)}
                hint="This moves the member between named teams without altering their reporting manager"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E6E8EC]">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setReassignModalOpen(false)}
                disabled={isSavingReassign}
                className="h-10 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!reassignTargetTeamId}
                isLoading={isSavingReassign}
                className="h-10 text-xs bg-[#6E1D1D] hover:bg-[#882424] text-white px-5"
              >
                Move Member
              </Button>
            </div>
          </form>
        )}
      </Modal>
      {/* Modal: Member CRM Summary & Detailed Activity Popup */}
      <Modal
        open={crmSummaryModalOpen}
        onClose={() => setCrmSummaryModalOpen(false)}
        title={crmSummaryEmployee ? `${crmSummaryEmployee.fullName} — CRM & Activity Overview` : 'Team Member Overview'}
        className="max-w-4xl"
      >
        {crmSummaryEmployee && (
          <div className="space-y-6">
            {/* Header profile card */}
            <div className="bg-gradient-to-r from-slate-50 to-[#FDF4F4] rounded-xl p-4 border border-[#E6E8EC] flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#6E1D1D] text-sm font-bold text-white shadow-sm">
                  {initials(crmSummaryEmployee.fullName)}
                </span>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-slate-900">{crmSummaryEmployee.fullName}</h3>
                    <span className="inline-flex items-center gap-1 rounded bg-[#F8E6E6] px-2 py-0.5 text-xs font-semibold text-[#6E1D1D]">
                      {crmSummaryEmployee.employeeCode}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                      {crmSummaryEmployee.status || 'Active'}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                    <span className="font-medium text-slate-800">{crmSummaryEmployee.designation || 'Team Member'}</span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="h-3 w-3 text-slate-400" />
                      {crmSummaryEmployee.department || 'Sales'}
                    </span>
                    {crmSummaryEmployee.workEmail && (
                      <>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1">
                          <Mail className="h-3 w-3 text-slate-400" />
                          {crmSummaryEmployee.workEmail}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <Link
                href={`/employees/${crmSummaryEmployee.id}`}
                target="_blank"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6E1D1D] hover:text-[#882424] bg-white border border-[#6E1D1D]/30 px-3 py-1.5 rounded-lg shadow-sm hover:bg-[#F8E6E6] transition-colors"
              >
                <span>View Full HR Profile</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Error or Loading state */}
            {crmSummaryError && (
              <Alert tone="error" title="Could not load CRM data">
                {crmSummaryError}
              </Alert>
            )}

            {isLoadingCrmSummary ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-500">
                <Spinner className="h-6 w-6 text-[#6E1D1D]" />
                <span className="text-xs">Loading member leads, operations & attendance data...</span>
              </div>
            ) : crmSummaryData ? (
              <div className="space-y-5">
                {/* 3 Clickable Metric Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Leads Metric Card */}
                  <div
                    onClick={() => setCrmActiveTab('leads')}
                    className={`cursor-pointer rounded-xl p-4 border transition-all duration-200 ${
                      crmActiveTab === 'leads'
                        ? 'border-[#6E1D1D] bg-[#FDF4F4] ring-2 ring-[#6E1D1D]/20 shadow-sm'
                        : 'border-[#E6E8EC] bg-white hover:border-slate-300 hover:bg-slate-50/70'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Assigned Leads</span>
                      <span className="p-1.5 rounded-lg bg-amber-50 text-amber-700">
                        <TrendingUp className="h-4 w-4" />
                      </span>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <p className="text-2xl font-black text-slate-900">{crmSummaryData.leads.total}</p>
                      <span className="text-xs text-slate-500">total leads</span>
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                      {crmSummaryData.leads.byStatus['Won'] ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-100 font-semibold text-emerald-800">
                          {crmSummaryData.leads.byStatus['Won']} Won
                        </span>
                      ) : null}
                      {crmSummaryData.leads.byStatus['Interested'] ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-100 font-semibold text-blue-800">
                          {crmSummaryData.leads.byStatus['Interested']} Interested
                        </span>
                      ) : null}
                      {crmSummaryData.leads.byStatus['Proposal Sent'] ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-purple-100 font-semibold text-purple-800">
                          {crmSummaryData.leads.byStatus['Proposal Sent']} Proposal
                        </span>
                      ) : null}
                      {crmSummaryData.leads.byStatus['Negotiation'] ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-indigo-100 font-semibold text-indigo-800">
                          {crmSummaryData.leads.byStatus['Negotiation']} Neg.
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-3 text-[11px] font-semibold text-[#6E1D1D] flex items-center gap-1">
                      <span>Click to view lead details</span>
                      <ChevronRight className="h-3 w-3" />
                    </div>
                  </div>

                  {/* Operations / Tasks Metric Card */}
                  <div
                    onClick={() => setCrmActiveTab('tasks')}
                    className={`cursor-pointer rounded-xl p-4 border transition-all duration-200 ${
                      crmActiveTab === 'tasks'
                        ? 'border-[#6E1D1D] bg-[#FDF4F4] ring-2 ring-[#6E1D1D]/20 shadow-sm'
                        : 'border-[#E6E8EC] bg-white hover:border-slate-300 hover:bg-slate-50/70'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Operations Tasks</span>
                      <span className="p-1.5 rounded-lg bg-blue-50 text-blue-700">
                        <Briefcase className="h-4 w-4" />
                      </span>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <p className="text-2xl font-black text-slate-900">{crmSummaryData.tasks.total}</p>
                      <span className="text-xs text-slate-500">total tasks</span>
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-100 font-semibold text-amber-800">
                        {crmSummaryData.tasks.pending} Pending
                      </span>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-100 font-semibold text-emerald-800">
                        {crmSummaryData.tasks.completed} Done
                      </span>
                      {crmSummaryData.tasks.overdue > 0 && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-red-100 font-semibold text-red-800">
                          {crmSummaryData.tasks.overdue} Overdue
                        </span>
                      )}
                    </div>
                    <div className="mt-3 text-[11px] font-semibold text-[#6E1D1D] flex items-center gap-1">
                      <span>Click to view operations</span>
                      <ChevronRight className="h-3 w-3" />
                    </div>
                  </div>

                  {/* Attendance & Leave Metric Card */}
                  <div
                    onClick={() => setCrmActiveTab('attendance')}
                    className={`cursor-pointer rounded-xl p-4 border transition-all duration-200 ${
                      crmActiveTab === 'attendance'
                        ? 'border-[#6E1D1D] bg-[#FDF4F4] ring-2 ring-[#6E1D1D]/20 shadow-sm'
                        : 'border-[#E6E8EC] bg-white hover:border-slate-300 hover:bg-slate-50/70'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Attendance & Leaves</span>
                      <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
                        <Calendar className="h-4 w-4" />
                      </span>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ${
                          crmSummaryData.attendance.today === 'Present'
                            ? 'bg-emerald-100 text-emerald-800'
                            : crmSummaryData.attendance.today === 'Late'
                            ? 'bg-amber-100 text-amber-800'
                            : crmSummaryData.attendance.today === 'Half-Day'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        Today: {crmSummaryData.attendance.today}
                      </span>
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600">
                      <span>Month: {crmSummaryData.attendance.thisMonthPresent} Present</span>
                      <span>•</span>
                      <span>{crmSummaryData.leave.balance} Leaves Bal.</span>
                    </div>
                    <div className="mt-3 text-[11px] font-semibold text-[#6E1D1D] flex items-center gap-1">
                      <span>Click to view HR records</span>
                      <ChevronRight className="h-3 w-3" />
                    </div>
                  </div>
                </div>

                {/* Tab Navigation Pill Bar */}
                <div className="flex items-center gap-2 border-b border-[#E6E8EC] pb-2">
                  <button
                    type="button"
                    onClick={() => setCrmActiveTab('leads')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      crmActiveTab === 'leads'
                        ? 'bg-[#6E1D1D] text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span>Leads ({crmSummaryData.leads.total})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCrmActiveTab('tasks')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      crmActiveTab === 'tasks'
                        ? 'bg-[#6E1D1D] text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <Briefcase className="h-3.5 w-3.5" />
                    <span>Operations & Tasks ({crmSummaryData.tasks.total})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCrmActiveTab('attendance')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      crmActiveTab === 'attendance'
                        ? 'bg-[#6E1D1D] text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Attendance & Leaves</span>
                  </button>
                </div>

                {/* TAB 1: Detailed Leads Section */}
                {crmActiveTab === 'leads' && (
                  <div className="space-y-4">
                    {/* Status filter pills & search */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setCrmLeadStatusFilter('ALL')}
                          className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                            crmLeadStatusFilter === 'ALL'
                              ? 'bg-slate-800 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          All ({crmSummaryData.leads.total})
                        </button>
                        {Object.entries(crmSummaryData.leads.byStatus).map(([st, count]) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => setCrmLeadStatusFilter(st)}
                            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                              crmLeadStatusFilter === st
                                ? 'bg-[#6E1D1D] text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {st} ({count})
                          </button>
                        ))}
                      </div>

                      <div className="relative w-full sm:w-64">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search leads, company, phone..."
                          value={crmLeadSearch}
                          onChange={(e) => setCrmLeadSearch(e.target.value)}
                          className="h-8 w-full rounded-md border border-slate-300 bg-white pl-8 pr-3 text-xs text-slate-900 outline-none focus:border-[#6E1D1D]"
                        />
                      </div>
                    </div>

                    {/* Filtered Lead Cards List */}
                    {(() => {
                      const filteredLeads = crmSummaryData.leads.recent.filter((lead) => {
                        if (crmLeadStatusFilter !== 'ALL' && lead.status !== crmLeadStatusFilter) {
                          return false;
                        }
                        if (crmLeadSearch.trim()) {
                          const q = crmLeadSearch.toLowerCase().trim();
                          const matches =
                            lead.companyName?.toLowerCase().includes(q) ||
                            lead.contactPerson?.toLowerCase().includes(q) ||
                            lead.mobile?.includes(q) ||
                            lead.city?.toLowerCase().includes(q) ||
                            lead.email?.toLowerCase().includes(q);
                          if (!matches) return false;
                        }
                        return true;
                      });

                      if (filteredLeads.length === 0) {
                        return (
                          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center text-xs text-slate-500">
                            No leads matching current filter or search.
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                          {filteredLeads.map((lead) => (
                            <div
                              key={lead.id}
                              className="rounded-xl border border-[#E6E8EC] bg-white p-3.5 sm:p-4 hover:border-slate-300 hover:shadow-sm transition-all"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="text-sm font-bold text-slate-900">{lead.companyName}</h4>
                                    <span
                                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
                                        lead.status === 'Won'
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : lead.status === 'Lost' || lead.status === 'Rejected'
                                          ? 'bg-red-100 text-red-800'
                                          : lead.status === 'Interested'
                                          ? 'bg-blue-100 text-blue-800'
                                          : lead.status === 'Proposal Sent'
                                          ? 'bg-purple-100 text-purple-800'
                                          : lead.status === 'Negotiation'
                                          ? 'bg-indigo-100 text-indigo-800'
                                          : 'bg-amber-100 text-amber-800'
                                      }`}
                                    >
                                      {lead.status}
                                    </span>
                                  </div>

                                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                                    {lead.contactPerson && (
                                      <span className="font-medium text-slate-800">
                                        Contact: {lead.contactPerson}
                                      </span>
                                    )}
                                    {lead.mobile && (
                                      <span className="inline-flex items-center gap-1 text-slate-600">
                                        <Phone className="h-3 w-3 text-slate-400" />
                                        {lead.mobile}
                                      </span>
                                    )}
                                    {lead.email && (
                                      <span className="inline-flex items-center gap-1 text-slate-600">
                                        <Mail className="h-3 w-3 text-slate-400" />
                                        {lead.email}
                                      </span>
                                    )}
                                    {lead.city && (
                                      <span className="inline-flex items-center gap-1 text-slate-600">
                                        <MapPin className="h-3 w-3 text-slate-400" />
                                        {lead.city}
                                      </span>
                                    )}
                                    {lead.campaignDuration && (
                                      <span className="inline-flex items-center gap-1 text-slate-600">
                                        <Clock className="h-3 w-3 text-slate-400" />
                                        {lead.campaignDuration}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="text-right sm:shrink-0">
                                  {lead.budget !== undefined && (
                                    <div className="text-sm font-bold text-slate-900">
                                      {formatRupees(lead.budget)}
                                    </div>
                                  )}
                                  <div className="text-[11px] text-slate-400 mt-0.5">
                                    Created {formatDate(lead.createdAt)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* TAB 2: Operations & Tasks Section */}
                {crmActiveTab === 'tasks' && (
                  <div className="space-y-3">
                    {crmSummaryData.tasks.recent.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center text-xs text-slate-500">
                        No operational tasks currently assigned to this member.
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                        {crmSummaryData.tasks.recent.map((task) => (
                          <div
                            key={task.id}
                            className="rounded-xl border border-[#E6E8EC] bg-white p-3.5 sm:p-4 hover:border-slate-300 transition-all flex flex-wrap items-center justify-between gap-3"
                          >
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-sm font-bold text-slate-900">{task.title}</h4>
                                <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                                  {task.type}
                                </span>
                              </div>
                              {task.campaignName && (
                                <p className="text-xs text-slate-500 mt-1">
                                  Campaign: <span className="font-medium text-slate-700">{task.campaignName}</span>
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-3">
                              {task.deadline && (
                                <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                                  Due {formatDate(task.deadline)}
                                </span>
                              )}
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                  task.status === 'Completed'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : task.status === 'InProgress'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {task.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: Attendance & Leaves Section */}
                {crmActiveTab === 'attendance' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Attendance Card */}
                      <div className="rounded-xl border border-[#E6E8EC] bg-white p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                            Attendance Summary
                          </h4>
                          <Calendar className="h-4 w-4 text-slate-400" />
                        </div>
                        <div className="rounded-lg bg-slate-50 p-3 flex items-center justify-between">
                          <span className="text-xs text-slate-600">Today&apos;s Status:</span>
                          <span className="text-xs font-bold text-slate-900">
                            {crmSummaryData.attendance.today}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="rounded-lg bg-emerald-50 p-2.5">
                            <span className="text-slate-500 block text-[11px]">Present</span>
                            <span className="text-base font-bold text-emerald-800">
                              {crmSummaryData.attendance.thisMonthPresent}
                            </span>
                          </div>
                          <div className="rounded-lg bg-amber-50 p-2.5">
                            <span className="text-slate-500 block text-[11px]">Late</span>
                            <span className="text-base font-bold text-amber-800">
                              {crmSummaryData.attendance.thisMonthLate}
                            </span>
                          </div>
                          <div className="rounded-lg bg-blue-50 p-2.5">
                            <span className="text-slate-500 block text-[11px]">Half-Day</span>
                            <span className="text-base font-bold text-blue-800">
                              {crmSummaryData.attendance.thisMonthHalfDay}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Leaves Card */}
                      <div className="rounded-xl border border-[#E6E8EC] bg-white p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                            Annual Leave Balance
                          </h4>
                          <ShieldCheck className="h-4 w-4 text-slate-400" />
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="rounded-lg bg-slate-50 p-2.5">
                            <span className="text-slate-500 block text-[11px]">Allocated</span>
                            <span className="text-base font-bold text-slate-900">
                              {crmSummaryData.leave.allocated}
                            </span>
                          </div>
                          <div className="rounded-lg bg-slate-50 p-2.5">
                            <span className="text-slate-500 block text-[11px]">Used</span>
                            <span className="text-base font-bold text-slate-900">
                              {crmSummaryData.leave.used}
                            </span>
                          </div>
                          <div className="rounded-lg bg-emerald-50 p-2.5 border border-emerald-200">
                            <span className="text-emerald-700 block text-[11px] font-semibold">Available</span>
                            <span className="text-base font-black text-emerald-800">
                              {crmSummaryData.leave.balance}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E6E8EC]">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setCrmSummaryModalOpen(false)}
                className="h-10 text-xs px-5"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
