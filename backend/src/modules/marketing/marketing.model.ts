import { Schema, model, Types } from 'mongoose';
import { basePlugin, type BaseDocument } from '../../core/db/basePlugin.js';

// ─── 1. DAILY WORK LOG MODEL ────────────────────────────────────────────────
export interface IMarketingDailyLog extends BaseDocument {
  userId: Types.ObjectId;
  date: Date;
  category: string; // 'Planned task', 'Ad-hoc', 'Meeting', 'Shoot', 'Learning', 'Event', 'Leave'
  taskTitle: string;
  hoursSpent: number;
  description: string;
  outputLink?: string;
  statusAfterToday: string; // 'Done', 'In Progress', 'Blocked'
  isBackdated: boolean;
}

const marketingDailyLogSchema = new Schema<IMarketingDailyLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: Date, required: true, index: true },
    category: { type: String, required: true, default: 'Planned task' },
    taskTitle: { type: String, required: true, trim: true },
    hoursSpent: { type: Number, required: true, min: 0.1, max: 24 },
    description: { type: String, required: true, trim: true },
    outputLink: { type: String, trim: true },
    statusAfterToday: { type: String, required: true, default: 'In Progress' },
    isBackdated: { type: Boolean, default: false },
  },
  { timestamps: true }
);
marketingDailyLogSchema.plugin(basePlugin);

export const MarketingDailyLog = model<IMarketingDailyLog>('MarketingDailyLog', marketingDailyLogSchema);


// ─── 2. MARKETING TASK & CONTENT MODEL ──────────────────────────────────────
export interface IMarketingTask extends BaseDocument {
  title: string;
  description?: string;
  type: string; // 'Video Editing', 'Reel Creation', 'Graphic Design', 'Poster/Creative', 'AI Content', 'Copywriting', 'Ad Setup', 'Photography/Shoot', 'Event Planning', 'SEO/Website', 'Other'
  assignedTo: Types.ObjectId;
  assignedBy?: Types.ObjectId;
  status: string; // 'Backlog', 'To Do', 'In Progress', 'In Review', 'Revision Needed', 'Approved', 'Done', 'On Hold', 'Cancelled'
  priority: string; // 'Low', 'Medium', 'High', 'Urgent'
  startDate?: Date;
  dueDate?: Date;
  estimatedHours?: number;
  actualHours?: number;
  isContent?: boolean;
  platform?: string; // 'Instagram', 'Facebook', 'LinkedIn', 'YouTube', 'Google Ads', 'Website', 'Other'
  postUrl?: string;
  city?: string;
  staleAlert?: boolean;
  carryForwardCount: number;
}

const marketingTaskSchema = new Schema<IMarketingTask>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    type: { type: String, required: true, default: 'Graphic Design' },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      required: true,
      default: 'To Do',
      enum: ['Backlog', 'To Do', 'In Progress', 'In Review', 'Revision Needed', 'Approved', 'Done', 'On Hold', 'Cancelled'],
      index: true,
    },
    priority: { type: String, default: 'Medium', enum: ['Low', 'Medium', 'High', 'Urgent'] },
    startDate: { type: Date },
    dueDate: { type: Date, index: true },
    estimatedHours: { type: Number, default: 0 },
    actualHours: { type: Number, default: 0 },
    isContent: { type: Boolean, default: false },
    platform: { type: String, trim: true },
    postUrl: { type: String, trim: true },
    city: { type: String, trim: true, default: 'Indore' },
    staleAlert: { type: Boolean, default: false },
    carryForwardCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);
marketingTaskSchema.plugin(basePlugin);

export const MarketingTask = model<IMarketingTask>('MarketingTask', marketingTaskSchema);


// ─── 3. BUDGET & SPEND LEDGER MODEL ─────────────────────────────────────────
export interface IMarketingBudget extends BaseDocument {
  month: string; // e.g. '2026-10'
  period: string; // 'Monthly', 'Quarterly', 'Half-Yearly'
  plannedAmount: number; // in Rupees
  notes?: string;
  approvedBy?: Types.ObjectId;
}

const marketingBudgetSchema = new Schema<IMarketingBudget>(
  {
    month: { type: String, required: true, unique: true, index: true },
    period: { type: String, default: 'Monthly', enum: ['Monthly', 'Quarterly', 'Half-Yearly'] },
    plannedAmount: { type: Number, required: true, min: 0 },
    notes: { type: String, trim: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);
marketingBudgetSchema.plugin(basePlugin);

export const MarketingBudget = model<IMarketingBudget>('MarketingBudget', marketingBudgetSchema);

export interface IMarketingSpend extends BaseDocument {
  date: Date;
  campaignName: string;
  platform: string; // 'Meta (FB/Insta)', 'Google Ads', 'LinkedIn', 'YouTube', 'Offline / Event', 'Other'
  city: string; // 'Indore', 'Bhopal', 'Ujjain', 'National', etc.
  amount: number; // in Rupees
  type: string; // 'Ad spend', 'Influencer', 'Production/shoot', 'Event', 'Printing/OOH', 'Tools/software', 'Freelancer', 'Other'
  receiptUrl?: string;
  paymentStatus: string; // 'Pending', 'Paid'
  notes?: string;
  enteredBy?: Types.ObjectId;
}

const marketingSpendSchema = new Schema<IMarketingSpend>(
  {
    date: { type: Date, required: true, default: Date.now, index: true },
    campaignName: { type: String, required: true, trim: true, default: 'Brand Awareness' },
    platform: { type: String, required: true, default: 'Meta (FB/Insta)' },
    city: { type: String, required: true, default: 'Indore', index: true },
    amount: { type: Number, required: true, min: 0 },
    type: { type: String, required: true, default: 'Ad spend' },
    receiptUrl: { type: String, trim: true },
    paymentStatus: { type: String, default: 'Paid', enum: ['Pending', 'Paid'] },
    notes: { type: String, trim: true },
    enteredBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);
marketingSpendSchema.plugin(basePlugin);

export const MarketingSpend = model<IMarketingSpend>('MarketingSpend', marketingSpendSchema);


// ─── 4. MARKETING INBOUND LEAD & ROI MODEL ──────────────────────────────────
export interface IMarketingLead extends BaseDocument {
  companyName: string;
  contactPerson: string;
  designation?: string;
  phone: string;
  email?: string;
  city: string;
  sourcePlatform: string; // 'Instagram', 'Facebook', 'LinkedIn', 'Google', 'WhatsApp', 'Referral', 'Event', 'Other'
  serviceInterested?: string;
  stage: string; // 'New', 'Contacted', 'Meeting Done', 'Proposal Sent', 'Negotiation', 'Won', 'Lost'
  dealValue?: number; // In Rupees, recorded when Won
  lostReason?: string;
  notes?: string;
  owner?: Types.ObjectId;
}

const marketingLeadSchema = new Schema<IMarketingLead>(
  {
    companyName: { type: String, required: true, trim: true },
    contactPerson: { type: String, required: true, trim: true },
    designation: { type: String, trim: true },
    phone: { type: String, required: true, trim: true, index: true },
    email: { type: String, trim: true },
    city: { type: String, required: true, default: 'Indore', index: true },
    sourcePlatform: {
      type: String,
      required: true,
      default: 'Instagram',
      trim: true,
      index: true,
    },
    serviceInterested: { type: String, trim: true, default: 'Outdoor Advertising' },
    stage: {
      type: String,
      required: true,
      default: 'New',
      enum: ['New', 'Contacted', 'Meeting Done', 'Proposal Sent', 'Negotiation', 'Won', 'Lost'],
      index: true,
    },
    dealValue: { type: Number, default: 0 },
    lostReason: { type: String, trim: true },
    notes: { type: String, trim: true },
    owner: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);
marketingLeadSchema.plugin(basePlugin);

export const MarketingLead = model<IMarketingLead>('MarketingLead', marketingLeadSchema);
