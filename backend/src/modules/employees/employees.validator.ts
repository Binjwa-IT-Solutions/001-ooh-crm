import { z } from 'zod';

import { DEPARTMENTS, EMPLOYEE_STATUSES, EMPLOYMENT_TYPES } from './employees.model.js';

/**
 * Server-side validation. Client-side validation is for UX only — nothing
 * reaches the service until it has been through one of these.
 */

const objectId = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{24}$/, 'Not a valid id');

const isoDate = z.coerce.date();
const optionalDate = z
  .union([z.coerce.date(), z.literal(''), z.null()])
  .optional()
  .transform((val) => (val === '' || val === null || val === undefined ? null : val));

/**
 * Money arrives from the UI in **rupees** and is stored in **integer paise**.
 * Converting at this boundary is the whole trick — everything behind the
 * validator can then assume integers and never has to think about floats.
 */
const rupeesToPaise = z
  .number()
  .nonnegative('Amount cannot be negative')
  .max(1_000_000_000, 'Amount is implausibly large')
  .transform((rupees) => Math.round(rupees * 100));

const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const AADHAAR = /^[0-9]{12}$/;
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const MOBILE = /^[6-9][0-9]{9}$/;

const baseEmployeeShape = {
  fullName: z.string().trim().min(2, 'Full name is required').max(120),
  workEmail: z.string().trim().toLowerCase().email('Enter a valid work email'),
  personalEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email('Enter a valid email')
    .optional()
    .or(z.literal('')),
  mobile: z.string().trim().regex(MOBILE, 'Enter a valid 10-digit Indian mobile number'),
  dateOfBirth: optionalDate,

  department: z.enum(DEPARTMENTS),
  designation: z.string().trim().min(2, 'Designation is required').max(120),
  employmentType: z.enum(EMPLOYMENT_TYPES).default('Full-time'),
  dateOfJoining: isoDate,
  dateOfExit: optionalDate,
  reportingManagerId: objectId.optional().nullable().or(z.literal('')),
  teamName: z.string().trim().max(100).optional().or(z.literal('')),
  workLocation: z.string().trim().min(2, 'Work location is required').max(120),
  status: z.enum(EMPLOYEE_STATUSES).default('Active'),

  panNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(PAN, 'PAN must look like ABCDE1234F')
    .optional()
    .or(z.literal('')),
  aadhaarNumber: z
    .string()
    .trim()
    .regex(AADHAAR, 'Aadhaar must be 12 digits')
    .optional()
    .or(z.literal('')),
  bankAccountNumber: z.string().trim().min(6).max(24).optional().or(z.literal('')),
  ifsc: z
    .string()
    .trim()
    .toUpperCase()
    .regex(IFSC, 'IFSC must look like HDFC0001234')
    .optional()
    .or(z.literal('')),
  /** Sent in rupees, stored in paise. */
  annualCtc: rupeesToPaise.optional(),

  emergencyContact: z
    .object({
      name: z.string().trim().max(120).optional().or(z.literal('')),
      relationship: z.string().trim().max(60).optional().or(z.literal('')),
      mobile: z
        .string()
        .trim()
        .regex(MOBILE, 'Enter a valid 10-digit mobile number')
        .optional()
        .or(z.literal('')),
    })
    .optional(),
  address: z.string().trim().max(500).optional().or(z.literal('')),
};

/**
 * `employeeCode` is deliberately absent — it is server-generated. Anything the
 * client sends under that name is ignored rather than trusted.
 */
export const createEmployeeSchema = z
  .object(baseEmployeeShape)
  .refine((data) => !data.dateOfExit || data.dateOfExit >= data.dateOfJoining, {
    message: 'Exit date cannot be before the joining date',
    path: ['dateOfExit'],
  });

export const updateEmployeeSchema = z
  .object(baseEmployeeShape)
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: 'Nothing to update' });

/**
 * What an employee may set on their own record: personal details, emergency
 * contact/address, and their own PAN/Aadhaar/bank details. Everything else —
 * work email, department, designation, dates, manager, status, CTC — is owned by
 * HR. Unknown keys are stripped, so sending them does nothing.
 */
export const updateMyProfileSchema = z
  .object({
    fullName: baseEmployeeShape.fullName,
    mobile: baseEmployeeShape.mobile,
    personalEmail: baseEmployeeShape.personalEmail,
    dateOfBirth: baseEmployeeShape.dateOfBirth,
    workLocation: baseEmployeeShape.workLocation,
    panNumber: baseEmployeeShape.panNumber,
    aadhaarNumber: baseEmployeeShape.aadhaarNumber,
    bankAccountNumber: baseEmployeeShape.bankAccountNumber,
    ifsc: baseEmployeeShape.ifsc,
    emergencyContact: baseEmployeeShape.emergencyContact,
    address: baseEmployeeShape.address,
  })
  .partial();

export const listEmployeesSchema = z.object({
  search: z.string().trim().max(120).optional(),
  department: z.enum(DEPARTMENTS).optional(),
  status: z.enum(EMPLOYEE_STATUSES).optional(),
  reportingManagerId: objectId.optional(),
  // Pagination is server-side. Never fetch everything and filter in the browser.
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sortBy: z.enum(['fullName', 'employeeCode', 'dateOfJoining', 'department']).default('fullName'),
  sortDir: z.enum(['asc', 'desc']).default('asc'),
});

export const employeeIdSchema = z.object({ id: objectId });

export const createTeamSchema = z.object({
  name: z.string().trim().min(1, 'Team name is required').max(100, 'Team name cannot exceed 100 characters'),
  description: z.string().trim().max(500).optional().default(''),
  managerId: objectId.optional(),
});

export const updateTeamSchema = z.object({
  name: z.string().trim().min(1, 'Team name is required').max(100, 'Team name cannot exceed 100 characters').optional(),
  description: z.string().trim().max(500).optional(),
});

export const addTeamMemberSchema = z.object({
  employeeId: objectId,
});

export const reassignTeamMemberSchema = z.object({
  employeeId: objectId,
  sourceTeamId: objectId,
  targetTeamId: objectId,
});

export const updateTeamNameSchema = z.object({
  managerId: objectId.optional(),
  teamName: z.string().trim().min(1, 'Team name is required').max(100, 'Team name is too long'),
});

export const assignTeamMemberSchema = z.object({
  employeeId: objectId,
  managerId: objectId.nullable().optional(),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type UpdateMyProfileInput = z.infer<typeof updateMyProfileSchema>;
export type ListEmployeesQuery = z.infer<typeof listEmployeesSchema>;
export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
export type AddTeamMemberInput = z.infer<typeof addTeamMemberSchema>;
export type ReassignTeamMemberInput = z.infer<typeof reassignTeamMemberSchema>;
export type UpdateTeamNameInput = z.infer<typeof updateTeamNameSchema>;
export type AssignTeamMemberInput = z.infer<typeof assignTeamMemberSchema>;

