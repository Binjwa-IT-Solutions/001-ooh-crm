export const ROLES = [
  'admin',
  'manager',
  'sales_agent',
  'ops',
  'finance',
  'hr',
  'employee',
] as const;

export const USER_ASSIGNABLE_ROLES = [
  'admin',
  'manager',
  'sales_agent',
  'ops',
  'finance',
  'hr',
  'employee',
] as const;

export type Role = (typeof ROLES)[number];
export type AssignableRole = (typeof USER_ASSIGNABLE_ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrator',
  manager: 'Manager',
  sales_agent: 'Sales Agent',
  ops: 'Operations',
  finance: 'Finance',
  hr: 'HR',
  employee: 'Employee',
};

export const USER_STATUSES = ['Active', 'Inactive'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  permissions: readonly string[];
  lastLoginAt: string | null;
  createdAt?: string;
  updatedAt?: string;
  reportingManager?: { id: string; fullName: string; designation: string } | null;
  reportingManagerId?: string | null;
}

export interface UserFormValues {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: Role;
  status: UserStatus;
  reportingManagerId?: string;
}

export interface UserListQuery {
  search?: string;
  role?: Role | '';
  status?: UserStatus | '';
  page?: number;
  pageSize?: number;
}

export interface UserListResponse {
  users: User[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
