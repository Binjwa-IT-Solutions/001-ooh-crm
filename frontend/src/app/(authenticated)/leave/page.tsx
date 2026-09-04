/* eslint-disable react-hooks/set-state-in-effect, @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, Badge, Spinner, Button, Alert, Field, SelectField, TextAreaField, EmptyState } from '@/shared/ui';
import {
  useLeaveBalance,
  useMyLeaveRequests,
  useTeamLeaveRequests,
  useHolidays,
  useLeaveTypes,
} from '@/modules/hr/hooks/use-leave';
import { leaveApi, holidayApi } from '@/modules/hr/api';
import { useAuth } from '@/shared/auth/auth-context';
import type { LeaveType } from '@/modules/hr/types';
import { toErrorMessage } from '@/shared/api/errors';

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
        {activeTab === 'calendar' && <HolidayCalendarTab />}
        {activeTab === 'types' && (hasPermission('leave.self') || canManageLeave) && <LeaveTypesTab />}
      </div>
    </div>
  );
}

// =================================================================================
// SUB-COMPONENTS
// =================================================================================

// ------------------------------------------------------------------ My Leaves Tab
interface MyLeavesTabProps {
  showApplyForm: boolean;
  setShowApplyForm: (show: boolean) => void;
}

function MyLeavesTab({ showApplyForm, setShowApplyForm }: MyLeavesTabProps) {
  const { data: balance, isLoading: balanceLoading, mutate: mutateBalance } = useLeaveBalance();
  const { data: requests, isLoading: requestsLoading, mutate: mutateRequests } = useMyLeaveRequests();
  const { data: leaveTypes } = useLeaveTypes();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      void mutateBalance();
      void mutateRequests();
    } catch (err: any) {
      setError(toErrorMessage(err));
    } finally {
      setSubmitting(false);
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
              <Field
                type="date"
                label="From Date"
                value={formData.fromDate}
                onChange={(e) => handleDateChange('fromDate', e.target.value)}
                required
              />
              <Field
                type="date"
                label="To Date"
                value={formData.toDate}
                onChange={(e) => handleDateChange('toDate', e.target.value)}
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
          {balance?.map((b) => (
            <Card key={b.leaveTypeId} className="p-6">
              <h3 className="font-semibold text-slate-800 text-lg mb-4">{b.leaveTypeName}</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Allocated:</span>
                  <span className="font-medium text-slate-700">{b.allocated} days</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Used:</span>
                  <span className="font-medium text-slate-700">{b.used} days</span>
                </div>
                {b.carriedForward > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Carried Forward:</span>
                    <span className="font-medium text-slate-700">{b.carriedForward} days</span>
                  </div>
                )}
                <div className="pt-3 border-t border-slate-100 flex justify-between text-base font-semibold">
                  <span className="text-slate-800">Remaining:</span>
                  <span className={b.balance > 0 ? 'text-green-600' : 'text-red-500'}>{b.balance} days</span>
                </div>
              </div>
            </Card>
          ))}
          {(!balance || balance.length === 0) && (
            <div className="col-span-full text-slate-500 bg-slate-50 p-6 rounded-xl text-center">
              No leave balances found.
            </div>
          )}
        </div>
      )}

      {/* History */}
      <div>
        <h2 className="text-xl font-semibold text-slate-800 mb-4">Leave Requests</h2>
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
                      <Badge>{req.status}</Badge>
                      {req.status === 'Rejected' && req.rejectionReason && (
                        <div className="text-xs text-red-600 mt-1 max-w-[150px] break-words" title={req.rejectionReason}>
                          Reason: {req.rejectionReason}
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
                  </tr>
                ))}
                {(!requests || requests.length === 0) && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
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
  const { data: requests, isLoading, mutate } = useTeamLeaveRequests();

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    setError(null);
    try {
      await leaveApi.approveLeave(id);
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
    try {
      await leaveApi.rejectLeave(id, rejectionReason);
      setRejectingId(null);
      setRejectionReason('');
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-slate-800">Team Leave Requests</h2>
        <p className="text-sm text-slate-500">Review and approve team leave requests.</p>
      </div>

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
                <th className="px-4 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests?.map((req) => (
                <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {req.employeeName || req.employeeId}
                    <span className="block text-xs text-slate-500">
                      {req.employeeCode} · {req.department}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">{req.leaveTypeName || req.leaveTypeId}</td>
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
                    {rejectingId === req.id ? (
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
                            onClick={() => handleReject(req.id)}
                            isLoading={processingId === req.id}
                          >
                            Confirm Reject
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => setRejectingId(null)}
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
                          onClick={() => handleApprove(req.id)}
                          isLoading={processingId === req.id}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => setRejectingId(req.id)}
                          disabled={processingId === req.id}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {(!requests || requests.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No pending leave requests to review.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      {requests?.map((req) => (
        <Card key={`${req.id}-review`} className="mt-4">
          <div className="grid gap-4 text-sm sm:grid-cols-4">
            <div>
              <span className="text-slate-500">Allocated</span>
              <p className="font-semibold">{req.allocated ?? 0}</p>
            </div>
            <div>
              <span className="text-slate-500">Used</span>
              <p className="font-semibold">{req.used ?? 0}</p>
            </div>
            <div>
              <span className="text-slate-500">Remaining</span>
              <p className="font-semibold">{req.remaining ?? 0}</p>
            </div>
            <div>
              <span className="text-slate-500">Attendance records</span>
              <p className="font-semibold">{req.attendance?.length ?? 0}</p>
            </div>
          </div>
          {req.attendance && req.attendance.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200">
                  <tr>
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Check-in</th>
                    <th className="py-2 pr-3">Check-out</th>
                    <th className="py-2 pr-3">Hours</th>
                    <th className="py-2">Status / Work type</th>
                  </tr>
                </thead>
                <tbody>
                  {req.attendance.map((record) => (
                    <tr key={record.id} className="border-b border-slate-100">
                      <td className="py-2 pr-3">{new Date(record.date).toLocaleDateString()}</td>
                      <td className="py-2 pr-3">
                        {record.checkInTime
                          ? new Date(record.checkInTime).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '-'}
                      </td>
                      <td className="py-2 pr-3">
                        {record.checkOutTime
                          ? new Date(record.checkOutTime).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '-'}
                      </td>
                      <td className="py-2 pr-3">{record.totalHours ?? 0}</td>
                      <td className="py-2">
                        {record.status} / {record.workType}
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
  );
}

// ------------------------------------------------------------- Holiday Calendar Tab
function HolidayCalendarTab() {
  const { hasPermission } = useAuth();
  const canManageHolidays = hasPermission('holiday.manage');

  const { data: holidays, isLoading, error: fetchError, mutate } = useHolidays();

  const now = new Date();
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(now.getUTCMonth());

  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const MONTHS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  };

  const getStartDayOfWeek = (year: number, month: number) => {
    return new Date(Date.UTC(year, month, 1)).getUTCDay();
  };

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const startDayOfWeek = getStartDayOfWeek(currentYear, currentMonth);

  const prevMonth = () => {
    setFormError(null);
    setSelectedDay(null);
    setIsEditing(false);
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((prev) => prev - 1);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
  };

  const nextMonth = () => {
    setFormError(null);
    setSelectedDay(null);
    setIsEditing(false);
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
  };

  const getHolidayForDay = (dayNum: number) => {
    if (!holidays) return null;
    const found = holidays.find((h) => {
      const hDate = new Date(h.date);
      const hYear = hDate.getUTCFullYear();
      const hMonth = hDate.getUTCMonth();
      const hDay = hDate.getUTCDate();
      return hYear === currentYear && hMonth === currentMonth && hDay === dayNum;
    });
    return found || null;
  };

  const handleSelectDay = (dayNum: number) => {
    setSelectedDay(dayNum);
    const existingHoliday = getHolidayForDay(dayNum);
    if (existingHoliday) {
      setFormName(existingHoliday.name);
      setFormDescription(existingHoliday.description || '');
      setIsEditing(false);
    } else {
      setFormName('');
      setFormDescription('');
      setIsEditing(true);
    }
    setFormError(null);
  };

  const handleSaveHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDay) return;

    if (!formName.trim()) {
      setFormError('Holiday name is required.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const dateString = new Date(Date.UTC(currentYear, currentMonth, selectedDay)).toISOString();
    const existingHoliday = getHolidayForDay(selectedDay);

    try {
      if (existingHoliday) {
        await holidayApi.updateHoliday(existingHoliday.id, {
          name: formName,
          date: dateString,
          description: formDescription,
        });
      } else {
        await holidayApi.createHoliday({
          name: formName,
          date: dateString,
          description: formDescription,
        });
      }
      setIsEditing(false);
      await mutate();
    } catch (err: any) {
      setFormError(err.message || 'An error occurred while saving the holiday.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteHoliday = async () => {
    if (!selectedDay) return;
    const existingHoliday = getHolidayForDay(selectedDay);
    if (!existingHoliday) return;

    if (!confirm(`Are you sure you want to delete the holiday "${existingHoliday.name}"?`)) {
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      await holidayApi.deleteHoliday(existingHoliday.id);
      setSelectedDay(null);
      setIsEditing(false);
      setFormName('');
      setFormDescription('');
      await mutate();
    } catch (err: any) {
      setFormError(err.message || 'An error occurred while deleting the holiday.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const calendarCells = [];
  for (let i = 0; i < startDayOfWeek; i++) {
    calendarCells.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarCells.push(i);
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner label="Loading calendar..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-slate-800">Company Holiday Calendar</h2>
        <p className="text-sm text-slate-500">
          View official non-working days.{' '}
          {canManageHolidays ? 'Add, edit, or remove holidays.' : 'Sundays are automatic weekly holidays.'}
        </p>
      </div>

      {fetchError && <Alert tone="error">{fetchError.message}</Alert>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <select
                  value={currentMonth}
                  onChange={(e) => {
                    setFormError(null);
                    setSelectedDay(null);
                    setIsEditing(false);
                    setCurrentMonth(Number(e.target.value));
                  }}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6E1D1D] text-sm font-semibold bg-white text-slate-800"
                >
                  {MONTHS.map((month, index) => (
                    <option key={month} value={index}>
                      {month}
                    </option>
                  ))}
                </select>
                <select
                  value={currentYear}
                  onChange={(e) => {
                    setFormError(null);
                    setSelectedDay(null);
                    setIsEditing(false);
                    setCurrentYear(Number(e.target.value));
                  }}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6E1D1D] text-sm font-semibold bg-white text-slate-800"
                >
                  {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={prevMonth}>
                  &larr; Prev
                </Button>
                <Button variant="secondary" onClick={nextMonth}>
                  Next &rarr;
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center font-semibold text-xs text-slate-500 border-b pb-2 mb-2">
              <div className="text-red-500">SUN</div>
              <div>MON</div>
              <div>TUE</div>
              <div>WED</div>
              <div>THU</div>
              <div>FRI</div>
              <div>SAT</div>
            </div>

            <div className="grid grid-cols-7 gap-2">
              {calendarCells.map((dayNum, idx) => {
                if (dayNum === null) {
                  return <div key={`empty-${idx}`} className="h-16 bg-slate-50/50 rounded-lg"></div>;
                }

                const dayOfWeek = idx % 7;
                const isSunday = dayOfWeek === 0;
                const holiday = getHolidayForDay(dayNum);
                const isSelected = selectedDay === dayNum;

                let cellBg = 'bg-white hover:bg-slate-50';
                let borderStyle = 'border border-slate-200';
                let textStyle = 'text-slate-800';

                if (isSunday) {
                  cellBg = 'bg-red-50/50 hover:bg-red-50';
                  textStyle = 'text-red-600 font-semibold';
                }

                if (holiday) {
                  cellBg = 'bg-emerald-50 hover:bg-emerald-100';
                  textStyle = 'text-emerald-700 font-bold';
                  borderStyle = 'border-2 border-emerald-300';
                }

                if (isSelected) {
                  borderStyle = 'border-2 border-[#6E1D1D] ring-2 ring-[#6E1D1D]/20';
                }

                return (
                  <button
                    key={`day-${dayNum}`}
                    type="button"
                    onClick={() => handleSelectDay(dayNum)}
                    className={`h-16 p-2 rounded-lg flex flex-col justify-between items-start transition-all relative text-left ${cellBg} ${borderStyle}`}
                  >
                    <span className={`text-xs ${textStyle}`}>{dayNum}</span>
                    {holiday && (
                      <span className="block w-full text-[10px] truncate text-emerald-800" title={holiday.name}>
                        {holiday.name}
                      </span>
                    )}
                    {isSunday && !holiday && <span className="block text-[8px] text-red-400 font-normal">Weekly</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </Card>

        <Card className="p-6">
          {selectedDay === null ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="text-slate-400 text-3xl mb-2">📅</div>
              <p className="font-semibold text-slate-700">No date selected</p>
              <p className="text-xs text-slate-400 mt-1 max-w-[200px]">
                Click on any calendar day to view details or add new holidays.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="font-bold text-slate-800">
                  {MONTHS[currentMonth]} {selectedDay}, {currentYear}
                </h3>
                <Button variant="ghost" className="h-8 w-8 !p-0" onClick={() => setSelectedDay(null)}>
                  ✕
                </Button>
              </div>

              {formError && <Alert tone="error">{formError}</Alert>}

              {(() => {
                const holiday = getHolidayForDay(selectedDay);
                const dayDate = new Date(Date.UTC(currentYear, currentMonth, selectedDay));
                const isSunday = dayDate.getUTCDay() === 0;

                if (!isEditing && holiday) {
                  return (
                    <div className="space-y-4">
                      <div>
                        <span className="text-xs text-slate-400 uppercase tracking-wider">Holiday Name</span>
                        <p className="font-semibold text-slate-800 text-lg">{holiday.name}</p>
                      </div>

                      {holiday.description && (
                        <div>
                          <span className="text-xs text-slate-400 uppercase tracking-wider">Description</span>
                          <p className="text-sm text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 mt-1">
                            {holiday.description}
                          </p>
                        </div>
                      )}

                      <div className="pt-2 flex flex-col gap-2">
                        {isSunday && <Badge>Sunday Weekly Holiday</Badge>}
                        {!isSunday && <Badge>Company Public Holiday</Badge>}
                      </div>

                      {canManageHolidays && (
                        <div className="flex gap-2 pt-4 border-t">
                          <Button variant="secondary" className="flex-1" onClick={() => setIsEditing(true)}>
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            className="text-red-600 hover:bg-red-50"
                            onClick={handleDeleteHoliday}
                            disabled={isSubmitting}
                          >
                            Delete
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                }

                if (isEditing && canManageHolidays) {
                  return (
                    <form onSubmit={handleSaveHoliday} className="space-y-4">
                      <Field
                        label="Holiday Name"
                        placeholder="e.g. Independence Day"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        required
                        disabled={isSubmitting}
                      />

                      <TextAreaField
                        label="Description (Optional)"
                        placeholder="Short description of the holiday..."
                        value={formDescription}
                        onChange={(e) => setFormDescription(e.target.value)}
                        disabled={isSubmitting}
                        rows={3}
                      />

                      <div className="flex gap-2 pt-2">
                        <Button type="submit" className="flex-1" isLoading={isSubmitting}>
                          {holiday ? 'Update' : 'Save'}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            if (holiday) {
                              setFormName(holiday.name);
                              setFormDescription(holiday.description || '');
                              setIsEditing(false);
                            } else {
                              setSelectedDay(null);
                            }
                          }}
                          disabled={isSubmitting}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  );
                }

                return (
                  <div className="space-y-2 py-6 text-center text-slate-500">
                    <p className="font-semibold text-slate-700">{isSunday ? 'Weekly Holiday' : 'Regular Workday'}</p>
                    <p className="text-xs">
                      {isSunday
                        ? 'Sundays are automatically treated as weekly non-working days.'
                        : 'No official holiday is scheduled for this date.'}
                    </p>
                  </div>
                );
              })()}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------- Leave Types Tab
function LeaveTypesTab() {
  const { user } = useAuth();
  const isAdminOrHr = user?.role === 'admin' || user?.role === 'hr';

  const { data: leaveTypes, isLoading, mutate } = useLeaveTypes();
  const [showForm, setShowForm] = useState(false);
  const [editingType, setEditingType] = useState<LeaveType | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    annualQuota: null as number | null,
    carryForward: false,
    maxCarryForward: 0,
    encashable: false,
    requiresDocument: false,
  });

  const handleEdit = (type: LeaveType) => {
    setEditingType(type);
    setFormData({
      name: type.name,
      code: type.code,
      annualQuota: type.annualQuota,
      carryForward: type.carryForward,
      maxCarryForward: type.maxCarryForward,
      encashable: type.encashable,
      requiresDocument: type.requiresDocument,
    });
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingType(null);
    setFormData({
      name: '',
      code: '',
      annualQuota: null,
      carryForward: false,
      maxCarryForward: 0,
      encashable: false,
      requiresDocument: false,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (editingType) {
        await leaveApi.updateLeaveType(editingType.id, formData);
      } else {
        await leaveApi.createLeaveType(formData);
      }
      await mutate();
      handleCancel();
    } catch (err: any) {
      setError(err instanceof Error ? err.message : `Failed to ${editingType ? 'update' : 'create'} leave type`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate/delete this leave type?')) {
      return;
    }
    setError(null);
    try {
      await leaveApi.deleteLeaveType(id);
      await mutate();
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Failed to delete leave type');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-slate-800">Leave Policies</h2>
          <p className="text-sm text-slate-500">Manage leave policies and quotas.</p>
        </div>
        {isAdminOrHr && (
          <Button onClick={() => {
            if (showForm) {
              handleCancel();
            } else {
              setShowForm(true);
            }
          }}>{showForm ? 'Cancel' : 'Add Leave Type'}</Button>
        )}
      </div>

      {showForm && isAdminOrHr && (
        <Card className="p-6">
          <h3 className="text-lg font-medium text-slate-800 mb-4">{editingType ? 'Edit Leave Type' : 'New Leave Type'}</h3>
          {error && <Alert tone="error">{error}</Alert>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
              <Field
                label="Code (e.g., SL, AL, LWP)"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                required
                disabled={!!editingType}
              />
              <Field
                type="number"
                label="Annual Quota (Days)"
                value={formData.annualQuota ?? ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    annualQuota: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
                min={0}
              />
              <div className="flex items-center space-x-2 pt-8">
                <input
                  type="checkbox"
                  id="carryForward"
                  checked={formData.carryForward}
                  onChange={(e) => setFormData({ ...formData, carryForward: e.target.checked })}
                />
                <label htmlFor="carryForward" className="text-sm text-slate-700">
                  Carry Forward Allowed
                </label>
              </div>
              {formData.carryForward && (
                <Field
                  type="number"
                  label="Max Carry Forward"
                  value={formData.maxCarryForward}
                  onChange={(e) => setFormData({ ...formData, maxCarryForward: Number(e.target.value) })}
                  min={0}
                />
              )}
              <div className="flex items-center space-x-2 pt-8">
                <input
                  type="checkbox"
                  id="encashable"
                  checked={formData.encashable}
                  onChange={(e) => setFormData({ ...formData, encashable: e.target.checked })}
                />
                <label htmlFor="encashable" className="text-sm text-slate-700">
                  Encashable
                </label>
              </div>
              <div className="flex items-center space-x-2 pt-8">
                <input
                  type="checkbox"
                  id="requiresDocument"
                  checked={formData.requiresDocument}
                  onChange={(e) => setFormData({ ...formData, requiresDocument: e.target.checked })}
                />
                <label htmlFor="requiresDocument" className="text-sm text-slate-700">
                  Requires Document (e.g., Medical Cert)
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              {editingType && (
                <Button type="button" variant="secondary" onClick={handleCancel}>
                  Cancel
                </Button>
              )}
              <Button type="submit" isLoading={submitting}>
                {editingType ? 'Update Leave Type' : 'Create Leave Type'}
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
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-medium text-slate-600">Name</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Code</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Annual Quota</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Carry Forward</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Flags</th>
                  {isAdminOrHr && <th className="px-4 py-3 font-medium text-slate-600">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leaveTypes?.filter((type: LeaveType) => type.status === 'Active').map((type: LeaveType) => (
                  <tr key={type.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{type.name}</td>
                    <td className="px-4 py-3 text-slate-600">{type.code}</td>
                    <td className="px-4 py-3 text-slate-800">
                      {type.annualQuota === null ? 'Unlimited' : `${type.annualQuota} days`}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {type.carryForward ? `Yes (Max: ${type.maxCarryForward})` : 'No'}
                    </td>
                    <td className="px-4 py-3 flex gap-2">
                      {type.encashable && <Badge>Encashable</Badge>}
                      {type.requiresDocument && <Badge>Requires Doc</Badge>}
                      <Badge>{type.status}</Badge>
                    </td>
                    {isAdminOrHr && (
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button variant="secondary" className="!h-8 !px-2.5 !text-xs" onClick={() => handleEdit(type)}>
                            Edit
                          </Button>
                          <Button variant="ghost" className="!h-8 !px-2.5 !text-xs text-red-600 hover:bg-red-50" onClick={() => handleDelete(type.id)}>
                            Delete
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {(!leaveTypes || leaveTypes.filter((t: LeaveType) => t.status === 'Active').length === 0) && (
                  <tr>
                    <td colSpan={isAdminOrHr ? 6 : 5} className="px-4 py-8">
                      <EmptyState
                        title="No leave types configured"
                        description="Add a leave type to define the company policy."
                      />
                    </td>
                  </tr>
                )}
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
