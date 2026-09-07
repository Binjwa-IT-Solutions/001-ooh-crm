/**
 * THE PERMISSION MATRIX — one file, one source of truth.
 *
 * Adding a module?  Add its permission strings to `PERMISSIONS`, then grant them
 * to the roles that need them in `ROLE_PERMISSIONS`. Do not invent ad-hoc role
 * checks inside your controllers — declare the permission on the route instead:
 *
 *   router.get('/', requireAuth, requirePermission('leads.view'), controller.list);
 */

export const ROLES = [
  'admin',
  'manager',
  'sales_agent',
  'ops',
  'finance',
  'hr',
  'employee',
] as const;

export type Role = (typeof ROLES)[number];

/** Human labels for the UI. */
export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrator',
  manager: 'Manager',
  sales_agent: 'Sales Agent',
  ops: 'Operations',
  finance: 'Finance',
  hr: 'HR',
  employee: 'Employee',
};

/**
 * Every permission the system knows about. Grouped by module so it stays
 * readable as the modules land (Tracks A–H in the developer spec).
 */
export const PERMISSIONS = [
  // Users / auth administration
  'users.view',
  'users.create',
  'users.update',

  // Track A — Leads & CRM
  'leads.view',
  'leads.create',
  'leads.claim',
  'leads.update',
  'leads.assign',
  'leads.log_call',

  // Track B — Proposals & quotations
  'quotations.view',
  'quotations.create',
  'quotations.update',

  // Track C — Inventory, bookings, vendors, POs
  'sites.view',
  'sites.manage',
  'bookings.view',
  'bookings.manage',
  'vendors.view',
  'vendors.manage',
  'purchase_orders.view',
  'purchase_orders.manage',

  // Track D — Campaigns, tasks, escalations
  'campaigns.view',
  'campaigns.manage',
  'tasks.view',
  'tasks.manage',

  // Track E — Proof of display
  'proofs.view',
  'proofs.upload',
  'proofs.approve',

  // Track F — Finance
  'finance.view',
  'finance.manage',
  'finance.bank_details',

  // Track G — HR
  'employees.view',
  'employees.manage',
  // Reading your own employee record — everyone has this.
  'employees.self',
  // PAN, Aadhaar, bank details, CTC. Stripped in the service for everyone else.
  'employees.sensitive',
  'attendance.self',
  'attendance.view_team',
  'leave.self',
  'leave.manage',
  'holiday.manage',
  'reports.view',
  'candidates.view',
  'candidates.manage',

  // Track H — Audit
  'audit.view',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Permissions every signed-in user gets, whatever their role. */
const BASE: Permission[] = ['attendance.self', 'leave.self', 'employees.self'];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  // Admin gets everything. Keep this as the only wildcard in the system.
  admin: PERMISSIONS,

  manager: [
    ...BASE,
    'users.view',
    'leads.view',
    'leads.create',
    'leads.update',
    'leads.assign',
    'leads.log_call',
    'quotations.view',
    'quotations.create',
    'quotations.update',
    'sites.view',
    'bookings.view',
    'vendors.view',
    'purchase_orders.view',
    'campaigns.view',
    'campaigns.manage',
    'tasks.view',
    'tasks.manage',
    'proofs.view',
    'proofs.approve',
    'finance.view',
    'employees.view',
    'attendance.view_team',
    'leave.manage',
    'reports.view',
    'candidates.view',
    'candidates.manage',
  ],

  sales_agent: [
    ...BASE,
    'leads.view',
    'leads.create',
    'leads.claim',
    'leads.update',
    'leads.log_call',
    'quotations.view',
    'quotations.create',
    'quotations.update',
    'sites.view',
    'bookings.view',
    'campaigns.view',
    'tasks.view',
    'proofs.view',
  ],

  ops: [
    ...BASE,
    'sites.view',
    'sites.manage',
    'bookings.view',
    'bookings.manage',
    'vendors.view',
    'vendors.manage',
    'purchase_orders.view',
    'purchase_orders.manage',
    'campaigns.view',
    'campaigns.manage',
    'tasks.view',
    'tasks.manage',
    'proofs.view',
    'proofs.upload',
  ],

  finance: [
    ...BASE,
    'quotations.view',
    'purchase_orders.view',
    'campaigns.view',
    'vendors.view',
    'finance.view',
    'finance.manage',
    // Bank account / IFSC are Finance + Admin only (developer spec, C3).
    'finance.bank_details',
    'employees.view',
    'employees.sensitive',
    'audit.view',
  ],

  hr: [
    ...BASE,
    'users.view',
    'employees.view',
    'employees.manage',
    'employees.sensitive',
    'attendance.view_team',
    'leave.manage',
    'reports.view',
    'candidates.view',
    'candidates.manage',
  ],

  employee: [...BASE, 'tasks.view'],
};

export function permissionsForRole(role: string): readonly Permission[] {
  return ROLE_PERMISSIONS[role as Role] ?? [];
}

export function roleHasPermission(role: string, permission: Permission): boolean {
  return permissionsForRole(role).includes(permission);
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}
