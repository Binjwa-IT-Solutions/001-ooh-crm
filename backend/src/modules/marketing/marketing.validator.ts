import { z } from 'zod';

// 1. Daily Work Log Schemas
export const createDailyLogSchema = z.object({
  date: z.string().or(z.date()).transform((val) => new Date(val)),
  category: z.string().min(1).default('Planned task'),
  taskTitle: z.string().min(1, 'Task title is required'),
  hoursSpent: z.number().min(0.1, 'Hours must be at least 0.1').max(24, 'Cannot exceed 24 hours'),
  description: z.string().min(1, 'Description is required'),
  outputLink: z.string().optional().or(z.literal('')),
  statusAfterToday: z.enum(['Done', 'In Progress', 'Blocked']).default('In Progress'),
});

export const listDailyLogsSchema = z.object({
  date: z.string().optional(),
  userId: z.string().optional(),
  category: z.string().optional(),
});

// 2. Marketing Task Schemas
export const createMarketingTaskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  type: z.string().min(1).default('Graphic Design'),
  assignedTo: z.string().optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Urgent']).default('Medium'),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  estimatedHours: z.number().optional().default(0),
  isContent: z.boolean().optional().default(false),
  platform: z.string().optional(),
  postUrl: z.string().optional(),
  city: z.string().optional().default('Indore'),
});

export const updateTaskStatusSchema = z.object({
  status: z.enum(['Backlog', 'To Do', 'In Progress', 'In Review', 'Revision Needed', 'Approved', 'Done', 'On Hold', 'Cancelled']),
  reason: z.string().optional(),
});

export const updateMarketingTaskSchema = createMarketingTaskSchema.partial().extend({
  status: z.enum(['Backlog', 'To Do', 'In Progress', 'In Review', 'Revision Needed', 'Approved', 'Done', 'On Hold', 'Cancelled']).optional(),
  actualHours: z.number().optional(),
  postUrl: z.string().optional(),
});

// 3. Budget & Spend Schemas
export const setBudgetSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Format must be YYYY-MM (e.g. 2026-10)'),
  period: z.string().optional().default('Monthly'),
  plannedAmount: z.number().min(0, 'Planned amount must be non-negative'),
  notes: z.string().optional(),
});

export const createSpendSchema = z.object({
  date: z.string().or(z.date()).transform((val) => new Date(val)).optional(),
  campaignName: z.string().min(1, 'Campaign/Activity name is required'),
  platform: z.string().min(1).default('Meta (FB/Insta)'),
  city: z.string().min(1).default('Indore'),
  amount: z.number().min(1, 'Spend amount must be greater than 0'),
  type: z.string().default('Ad spend'),
  receiptUrl: z.string().optional(),
  paymentStatus: z.enum(['Pending', 'Paid']).default('Paid'),
  notes: z.string().optional(),
});

// 4. Lead Schemas
export const createMarketingLeadSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  contactPerson: z.string().min(1, 'Contact person is required'),
  designation: z.string().optional(),
  phone: z.string().min(3, 'Phone number is required'),
  email: z.string().optional().or(z.literal('')),
  city: z.string().min(1).default('Indore'),
  sourcePlatform: z.string().min(1).default('Instagram'),
  serviceInterested: z.string().optional(),
  notes: z.string().optional(),
});

export const updateLeadStageSchema = z.object({
  stage: z.enum(['New', 'Contacted', 'Meeting Done', 'Proposal Sent', 'Negotiation', 'Won', 'Lost']),
  dealValue: z.number().optional(),
  lostReason: z.string().optional(),
  notes: z.string().optional(),
});
