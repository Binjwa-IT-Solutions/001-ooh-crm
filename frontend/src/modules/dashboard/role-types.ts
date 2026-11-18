/** Shapes returned by /api/dashboard/me, /hr and /ops (see backend role-dashboards.service.ts). */

export interface Holiday {
  name: string;
  date: string;
}

export type MyDashboard =
  | { hasProfile: false; holidays: Holiday[] }
  | {
      hasProfile: true;
      employee: { name: string; department: string | null; designation: string };
      today: {
        status: string | null;
        checkInTime: string | null;
        checkOutTime: string | null;
        lateMinutes: number | null;
        isSunday: boolean;
      };
      month: {
        workingDays: number;
        present: number;
        late: number;
        halfDay: number;
        leave: number;
        absent: number;
        hoursWorked: number;
        avgCheckInMinutes: number | null;
        avgLateMinutes: number | null;
      };
      leave: {
        balances: { type: string; balance: number; allocated: number; used: number }[];
        pending: number;
        next: { type: string; fromDate: string; toDate: string; days: number } | null;
      };
      tasks: {
        open: number;
        overdue: number;
        items: { id: string; title: string; type: string; status: string; deadline: string }[];
      };
      holidays: Holiday[];
    };

export interface HrDashboardData {
  today: {
    date: string;
    isSunday: boolean;
    total: number;
    checkedIn: number;
    late: number;
    onLeave: number;
    notCheckedIn: number;
    stillWorking: number;
  };
  actions: {
    pendingLeaves: number;
    pendingLogins: number;
    incompleteProfiles: number;
    leaveRequests: {
      id: string;
      employeeName: string;
      type: string;
      fromDate: string;
      toDate: string;
      days: number;
      requestedAt: string | null;
    }[];
  };
  awayThisWeek: { employeeName: string; type: string; fromDate: string; toDate: string }[];
  lateThisMonth: { employeeName: string; count: number }[];
  recruitment: {
    pipeline: Record<string, number>;
    upcomingInterviews: { name: string; position: string; date: string; status: string }[];
  };
  people: {
    byDepartment: { department: string; count: number }[];
    newJoiners: { name: string; department: string | null; date: string }[];
    birthdays: { name: string; date: string }[];
  };
  holidays: Holiday[];
}

export interface OpsCampaign {
  id: string;
  code: string;
  name: string;
  city?: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
}

export interface OpsDashboardData {
  campaigns: { live: number; inProgress: number; startingThisWeek: OpsCampaign[]; endingThisWeek: OpsCampaign[] };
  tasks: {
    open: number;
    overdue: number;
    dueToday: number;
    unassigned: number;
    byType: { type: string; count: number }[];
    urgent: {
      id: string;
      title: string;
      type: string;
      status: string;
      deadline: string;
      assignee: string | null;
      campaign: string | null;
      proofRequired: boolean;
    }[];
  };
  proofs: { pendingReview: number; rejectedThisWeek: number };
  sites: { total: number; available: number; booked: number };
}
