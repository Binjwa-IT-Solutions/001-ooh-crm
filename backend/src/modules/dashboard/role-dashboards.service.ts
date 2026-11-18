import type { Types } from 'mongoose';

import type { RequestContext } from '../../core/context.js';
import { LoginApproval } from '../../core/auth/security-models.js';
import { Campaign, CampaignStatus } from '../campaigns/campaign.model.js';
import { CandidateModel, CANDIDATE_STATUSES } from '../candidates/candidates.model.js';
import { Employee } from '../employees/employees.model.js';
import Attendance from '../HR/models/attendance.model.js';
import Holiday from '../HR/models/holiday.model.js';
import { LeaveRequest, LeaveType } from '../HR/models/leave.model.js';
import { getBalanceForEmployee } from '../HR/services/leave.service.js';
import { Proof } from '../proofs/proof.model.js';
import { AvailabilityStatus, Site } from '../sites/site.model.js';
import { Task } from '../tasks/task.model.js';

/**
 * Role dashboards: the "what's in front of me" pages for people who don't
 * live in the finance numbers.
 *
 *   GET /api/dashboard/me   → My day (every user with an employee profile)
 *   GET /api/dashboard/hr   → HR desk (hr, admin)
 *   GET /api/dashboard/ops  → Operations desk (ops, admin, manager)
 *
 * Every number here comes from data the app already stores.
 */

// ---------------------------------------------------------------------------
// Date helpers (attendance rows are stored at server-local midnight)
// ---------------------------------------------------------------------------

function startOfDay(d = new Date()): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}
function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}
function startOfMonth(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}
function lateMinutes(checkIn?: Date | null, shiftStart?: string): number | null {
  if (!checkIn || !shiftStart) return null;
  const [h, m] = shiftStart.split(':').map(Number);
  if (Number.isNaN(h)) return null;
  const expected = new Date(checkIn);
  expected.setHours(h, m || 0, 0, 0);
  return Math.max(0, Math.round((checkIn.getTime() - expected.getTime()) / 60000));
}
const round1 = (n: number) => Math.round(n * 10) / 10;
const iso = (d?: Date | null) => (d ? d.toISOString() : null);

async function upcomingHolidays(limit = 3) {
  const rows = await Holiday.find({ date: { $gte: startOfDay() }, deletedAt: null }).sort({ date: 1 }).limit(limit);
  return rows.map((h) => ({ name: h.name, date: h.date.toISOString() }));
}

// ---------------------------------------------------------------------------
// My day — for every employee
// ---------------------------------------------------------------------------

export async function getMyDashboard(ctx: RequestContext) {
  const employee = await Employee.findOne({ userId: ctx.user.id, deletedAt: null });
  if (!employee) {
    return { hasProfile: false as const, holidays: await upcomingHolidays() };
  }

  const today = startOfDay();
  const monthStart = startOfMonth();

  const [todayRecord, monthRecords, holidaysThisMonth] = await Promise.all([
    Attendance.findOne({ employeeId: employee._id, date: today, deletedAt: null }),
    Attendance.find({ employeeId: employee._id, date: { $gte: monthStart, $lte: today }, deletedAt: null }),
    Holiday.find({ date: { $gte: monthStart, $lte: today }, deletedAt: null }),
  ]);

  // This month so far
  let present = 0;
  let late = 0;
  let halfDay = 0;
  let leave = 0;
  let hours = 0;
  const checkIns: number[] = [];
  const lateMins: number[] = [];
  const recordDays = new Set<number>();

  for (const r of monthRecords) {
    recordDays.add(startOfDay(r.date).getTime());
    if (r.status === 'Leave') leave++;
    else if (r.status === 'Half-Day') halfDay++;
    else if (r.checkInTime || r.status === 'Present' || r.status === 'Late') present++;
    if (r.status === 'Late') {
      late++;
      const lm = lateMinutes(r.checkInTime, r.shiftDetails?.startTime);
      if (lm != null) lateMins.push(lm);
    }
    if (r.checkInTime) checkIns.push(minutesOfDay(r.checkInTime));
    if (r.checkOutTime) hours += r.actualHours ?? r.totalHours ?? 0;
  }

  // Absent = past working days (Mon–Sat, not a holiday) with no record. Today doesn't count yet.
  const holidayDays = new Set(holidaysThisMonth.map((h) => startOfDay(h.date).getTime()));
  let absent = 0;
  let workingDays = 0;
  for (let d = new Date(monthStart); d <= today; d = addDays(d, 1)) {
    if (d.getDay() === 0 || holidayDays.has(d.getTime())) continue;
    workingDays++;
    if (d.getTime() < today.getTime() && !recordDays.has(d.getTime())) absent++;
  }

  // Leave
  const year = today.getFullYear();
  const [balances, pendingLeaves, nextLeave] = await Promise.all([
    getBalanceForEmployee(String(employee._id), year, ctx).catch(() => []),
    LeaveRequest.countDocuments({ employeeId: employee._id, status: 'Pending', deletedAt: null }),
    LeaveRequest.findOne({
      employeeId: employee._id,
      status: 'Approved',
      toDate: { $gte: today },
      deletedAt: null,
    }).sort({ fromDate: 1 }),
  ]);
  const nextLeaveType = nextLeave ? await LeaveType.findById(nextLeave.leaveTypeId).select('name') : null;

  // Tasks
  const openTaskFilter: Record<string, unknown> = { assignedTo: employee._id, status: { $ne: 'Completed' }, deletedAt: null };
  const [openTasks, overdueTasks, taskList] = await Promise.all([
    Task.countDocuments(openTaskFilter),
    Task.countDocuments({ ...openTaskFilter, deadline: { $lt: today } }),
    Task.find(openTaskFilter).sort({ deadline: 1 }).limit(5).select('title type deadline status'),
  ]);

  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

  return {
    hasProfile: true as const,
    employee: { name: employee.fullName, department: employee.department, designation: employee.designation },
    today: {
      status: todayRecord?.status ?? null,
      checkInTime: iso(todayRecord?.checkInTime),
      checkOutTime: iso(todayRecord?.checkOutTime),
      lateMinutes: todayRecord?.status === 'Late' ? lateMinutes(todayRecord.checkInTime, todayRecord.shiftDetails?.startTime) : null,
      isSunday: today.getDay() === 0,
    },
    month: {
      workingDays,
      present,
      late,
      halfDay,
      leave,
      absent,
      hoursWorked: round1(hours),
      avgCheckInMinutes: avg(checkIns),
      avgLateMinutes: avg(lateMins),
    },
    leave: {
      balances: balances
        .filter((b) => b.allocated > 0 || b.balance > 0)
        .map((b) => ({ type: b.leaveTypeName, balance: b.balance, allocated: b.allocated + b.carriedForward, used: b.used })),
      pending: pendingLeaves,
      next: nextLeave
        ? {
            type: nextLeaveType?.name ?? 'Leave',
            fromDate: nextLeave.fromDate.toISOString(),
            toDate: nextLeave.toDate.toISOString(),
            days: nextLeave.days,
          }
        : null,
    },
    tasks: {
      open: openTasks,
      overdue: overdueTasks,
      items: taskList.map((t) => ({
        id: String(t._id),
        title: t.title,
        type: t.type,
        status: t.status,
        deadline: t.deadline.toISOString(),
      })),
    },
    holidays: await upcomingHolidays(),
  };
}

// ---------------------------------------------------------------------------
// HR desk
// ---------------------------------------------------------------------------

export async function getHrDashboard() {
  const today = startOfDay();
  const weekEnd = addDays(today, 7);
  const monthStart = startOfMonth();

  const activeEmployees = await Employee.find({ status: 'Active', deletedAt: null }).select(
    'fullName department designation dateOfJoining dateOfBirth isProfileComplete',
  );
  const nameById = new Map(activeEmployees.map((e) => [String(e._id), e.fullName]));
  const total = activeEmployees.length;

  // ---- Today's attendance -------------------------------------------------
  const todayRows = await Attendance.find({ date: today, deletedAt: null });
  let checkedIn = 0;
  let lateToday = 0;
  let onLeaveToday = 0;
  let stillWorking = 0;
  const seen = new Set<string>();
  for (const r of todayRows) {
    if (!nameById.has(String(r.employeeId))) continue;
    seen.add(String(r.employeeId));
    if (r.status === 'Leave') onLeaveToday++;
    else if (r.checkInTime) {
      checkedIn++;
      if (!r.checkOutTime) stillWorking++;
    }
    if (r.status === 'Late') lateToday++;
  }
  const isSunday = today.getDay() === 0;
  const notCheckedIn = isSunday ? 0 : total - checkedIn - onLeaveToday;

  // ---- Needs action -------------------------------------------------------
  const [pendingLeaveDocs, pendingLeaveCount, pendingLogins, leaveTypes] = await Promise.all([
    LeaveRequest.find({ status: 'Pending', deletedAt: null }).sort({ createdAt: 1 }).limit(6),
    LeaveRequest.countDocuments({ status: 'Pending', deletedAt: null }),
    LoginApproval.countDocuments({ status: 'pending', expiresAt: { $gt: new Date() } }),
    LeaveType.find({}).select('name'),
  ]);
  const typeName = new Map(leaveTypes.map((t) => [String(t._id), t.name]));

  // ---- Who's away this week ----------------------------------------------
  const awayDocs = await LeaveRequest.find({
    status: 'Approved',
    fromDate: { $lte: weekEnd },
    toDate: { $gte: today },
    deletedAt: null,
  }).sort({ fromDate: 1 });

  // ---- Lateness this month -----------------------------------------------
  const lateAgg = await Attendance.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { status: 'Late', date: { $gte: monthStart, $lte: today }, deletedAt: null } },
    { $group: { _id: '$employeeId', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 },
  ]);

  // ---- Recruitment --------------------------------------------------------
  const [candidateAgg, upcomingInterviews] = await Promise.all([
    CandidateModel.aggregate<{ _id: string; count: number }>([
      { $match: { deletedAt: null } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    CandidateModel.find({ interviewDate: { $gte: new Date(), $lte: weekEnd }, deletedAt: null })
      .sort({ interviewDate: 1 })
      .limit(5)
      .select('name position interviewDate status'),
  ]);
  const pipeline = Object.fromEntries(CANDIDATE_STATUSES.map((s) => [s, 0])) as Record<string, number>;
  candidateAgg.forEach((c) => (pipeline[c._id] = c.count));

  // ---- People -------------------------------------------------------------
  const byDepartment: Record<string, number> = {};
  const newJoiners: { name: string; department: string | null; date: string }[] = [];
  const birthdays: { name: string; date: string }[] = [];
  let incompleteProfiles = 0;

  for (const e of activeEmployees) {
    const dept = e.department ?? 'Unassigned';
    byDepartment[dept] = (byDepartment[dept] ?? 0) + 1;
    if (!e.isProfileComplete) incompleteProfiles++;
    if (e.dateOfJoining && e.dateOfJoining >= addDays(today, -30) && e.dateOfJoining <= weekEnd) {
      newJoiners.push({ name: e.fullName, department: e.department ?? null, date: e.dateOfJoining.toISOString() });
    }
    if (e.dateOfBirth) {
      // This year's birthday — within the next 7 days?
      const b = new Date(today.getFullYear(), e.dateOfBirth.getMonth(), e.dateOfBirth.getDate());
      if (b < today) b.setFullYear(b.getFullYear() + 1);
      if (b <= weekEnd) birthdays.push({ name: e.fullName, date: b.toISOString() });
    }
  }
  birthdays.sort((a, b) => a.date.localeCompare(b.date));
  newJoiners.sort((a, b) => b.date.localeCompare(a.date));

  return {
    today: {
      date: today.toISOString(),
      isSunday,
      total,
      checkedIn,
      late: lateToday,
      onLeave: onLeaveToday,
      notCheckedIn,
      stillWorking,
    },
    actions: {
      pendingLeaves: pendingLeaveCount,
      pendingLogins,
      incompleteProfiles,
      leaveRequests: pendingLeaveDocs.map((l) => ({
        id: String(l._id),
        employeeName: nameById.get(String(l.employeeId)) ?? 'Employee',
        type: typeName.get(String(l.leaveTypeId)) ?? 'Leave',
        fromDate: l.fromDate.toISOString(),
        toDate: l.toDate.toISOString(),
        days: l.days,
        requestedAt: iso((l as unknown as { createdAt?: Date }).createdAt),
      })),
    },
    awayThisWeek: awayDocs.map((l) => ({
      employeeName: nameById.get(String(l.employeeId)) ?? 'Employee',
      type: typeName.get(String(l.leaveTypeId)) ?? 'Leave',
      fromDate: l.fromDate.toISOString(),
      toDate: l.toDate.toISOString(),
    })),
    lateThisMonth: lateAgg.map((r) => ({ employeeName: nameById.get(String(r._id)) ?? 'Employee', count: r.count })),
    recruitment: {
      pipeline,
      upcomingInterviews: upcomingInterviews.map((c) => ({
        name: c.name,
        position: c.position,
        date: c.interviewDate.toISOString(),
        status: c.status,
      })),
    },
    people: {
      byDepartment: Object.entries(byDepartment)
        .map(([department, count]) => ({ department, count }))
        .sort((a, b) => b.count - a.count),
      newJoiners: newJoiners.slice(0, 5),
      birthdays: birthdays.slice(0, 5),
    },
    holidays: await upcomingHolidays(),
  };
}

// ---------------------------------------------------------------------------
// Operations desk
// ---------------------------------------------------------------------------

export async function getOpsDashboard() {
  const today = startOfDay();
  const tomorrow = addDays(today, 1);
  const weekEnd = addDays(today, 7);
  const ACTIVE = [CampaignStatus.APPROVED, CampaignStatus.IN_PROGRESS];

  const campaignFields = 'campaignCode name city startDate endDate status';
  const [liveCount, starting, ending, inProgress] = await Promise.all([
    Campaign.countDocuments({ status: { $in: ACTIVE }, startDate: { $lte: today }, endDate: { $gte: today }, deletedAt: null }),
    Campaign.find({ status: { $in: ACTIVE }, startDate: { $gte: today, $lte: weekEnd }, deletedAt: null })
      .sort({ startDate: 1 })
      .limit(6)
      .select(campaignFields),
    Campaign.find({ status: { $in: ACTIVE }, endDate: { $gte: today, $lte: weekEnd }, deletedAt: null })
      .sort({ endDate: 1 })
      .limit(6)
      .select(campaignFields),
    Campaign.countDocuments({ status: CampaignStatus.IN_PROGRESS, deletedAt: null }),
  ]);

  const openTask: Record<string, unknown> = { status: { $ne: 'Completed' }, deletedAt: null };
  const [openTasks, overdueTasks, dueToday, unassigned, urgentTasks, tasksByType] = await Promise.all([
    Task.countDocuments(openTask),
    Task.countDocuments({ ...openTask, deadline: { $lt: today } }),
    Task.countDocuments({ ...openTask, deadline: { $gte: today, $lt: tomorrow } }),
    Task.countDocuments({ ...openTask, assignedTo: null }),
    Task.find({ ...openTask, deadline: { $lt: addDays(today, 3) } })
      .sort({ deadline: 1 })
      .limit(8)
      .populate('assignedTo', 'fullName')
      .populate('campaignId', 'name campaignCode')
      .select('title type deadline status assignedTo campaignId proofRequired'),
    Task.aggregate<{ _id: string; count: number }>([
      { $match: { status: { $ne: 'Completed' }, deletedAt: null } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
  ]);

  const [pendingProofs, rejectedProofs, sitesTotal, sitesAvailable] = await Promise.all([
    Proof.countDocuments({ status: 'Pending' }),
    Proof.countDocuments({ status: 'Rejected', updatedAt: { $gte: addDays(today, -7) } }),
    Site.countDocuments({ deletedAt: null }),
    Site.countDocuments({ deletedAt: null, availability: AvailabilityStatus.AVAILABLE }),
  ]);

  const mapCampaign = (c: InstanceType<typeof Campaign>) => ({
    id: String(c._id),
    code: c.campaignCode,
    name: c.name,
    city: c.city,
    startDate: iso(c.startDate),
    endDate: iso(c.endDate),
    status: c.status,
  });

  return {
    campaigns: {
      live: liveCount,
      inProgress,
      startingThisWeek: starting.map(mapCampaign),
      endingThisWeek: ending.map(mapCampaign),
    },
    tasks: {
      open: openTasks,
      overdue: overdueTasks,
      dueToday,
      unassigned,
      byType: tasksByType.map((t) => ({ type: t._id, count: t.count })),
      urgent: urgentTasks.map((t) => {
        const assignee = t.assignedTo as unknown as { fullName?: string } | null;
        const campaign = t.campaignId as unknown as { name?: string; campaignCode?: string } | null;
        return {
          id: String(t._id),
          title: t.title,
          type: t.type,
          status: t.status,
          deadline: t.deadline.toISOString(),
          assignee: assignee?.fullName ?? null,
          campaign: campaign?.name ?? campaign?.campaignCode ?? null,
          proofRequired: Boolean(t.proofRequired),
        };
      }),
    },
    proofs: { pendingReview: pendingProofs, rejectedThisWeek: rejectedProofs },
    sites: { total: sitesTotal, available: sitesAvailable, booked: sitesTotal - sitesAvailable },
  };
}
