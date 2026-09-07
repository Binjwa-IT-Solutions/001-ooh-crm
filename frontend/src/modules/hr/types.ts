export type AttendanceStatus = 'Present' | 'Absent' | 'Leave' | 'Break' | 'Half-Day' | 'Late';
export type WorkType = 'Office' | 'Remote' | 'Field Visit';
export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';

export interface EmployeeRef {
  id: string;
  name?: string;
  fullName?: string;
  department?: string;
  [key: string]: unknown;
}

export interface IGps {
  lat: number;
  lng: number;
}

export interface Attendance {
  id: string;
  _id?: string;
  employeeId: EmployeeRef | string;
  date: string;
  checkInTime?: string;
  checkOutTime?: string;
  checkInGps?: IGps;
  checkOutGps?: IGps;
  totalHours?: number;
  workType: WorkType;
  status: AttendanceStatus;
  deviceInfo?: string;
}

export interface LeaveType {
  id: string;
  _id?: string;
  name: string;
  code: string;
  annualQuota: number | null;
  carryForward: boolean;
  maxCarryForward: number;
  encashable: boolean;
  requiresDocument: boolean;
  status: 'Active' | 'Inactive';
}

export interface LeaveRequest {
  id: string;
  _id?: string;
  employeeId: EmployeeRef | string;
  leaveTypeId: LeaveType | string;
  fromDate: string;
  toDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  documentUrl?: string;
  approverId?: string;
  rejectionReason?: string;
  approvedAt?: string | null;
  employeeName?: string;
  employeeCode?: string;
  department?: string;
  leaveTypeName?: string;
  allocated?: number;
  used?: number;
  remaining?: number;
  attendance?: Array<{
    id: string;
    date: string;
    checkInTime?: string;
    checkOutTime?: string;
    totalHours?: number;
    status: string;
    workType: WorkType;
  }>;
  createdAt: string;
}

export interface LeaveBalance {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  leaveTypeName: string;
  year: number;
  allocated: number;
  used: number;
  carriedForward: number;
  balance: number;
}

export interface Holiday {
  id: string;
  name: string;
  date: string;
  description?: string;
}

export interface DayAttendanceDetail {
  status: string;
  checkInTime?: string | Date;
  checkOutTime?: string | Date;
  totalHours?: number;
  workType?: string;
  location?: string;
}

export interface MonthlyRegisterRow {
  employee: EmployeeRef;
  attendance: Record<string | number, string>;
  details?: Record<string | number, DayAttendanceDetail>;
}

export interface AbsenceRow {
  date: string;
  employee: EmployeeRef;
  status: string;
}

export type CandidateStatus = 'Scheduled' | 'Interviewed' | 'Selected' | 'Rejected' | 'On Hold';

export interface Candidate {
  _id: string;
  name: string;
  email: string;
  mobile: string;
  position: string;
  interviewDate: string;
  interviewedBy?: { _id: string; name: string } | string;
  status: CandidateStatus;
  resumeFileKey?: string | null;
  resumeUrl?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CandidateListQuery {
  search?: string;
  status?: CandidateStatus | '';
  position?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}
