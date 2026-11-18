/* eslint-disable react-hooks/set-state-in-effect, @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, Badge, Spinner, Button, Alert, Field, SelectField, EmptyState, DatePicker } from '@/shared/ui';
import {
  useLeaveBalance,
  useMyLeaveRequests,
  useTeamLeaveRequests,
  useLeaveTypes,
} from '@/modules/hr/hooks/use-leave';
import { leaveApi } from '@/modules/hr/api';
import { useAuth } from '@/shared/auth/auth-context';
import type { LeaveType, QuotaPeriod } from '@/modules/hr/types';
import { toErrorMessage } from '@/shared/api/errors';
import { DecisionNote, HolidayCalendar } from '@/modules/hr/components/holiday-calendar';

function LeaveTabsContent() {
  const { user, hasPermission } = useAuth();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const applyParam = searchParams.get('apply');

  const isAdminRole = user?.role === 'admin';
  const canManageLeave = hasPermission('leave.manage');

  // Determine initial active tab based on role and permissions
  const [activeTab, setActiveTab] = useState(() => {
    if (isAdminRole) {
      return canManageLeave ? 'approvals' : 'calendar';
    }
    return 'my';
  });

  const [showApplyForm, setShowApplyForm] = useState(false);

  // Define tabs configuration
  const tabs = [
    ...(!isAdminRole ? [{ id: 'my', label: 'My Leaves' }] : []),
    ...(canManageLeave ? [{ id: 'approvals', label: 'Leave Approvals' }] : []),
    { id: 'calendar', label: 'Holiday Calendar' },
    ...(hasPermission('leave.self') || canManageLeave ? [{ id: 'types', label: 'Leave Types' }] : []),
  ];

  // Sync tab and form state from URL query parameters
  useEffect(() => {
    if (tabParam && ['my', 'approvals', 'calendar', 'types'].includes(tabParam)) {
      const isValid = tabs.some((t) => t.id === tabParam);
      if (isValid) {
        setActiveTab(tabParam);
      }
    }
  }, [tabParam, user, hasPermission]);

  useEffect(() => {
    if (applyParam === 'true' && !isAdminRole) {
      setActiveTab('my');
      setShowApplyForm(true);
    }
  }, [applyParam, isAdminRole]);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">Leave Management</h1>
        <p className="text-sm text-slate-500">View and manage leave balances, requests, and policies.</p>
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b border-slate-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              if (tab.id !== 'my') setShowApplyForm(false);
            }}
            className={`px-4 py-2.5 font-medium text-sm border-b-2 transition-colors -mb-px ${
              activeTab === tab.id
                ? 'border-[#6E1D1D] text-[#6E1D1D] font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === 'my' && !isAdminRole && (
          <MyLeavesTab showApplyForm={showApplyForm} setShowApplyForm={setShowApplyForm} />
        )}
        {activeTab === 'approvals' && canManageLeave && <LeaveApprovalsTab />}
        {activeTab === 'calendar' && <HolidayCalendar />}
        {activeTab === 'types' && (hasPermission('leave.self') || canManageLeave) && <LeaveTypesTab />}
      </div>
    </div>
  );
}

// =================================================================================
// SUB-COMPONENTS
// =================================================================================

function LeaveStatusBadge({ status }: { status: string }) {
  let colorClasses = 'bg-slate-100 text-slate-700 border-slate-200';
  if (status === 'Approved') {
    colorClasses = 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-1 ring-emerald-600/20';
  } else if (status === 'Pending') {
    colorClasses = 'bg-amber-50 text-amber-800 border-amber-300 ring-1 ring-amber-600/20';
  } else if (status === 'Rejected') {
    colorClasses = 'bg-rose-50 text-rose-800 border-rose-300 ring-1 ring-rose-600/20';
  } else if (status === 'Cancelled') {
    colorClasses = 'bg-slate-100 text-slate-500 border-slate-300';
  }

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${colorClasses}`}>
      {status}
    </span>
  );
}

// ------------------------------------------------------------------ My Leaves Tab
interface MyLeavesTabProps {
  showApplyForm: boolean;
  setShowApplyForm: (show: boolean) => void;
}

function MyLeavesTab({ showApplyForm, setShowApplyForm }: MyLeavesTabProps) {
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'Approved' | 'Rejected' | 'Cancelled'>('All');
  const { data: balance, isLoading: balanceLoading, mutate: mutateBalance } = useLeaveBalance();
  const { data: requests, isLoading: requestsLoading, mutate: mutateRequests } = useMyLeaveRequests(
    statusFilter === 'All' ? undefined : statusFilter
  );
  const { data: leaveTypes } = useLeaveTypes();

  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    leaveTypeId: '',
    fromDate: '',
    toDate: '',
    days: 1,
    reason: '',
  });

  const selectedType = leaveTypes?.find((t: any) => t.id === formData.leaveTypeId);
  const selectedBalance = balance?.find((b: any) => b.leaveTypeId === formData.leaveTypeId);

  const calculateDays = (start: string, end: string) => {
    if (!start || !end) return 1;
    const s = new Date(start);
    const e = new Date(end);
    if (s > e) return 0;
    const diffTime = Math.abs(e.getTime() - s.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const handleDateChange = (field: 'fromDate' | 'toDate', val: string) => {
    const updated = { ...formData, [field]: val };
    if (updated.fromDate && updated.toDate) {
      updated.days = calculateDays(updated.fromDate, updated.toDate);
    }
    setFormData(updated);
  };

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setActionError(null);
    setActionSuccess(null);
    try {
      if (attachment) {
        const body = new FormData();
        body.append('leaveTypeId', formData.leaveTypeId);
        body.append('fromDate', formData.fromDate);
        body.append('toDate', formData.toDate);
        body.append('days', String(formData.days));
        body.append('reason', formData.reason);
        body.append('attachment', attachment);
        await leaveApi.applyLeave(body);
      } else {
        await leaveApi.applyLeave(formData);
      }
      setFormData({
        leaveTypeId: '',
        fromDate: '',
        toDate: '',
        days: 1,
        reason: '',
      });
      setAttachment(null);
      setShowApplyForm(false);
      setActionSuccess('Leave request submitted successfully.');
      void mutateBalance();
      void mutateRequests();
    } catch (err: any) {
      setError(toErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelLeave = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this leave request? If approved, balance will be restored.')) {
      return;
    }
    setCancellingId(id);
    setActionError(null);
    setActionSuccess(null);
    try {
      await leaveApi.cancelLeave(id);
      setActionSuccess('Leave request cancelled successfully.');
      await Promise.all([mutateRequests(), mutateBalance()]);
    } catch (err: unknown) {
      setActionError(toErrorMessage(err));
    } finally {
      setCancellingId(null);
    }
  };

  if (balanceLoading || requestsLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-slate-800">My Leave Information</h2>
          <p className="text-sm text-slate-500">View balances and submit new requests.</p>
        </div>
        <Button onClick={() => setShowApplyForm(!showApplyForm)}>
          {showApplyForm ? 'View Balances' : 'Apply Leave'}
        </Button>
      </div>

      {actionSuccess && <Alert tone="success">{actionSuccess}</Alert>}
      {actionError && <Alert tone="error">{actionError}</Alert>}

      {showApplyForm ? (
        <Card className="p-6 max-w-2xl">
          <h3 className="text-lg font-medium text-slate-800 mb-4">Apply for Leave</h3>
          {error && <Alert tone="error">{error}</Alert>}

          <form onSubmit={handleApplySubmit} className="space-y-6">
            <SelectField
              label="Leave Type"
              value={formData.leaveTypeId}
              onChange={(e) => setFormData({ ...formData, leaveTypeId: e.target.value })}
              options={[
                { label: 'Select Leave Type', value: '' },
                ...(leaveTypes?.filter((t: any) => t.status === 'Active').map((t: any) => ({ label: `${t.name} (${t.code})`, value: t.id })) || []),
              ]}
              required
            />

            {selectedType?.requiresDocument && (
              <Alert tone="warning">
                A supporting document (JPG, PNG, PDF) is required for this leave type.
              </Alert>
            )}

            {selectedBalance && selectedType?.annualQuota !== null && selectedType?.annualQuota !== undefined && selectedType.annualQuota > 0 && (
              <div
                className={`p-4 rounded-lg flex justify-between ${
                  selectedBalance.balance >= formData.days
                    ? 'bg-blue-50 text-blue-800 border border-blue-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                <div>
                  <span className="block text-sm font-medium opacity-80">Available Balance</span>
                  <span className="text-xl font-bold">{selectedBalance.balance} Days</span>
                </div>
                <div className="text-right">
                  <span className="block text-sm font-medium opacity-80">Remaining After Request</span>
                  <span className="text-xl font-bold">{selectedBalance.balance - formData.days} Days</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <DatePicker
                label="From Date"
                value={formData.fromDate}
                onChange={(val) => handleDateChange('fromDate', val)}
                required
              />
              <DatePicker
                label="To Date"
                value={formData.toDate}
                onChange={(val) => handleDateChange('toDate', val)}
                required
              />
            </div>

            <Field
              type="number"
              label="Total Days"
              value={formData.days}
              onChange={(e) => setFormData({ ...formData, days: Number(e.target.value) })}
              required
              min={0.5}
              step={0.5}
            />

             <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
              <textarea
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={4}
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                required
              ></textarea>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Attachment (Optional - JPG, PNG, PDF)
              </label>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
              />
            </div>

            <div className="flex gap-4 pt-4 border-t border-slate-100">
              <Button type="button" variant="secondary" onClick={() => { setShowApplyForm(false); setAttachment(null); }}>
                Cancel
              </Button>
              <Button type="submit" isLoading={submitting}>
                Submit Request
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {balance?.map((b) => {
            const credit =
              b.unlimited || b.quotaPeriod === 'Unlimited'
                ? 'No limit'
                : b.quotaPeriod === 'Monthly'
                  ? `${b.quotaDays} day${b.quotaDays === 1 ? '' : 's'} added every month`
                  : `${b.yearEntitlement ?? b.allocated} days this year`;
            return (
              <Card key={b.leaveTypeId} className="p-6">
                <h3 className="font-semibold text-slate-800 text-lg">{b.leaveTypeName}</h3>
                <p className="text-xs text-slate-500 mb-4">{credit}</p>
                {b.unlimited ? (
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Used this year:</span>
                      <span className="font-medium text-slate-700">{b.used} days</span>
                    </div>
                    <div className="pt-3 border-t border-slate-100 flex justify-between text-base font-semibold">
                      <span className="text-slate-800">Available:</span>
                      <span className="text-slate-700">Unlimited</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">{b.quotaPeriod === 'Monthly' ? 'Credited so far:' : 'Allocated:'}</span>
                      <span className="font-medium text-slate-700">
                        {b.allocated - (b.carriedExpired ? 0 : b.carriedForward)} days
                        {b.quotaPeriod === 'Monthly' && b.yearEntitlement != null && (
                          <span className="text-slate-400"> of {b.yearEntitlement}</span>
                        )}
                      </span>
                    </div>
                    {b.carriedForward > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Carried from last year:</span>
                        <span className={`font-medium ${b.carriedExpired ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                          {b.carriedForward} days
                        </span>
                      </div>
                    )}
                    {b.carriedForward > 0 && b.carriedExpiresOn && (
                      <p className={`text-[11px] ${b.carriedExpired ? 'text-slate-400' : 'text-amber-700'}`}>
                        {b.carriedExpired
                          ? `Carried days expired on ${new Date(b.carriedExpiresOn).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                          : `Use carried days by ${new Date(b.carriedExpiresOn).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                      </p>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Used:</span>
                      <span className="font-medium text-slate-700">{b.used} days</span>
                    </div>
                    <div className="pt-3 border-t border-slate-100 flex justify-between text-base font-semibold">
                      <span className="text-slate-800">Remaining:</span>
                      <span className={b.balance > 0 ? 'text-green-600' : 'text-red-500'}>{b.balance} days</span>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
          {(!balance || balance.length === 0) && (
            <div className="col-span-full text-slate-500 bg-slate-50 p-6 rounded-xl text-center">
              No leave types have been set up yet. HR can add them under Leave Types.
            </div>
          )}
        </div>
      )}

      {/* History */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="text-xl font-semibold text-slate-800">Leave Requests</h2>
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
            {(['All', 'Pending', 'Approved', 'Rejected', 'Cancelled'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setStatusFilter(filter)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  statusFilter === filter
                    ? 'bg-white text-slate-900 shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-medium text-slate-600">Type</th>
                  <th className="px-4 py-3 font-medium text-slate-600">From Date</th>
                  <th className="px-4 py-3 font-medium text-slate-600">To Date</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Days</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Status</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Reason</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests?.map((req: any) => (
                  <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{req.leaveTypeName || req.leaveTypeId}</td>
                    <td className="px-4 py-3 text-slate-600">{new Date(req.fromDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-slate-600">{new Date(req.toDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{req.days}</td>
                    <td className="px-4 py-3">
                      <LeaveStatusBadge status={req.status} />
                      <DecisionNote req={req} className="mt-1" />
                      {req.status === 'Rejected' && req.rejectionReason && (
                        <div className="mt-1 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded p-1.5 max-w-[200px] break-words">
                          <span className="font-semibold">Reason:</span> {req.rejectionReason}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={req.reason}>
                      <div>{req.reason}</div>
                      {req.documentUrl && (
                        <a
                          href={req.documentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-xs text-blue-600 hover:text-blue-800 font-semibold mt-1"
                        >
                          📄 View Attachment
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {(req.status === 'Pending' || req.status === 'Approved') ? (
                        <Button
                          variant="secondary"
                          className="!h-8 !px-2.5 !text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200"
                          onClick={() => handleCancelLeave(req.id)}
                          isLoading={cancellingId === req.id}
                        >
                          Cancel
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {(!requests || requests.length === 0) && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      No leave requests found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ------------------------------------------------------------- Leave Approvals Tab
function LeaveApprovalsTab() {
  const [statusFilter, setStatusFilter] = useState<'Pending' | 'Approved' | 'Rejected' | 'Cancelled' | 'All'>('Pending');
  const { data: requests, isLoading, mutate } = useTeamLeaveRequests(statusFilter === 'All' ? undefined : statusFilter);

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    setError(null);
    setActionSuccess(null);
    try {
      await leaveApi.approveLeave(id);
      setActionSuccess('Leave request approved successfully.');
      await mutate();
    } catch (err: any) {
      setError(toErrorMessage(err));
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!rejectionReason.trim()) {
      setError('Rejection reason is required.');
      return;
    }
    setProcessingId(id);
    setError(null);
    setActionSuccess(null);
    try {
      await leaveApi.rejectLeave(id, rejectionReason.trim());
      setRejectingId(null);
      setRejectionReason('');
      setActionSuccess('Leave request rejected.');
      await mutate();
    } catch (err: any) {
      setError(toErrorMessage(err));
    } finally {
      setProcessingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const selectedReviewReq = requests?.find((r) => r.id === selectedReviewId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium text-slate-800">Team Leave Requests</h2>
          <p className="text-sm text-slate-500">Review and approve team leave requests.</p>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
          {(['Pending', 'Approved', 'Rejected', 'Cancelled', 'All'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => {
                setStatusFilter(filter);
                setRejectingId(null);
                setError(null);
                setActionSuccess(null);
              }}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                statusFilter === filter
                  ? 'bg-white text-slate-900 shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {actionSuccess && <Alert tone="success">{actionSuccess}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-medium text-slate-600">Employee</th>
                <th className="px-4 py-3 font-medium text-slate-600">Type</th>
                <th className="px-4 py-3 font-medium text-slate-600">Dates</th>
                <th className="px-4 py-3 font-medium text-slate-600">Days</th>
                <th className="px-4 py-3 font-medium text-slate-600">Reason</th>
                <th className="px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="px-4 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests?.map((req) => (
                <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {req.employeeName || (typeof req.employeeId === 'object' ? (req.employeeId as any)?.name || (req.employeeId as any)?._id : req.employeeId)}
                    <span className="block text-xs text-slate-500">
                      {req.employeeCode} · {req.department}
                    </span>
                    {(req.attendance && req.attendance.length > 0) && (
                      <button
                        type="button"
                        onClick={() => setSelectedReviewId(selectedReviewId === req.id ? null : req.id)}
                        className="text-[11px] text-blue-600 hover:text-blue-800 underline mt-1"
                      >
                        {selectedReviewId === req.id ? '▲ Hide Details' : `▼ Review Records (${req.attendance.length})`}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {req.leaveTypeName || (typeof req.leaveTypeId === 'object' ? (req.leaveTypeId as any)?.name || (req.leaveTypeId as any)?._id : req.leaveTypeId)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(req.fromDate).toLocaleDateString()} - {new Date(req.toDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-slate-800">{req.days}</td>
                  <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate" title={req.reason}>
                    <div>{req.reason}</div>
                    {req.documentUrl && (
                      <a
                        href={req.documentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-xs text-blue-600 hover:text-blue-800 font-semibold mt-1"
                      >
                        📄 View Attachment
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <LeaveStatusBadge status={req.status} />
                    <DecisionNote req={req} className="mt-1" />
                    {req.status === 'Rejected' && req.rejectionReason && (
                      <div className="mt-1 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded p-1.5 max-w-[200px] break-words">
                        <span className="font-semibold">Reason:</span> {req.rejectionReason}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {req.status === 'Pending' ? (
                      rejectingId === req.id ? (
                        <div className="flex flex-col gap-2 min-w-[200px]">
                          <input
                            type="text"
                            className="w-full px-2 py-1 border rounded text-xs"
                            placeholder="Rejection reason..."
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <Button
                              variant="secondary"
                              className="!h-8 !px-2.5 !text-xs text-rose-600 hover:bg-rose-50"
                              onClick={() => handleReject(req.id)}
                              isLoading={processingId === req.id}
                            >
                              Confirm Reject
                            </Button>
                            <Button
                              variant="secondary"
                              className="!h-8 !px-2.5 !text-xs"
                              onClick={() => { setRejectingId(null); setRejectionReason(''); }}
                              disabled={processingId === req.id}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            variant="primary"
                            className="!h-8 !px-2.5 !text-xs"
                            onClick={() => handleApprove(req.id)}
                            isLoading={processingId === req.id}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="secondary"
                            className="!h-8 !px-2.5 !text-xs text-rose-600 hover:bg-rose-50"
                            onClick={() => { setRejectingId(req.id); setRejectionReason(''); }}
                            disabled={processingId === req.id}
                          >
                            Reject
                          </Button>
                        </div>
                      )
                    ) : req.status === 'Approved' || req.status === 'Rejected' ? (
                      <span className="text-xs text-slate-400">Done</span>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Cancelled</span>
                    )}
                  </td>
                </tr>
              ))}
              {(!requests || requests.length === 0) && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No {statusFilter !== 'All' ? statusFilter.toLowerCase() : ''} leave requests found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Review details for selected request */}
      {selectedReviewReq && (
        <Card className="p-5 border-blue-200 bg-blue-50/20">
          <div className="flex items-center justify-between border-b pb-3 mb-4">
            <div>
              <h3 className="font-semibold text-slate-800">
                Attendance & Quota Context: {String(selectedReviewReq.employeeName || (typeof selectedReviewReq.employeeId === 'object' ? (selectedReviewReq.employeeId as any)?.name || (selectedReviewReq.employeeId as any)?._id : selectedReviewReq.employeeId))}
              </h3>
              <p className="text-xs text-slate-500">
                Leave Type: {selectedReviewReq.leaveTypeName} · Period: {new Date(selectedReviewReq.fromDate).toLocaleDateString()} to {new Date(selectedReviewReq.toDate).toLocaleDateString()} ({selectedReviewReq.days} days)
              </p>
            </div>
            <Button variant="ghost" className="h-8 w-8 !p-0" onClick={() => setSelectedReviewId(null)}>
              ✕
            </Button>
          </div>

          <div className="grid gap-4 text-sm sm:grid-cols-4 mb-4">
            <div className="p-3 bg-white rounded-lg border border-slate-200">
              <span className="text-xs text-slate-500 block">Allocated Quota</span>
              <p className="text-lg font-bold text-slate-800">{selectedReviewReq.allocated ?? 0} days</p>
            </div>
            <div className="p-3 bg-white rounded-lg border border-slate-200">
              <span className="text-xs text-slate-500 block">Used So Far</span>
              <p className="text-lg font-bold text-slate-800">{selectedReviewReq.used ?? 0} days</p>
            </div>
            <div className="p-3 bg-white rounded-lg border border-slate-200">
              <span className="text-xs text-slate-500 block">Remaining Quota</span>
              <p className="text-lg font-bold text-emerald-600">{selectedReviewReq.remaining ?? 0} days</p>
            </div>
            <div className="p-3 bg-white rounded-lg border border-slate-200">
              <span className="text-xs text-slate-500 block">Attendance Records</span>
              <p className="text-lg font-bold text-slate-800">{selectedReviewReq.attendance?.length ?? 0}</p>
            </div>
          </div>

          {selectedReviewReq.attendance && selectedReviewReq.attendance.length > 0 && (
            <div className="overflow-x-auto bg-white rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 font-medium text-slate-600">Date</th>
                    <th className="py-2.5 px-3 font-medium text-slate-600">Check-in</th>
                    <th className="py-2.5 px-3 font-medium text-slate-600">Check-out</th>
                    <th className="py-2.5 px-3 font-medium text-slate-600">Hours</th>
                    <th className="py-2.5 px-3 font-medium text-slate-600">Status / Work type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedReviewReq.attendance.map((record) => (
                    <tr key={record.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-medium">{new Date(record.date).toLocaleDateString()}</td>
                      <td className="py-2 px-3">
                        {record.checkInTime
                          ? new Date(record.checkInTime).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '-'}
                      </td>
                      <td className="py-2 px-3">
                        {record.checkOutTime
                          ? new Date(record.checkOutTime).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '-'}
                      </td>
                      <td className="py-2 px-3">{record.totalHours ?? 0}</td>
                      <td className="py-2 px-3">
                        <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] bg-slate-100 font-medium">
                          {record.status} / {record.workType}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ----------------------------------------------------------------- Leave Types Tab
const MONTH_END = ['31 January', '28/29 February', '31 March', '30 April', '31 May', '30 June', '31 July', '31 August', '30 September', '31 October', '30 November', '31 December'];

type PolicyForm = {
  name: string;
  quotaPeriod: QuotaPeriod;
  quotaDays: string;
  carryForward: boolean;
  maxCarryForward: string;
  carryForwardExpiryMonths: number | null;
  encashable: boolean;
  requiresDocument: boolean;
};

const EMPTY_POLICY: PolicyForm = {
  name: '',
  quotaPeriod: 'Monthly',
  quotaDays: '1',
  carryForward: false,
  maxCarryForward: '',
  carryForwardExpiryMonths: null,
  encashable: false,
  requiresDocument: false,
};

function daysLabel(n: number) {
  return `${n} day${n === 1 ? '' : 's'}`;
}

/** "1 day every month (12 a year). Up to 5 unused days carry over and must be used by 31 March." */
function describePolicy(p: {
  quotaPeriod: QuotaPeriod;
  quotaDays: number;
  carryForward: boolean;
  maxCarryForward: number;
  carryForwardExpiryMonths: number | null;
}): { quota: string; carry: string | null } {
  let quota: string;
  if (p.quotaPeriod === 'Unlimited') quota = 'No limit — taken as needed';
  else if (p.quotaPeriod === 'Monthly') quota = `${daysLabel(p.quotaDays)} every month (${Math.round(p.quotaDays * 12 * 2) / 2} a year)`;
  else quota = `${daysLabel(p.quotaDays)} per year`;

  if (!p.carryForward || p.quotaPeriod === 'Unlimited') return { quota, carry: null };
  const amount = p.maxCarryForward > 0 ? `Up to ${daysLabel(p.maxCarryForward)}` : 'All unused days';
  const until = p.carryForwardExpiryMonths ? `must be used by ${MONTH_END[p.carryForwardExpiryMonths - 1]}` : 'can be used all next year';
  return { quota, carry: `${amount} carry into next year and ${until}` };
}

function LeaveTypesTab() {
  const { user } = useAuth();
  const isAdminOrHr = user?.role === 'admin' || user?.role === 'hr';

  const { data: leaveTypes, isLoading, mutate } = useLeaveTypes();
  const [showForm, setShowForm] = useState(false);
  const [editingType, setEditingType] = useState<LeaveType | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<PolicyForm>(EMPTY_POLICY);

  const set = <K extends keyof PolicyForm>(key: K, value: PolicyForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  const activeTypes = (leaveTypes ?? []).filter((t: LeaveType) => t.status === 'Active');
  const quotaDays = Number(form.quotaDays) || 0;
  const preview = describePolicy({
    quotaPeriod: form.quotaPeriod,
    quotaDays,
    carryForward: form.carryForward,
    maxCarryForward: Number(form.maxCarryForward) || 0,
    carryForwardExpiryMonths: form.carryForwardExpiryMonths,
  });

  const handleEdit = (type: LeaveType) => {
    setEditingType(type);
    setForm({
      name: type.name,
      quotaPeriod: type.quotaPeriod ?? (type.annualQuota == null ? 'Unlimited' : 'Yearly'),
      quotaDays: String(type.quotaDays ?? type.annualQuota ?? 0),
      carryForward: type.carryForward,
      maxCarryForward: type.maxCarryForward ? String(type.maxCarryForward) : '',
      carryForwardExpiryMonths: type.carryForwardExpiryMonths ?? null,
      encashable: type.encashable,
      requiresDocument: type.requiresDocument,
    });
    setError(null);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingType(null);
    setForm(EMPTY_POLICY);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.name.trim().length < 2) return setError('Give the leave a name, e.g. "Casual Leave".');
    if (form.quotaPeriod !== 'Unlimited' && quotaDays <= 0) return setError('Enter how many days this leave gives.');
    if (form.quotaPeriod !== 'Unlimited' && !Number.isInteger(quotaDays * 2)) return setError('Days must be whole or half days (e.g. 1 or 1.5).');

    setSubmitting(true);
    setError(null);
    const payload: Partial<LeaveType> = {
      name: form.name.trim(),
      quotaPeriod: form.quotaPeriod,
      quotaDays: form.quotaPeriod === 'Unlimited' ? 0 : quotaDays,
      carryForward: form.quotaPeriod !== 'Unlimited' && form.carryForward,
      maxCarryForward: form.carryForward ? Math.max(0, Math.floor(Number(form.maxCarryForward) || 0)) : 0,
      carryForwardExpiryMonths: form.carryForward ? form.carryForwardExpiryMonths : null,
      encashable: form.encashable,
      requiresDocument: form.requiresDocument,
    };
    try {
      if (editingType) await leaveApi.updateLeaveType(editingType.id, payload);
      else await leaveApi.createLeaveType(payload);
      await mutate();
      handleCancel();
    } catch (err: any) {
      setError(err instanceof Error ? err.message : `Failed to ${editingType ? 'update' : 'create'} leave type`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (type: LeaveType) => {
    if (!confirm(`Delete "${type.name}"? If anyone has already used it, it's kept for history but no longer offered.`)) return;
    setError(null);
    try {
      await leaveApi.deleteLeaveType(type.id);
      await mutate();
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Failed to delete leave type');
    }
  };

  const periodOptions: { value: QuotaPeriod; label: string; hint: string }[] = [
    { value: 'Monthly', label: 'Every month', hint: 'Builds up month by month' },
    { value: 'Yearly', label: 'Every year', hint: 'Full amount from January' },
    { value: 'Unlimited', label: 'Unlimited', hint: 'e.g. Leave Without Pay' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium text-slate-800">Leave Policies</h2>
          <p className="text-sm text-slate-500">
            The leaves your company gives. Balances update automatically for every employee.
          </p>
        </div>
        {isAdminOrHr && !showForm && <Button onClick={() => setShowForm(true)}>Add Leave Type</Button>}
      </div>

      {showForm && isAdminOrHr && (
        <Card className="p-6">
          <h3 className="text-lg font-medium text-slate-800 mb-4">
            {editingType ? `Edit ${editingType.name}` : 'New leave type'}
          </h3>
          {error && (
            <div className="mb-4">
              <Alert tone="error">{error}</Alert>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Name"
                placeholder="e.g. Casual Leave"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                required
              />
              {editingType && (
                <Field label="Code" value={editingType.code} disabled onChange={() => undefined} />
              )}
            </div>

            {/* How is it given? */}
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">How often is it given?</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {periodOptions.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => set('quotaPeriod', o.value)}
                    className={`text-left rounded-xl border p-3 transition-colors ${
                      form.quotaPeriod === o.value
                        ? 'border-[#8B2424] bg-[#FFF5F5] ring-1 ring-[#8B2424]'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className="block text-sm font-semibold text-slate-800">{o.label}</span>
                    <span className="block text-xs text-slate-500">{o.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            {form.quotaPeriod !== 'Unlimited' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  type="number"
                  label={form.quotaPeriod === 'Monthly' ? 'Days given every month' : 'Days given per year'}
                  value={form.quotaDays}
                  onChange={(e) => set('quotaDays', e.target.value)}
                  min={0}
                  step={0.5}
                  hint={
                    form.quotaPeriod === 'Monthly'
                      ? `= ${Math.round(quotaDays * 12 * 2) / 2} days a year. New joiners start from their joining month.`
                      : 'New joiners get a share for the months left in the year.'
                  }
                />
              </div>
            )}

            {/* Carry forward */}
            {form.quotaPeriod !== 'Unlimited' && (
              <div className="rounded-xl border border-slate-200 p-4 space-y-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={form.carryForward}
                    onChange={(e) => set('carryForward', e.target.checked)}
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-800">Carry unused days into next year</span>
                    <span className="block text-xs text-slate-500">Leftover days at year end move to the next year.</span>
                  </span>
                </label>
                {form.carryForward && (
                  <div className="grid gap-4 sm:grid-cols-2 pl-7">
                    <Field
                      type="number"
                      label="Most days that can carry over"
                      placeholder="No limit"
                      value={form.maxCarryForward}
                      onChange={(e) => set('maxCarryForward', e.target.value)}
                      min={0}
                      hint="Leave empty for no limit."
                    />
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Carried days expire</label>
                      <select
                        className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm"
                        value={form.carryForwardExpiryMonths ?? ''}
                        onChange={(e) => set('carryForwardExpiryMonths', e.target.value ? Number(e.target.value) : null)}
                      >
                        <option value="">Never — usable all next year</option>
                        {[1, 2, 3, 6, 9].map((m) => (
                          <option key={m} value={m}>
                            Use by {MONTH_END[m - 1]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" checked={form.requiresDocument} onChange={(e) => set('requiresDocument', e.target.checked)} />
                Needs a document (e.g. medical certificate)
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" checked={form.encashable} onChange={(e) => set('encashable', e.target.checked)} />
                Can be encashed
              </label>
            </div>

            {/* Live summary */}
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-700">
              <span className="font-semibold">{form.name.trim() || 'This leave'}:</span> {preview.quota}.
              {preview.carry && <> {preview.carry}.</>}
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={handleCancel} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" isLoading={submitting}>
                {editingType ? 'Save changes' : 'Create leave type'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {error && !showForm && <Alert tone="error">{error}</Alert>}

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Spinner />
          </div>
        ) : activeTypes.length === 0 ? (
          <div className="py-10">
            <EmptyState
              title="No leave types yet"
              description={
                isAdminOrHr
                  ? 'Add the leaves your company offers — for example "Casual Leave, 1 day every month" or "Sick Leave, 6 days a year".'
                  : 'HR has not set up any leave types yet.'
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-medium text-slate-600">Leave</th>
                  <th className="px-4 py-3 font-medium text-slate-600">How much</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Carry forward</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Rules</th>
                  {isAdminOrHr && <th className="px-4 py-3 font-medium text-slate-600 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeTypes.map((type: LeaveType) => {
                  const d = describePolicy({
                    quotaPeriod: type.quotaPeriod ?? (type.annualQuota == null ? 'Unlimited' : 'Yearly'),
                    quotaDays: type.quotaDays ?? type.annualQuota ?? 0,
                    carryForward: type.carryForward,
                    maxCarryForward: type.maxCarryForward,
                    carryForwardExpiryMonths: type.carryForwardExpiryMonths ?? null,
                  });
                  return (
                    <tr key={type.id} className="hover:bg-slate-50 transition-colors align-top">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{type.name}</p>
                        <p className="text-xs text-slate-400">{type.code}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{d.quota}</td>
                      <td className="px-4 py-3 text-slate-600 max-w-xs">{d.carry ?? 'No — unused days lapse at year end'}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {type.requiresDocument && <Badge>Needs document</Badge>}
                          {type.encashable && <Badge>Encashable</Badge>}
                          {!type.requiresDocument && !type.encashable && <span className="text-xs text-slate-400">—</span>}
                        </div>
                      </td>
                      {isAdminOrHr && (
                        <td className="px-4 py-3">
                          <div className="flex gap-2 justify-end">
                            <Button variant="secondary" className="!h-8 !px-2.5 !text-xs" onClick={() => handleEdit(type)}>
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              className="!h-8 !px-2.5 !text-xs text-red-600 hover:bg-red-50"
                              onClick={() => handleDelete(type)}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function LeavePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <Spinner />
        </div>
      }
    >
      <LeaveTabsContent />
    </Suspense>
  );
}
