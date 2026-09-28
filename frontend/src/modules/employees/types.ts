/**
 * REFERENCE MODULE — types.
 *
 * These mirror the DTO the API returns (`employees.service.ts`). Keep them in
 * sync by hand; if a field is missing here it simply won't render, which is a
 * cheaper failure than a runtime crash.
 */

export const DEPARTMENTS = [
  'Sales',
  'Operations',
  'Finance',
  'HR',
  'Marketing',
  'Management',
] as const;

export const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Intern'] as const;

export const EMPLOYEE_STATUSES = ['Active', 'On Notice', 'Inactive', 'Resigned'] as const;

export type Department = (typeof DEPARTMENTS)[number];
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export interface Employee {
  id: string;
  employeeCode: string;
  fullName: string;
  workEmail: string;
  personalEmail?: string;
  mobile: string;
  dateOfBirth: string | null;
  department: Department | string;
  designation: string;
  employmentType: EmploymentType | string;
  dateOfJoining: string | null;
  dateOfExit: string | null;
  reportingManager: { id: string; fullName: string; designation: string } | null;
  teamName?: string;
  workLocation: string;
  status: EmployeeStatus;
  isProfileComplete?: boolean;
  emergencyContact?: { name?: string; relationship?: string; mobile?: string };
  address?: string;
  createdAt: string;
  updatedAt: string;

  /**
   * Present only when the signed-in user holds `employees.sensitive`.
   * The server omits them entirely for everyone else — do not assume they exist.
   */
  panNumber?: string;
  aadhaarNumber?: string;
  bankAccountNumber?: string;
  ifsc?: string;
  /** Integer paise. Use `formatPaise` to display; never do maths on it in rupees. */
  annualCtc?: number;
}

export interface EmployeeListResponse {
  employees: Employee[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface EmployeeListQuery {
  search?: string;
  department?: Department | '';
  status?: EmployeeStatus | '';
  page?: number;
  pageSize?: number;
  sortBy?: 'fullName' | 'employeeCode' | 'dateOfJoining' | 'department';
  sortDir?: 'asc' | 'desc';
}

export interface ManagerOption {
  id: string;
  fullName: string;
  designation: string;
  employeeCode: string;
}

export interface TeamMember extends Employee {
  leadsCount?: { total: number; open: number; qualified: number; won: number };
  tasksCount?: { total: number; pending: number; completed: number; overdue: number };
  activeCampaignsCount?: number;
  attendanceToday?: string;
  leaveBalance?: { available: number; used: number };
}

export interface TeamDto {
  id: string;
  name: string;
  description?: string;
  managerId: string;
  manager?: Employee;
  members: TeamMember[];
  memberCount: number;
  summary?: TeamGroup['summary'];
  createdAt: string;
  updatedAt: string;
}

export interface ManagerTeamsGroup {
  manager: Employee & {
    id: string;
    employeeCode: string;
    fullName: string;
    designation: string;
    department: string;
    workEmail: string;
    teamName?: string;
  };
  teams: TeamDto[];
}

export interface TeamGroup {
  id?: string;
  manager: Employee & {
    id: string;
    employeeCode: string;
    fullName: string;
    designation: string;
    department: string;
    workEmail: string;
    teamName?: string;
  };
  teamName: string;
  description?: string;
  members: TeamMember[];
  summary?: {
    totalMembers: number;
    activeMembers: number;
    totalLeads: number;
    openLeads: number;
    qualifiedLeads: number;
    wonLeads: number;
    quotationsCount: number;
    activeCampaignsCount: number;
    pendingTasksCount: number;
  };
}

export interface TeamHierarchyResponse {
  teams: TeamGroup[];
  managers?: ManagerTeamsGroup[];
  unassigned: Employee[];
}

export interface MemberCrmSummaryResponse {
  employee: Employee;
  leads: {
    total: number;
    byStatus: Record<string, number>;
    recent: Array<{
      id: string;
      companyName: string;
      contactPerson: string;
      mobile: string;
      email?: string;
      status: string;
      city?: string;
      budget?: number;
      campaignDuration?: string;
      createdAt: string;
    }>;
  };
  tasks: {
    total: number;
    pending: number;
    completed: number;
    overdue: number;
    recent: Array<{
      id: string;
      title: string;
      type: string;
      status: string;
      deadline: string;
      campaignName?: string;
    }>;
  };
  attendance: {
    today: string;
    thisMonthPresent: number;
    thisMonthLate: number;
    thisMonthHalfDay: number;
  };
  leave: {
    allocated: number;
    used: number;
    balance: number;
  };
}


/** The shape the form produces. Money is in **rupees** here — the API converts. */
export interface EmployeeFormValues {
  fullName: string;
  workEmail: string;
  personalEmail: string;
  mobile: string;
  dateOfBirth: string;
  department: Department | '';
  designation: string;
  employmentType: EmploymentType;
  dateOfJoining: string;
  dateOfExit: string;
  reportingManagerId: string;
  workLocation: string;
  status: EmployeeStatus;
  panNumber: string;
  aadhaarNumber: string;
  bankAccountNumber: string;
  ifsc: string;
  annualCtcRupees: string;
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactMobile: string;
  address: string;
}
