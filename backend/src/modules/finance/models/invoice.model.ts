import mongoose, { Schema, Types } from 'mongoose';
import { basePlugin, type BaseDocument } from '../../../core/db/basePlugin.js';

export const INVOICE_TYPES = ['sales_invoice', 'proforma'] as const;
export type InvoiceType = (typeof INVOICE_TYPES)[number];

export const INVOICE_STATUSES = [
  'Draft',
  'Sent',
  'Partially Paid',
  'Paid',
  'Overdue',
  'Cancelled',
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export interface IInvoiceItem {
  name: string;
  description?: string;
  hsn?: string;
  quantity: number;
  unit: string;
  /** Line item discount in integer paise */
  discount?: number;
  /** Unit rate in integer paise */
  rate: number;
  taxPercent: number;
  /** Tax amount in integer paise */
  taxAmount: number;
  /** Line total in integer paise = (rate * quantity) + taxAmount */
  amount: number;
}

export interface IInvoiceEditLog {
  modifiedBy: Types.ObjectId;
  modifiedAt: Date;
  changesSummary: string;
  note?: string;
}

export interface IBankDetails {
  bankName?: string;
  accountNumber?: string;
  ifsc?: string;
  branch?: string;
  accountHolderName?: string;
}

export interface IInvoice extends BaseDocument {
  type: InvoiceType;
  invoicePrefix: string;
  invoiceNumber: string;
  partyId?: Types.ObjectId | null;
  partyName: string;
  billingAddress?: string;
  shippingAddress?: string;
  gstin?: string;
  placeOfSupply?: string;
  contactPerson?: string;
  contactMobile?: string;
  contactEmail?: string;
  campaignId?: Types.ObjectId | null;
  invoiceDate: Date;
  dueDate: Date;
  items: IInvoiceItem[];
  /** Subtotal before taxes & discounts in integer paise */
  subtotal: number;
  /** Discount in integer paise */
  discount: number;
  /** Additional charges in integer paise */
  additionalCharges: number;
  /** Taxable amount in integer paise */
  taxableAmount: number;
  /** Total tax amount in integer paise */
  taxAmount: number;
  /** TCS in integer paise */
  tcs: number;
  /** Round off adjustment in integer paise */
  roundOff: number;
  /** Final total amount in integer paise */
  totalAmount: number;
  /** Total received amount in integer paise (synced with PaymentIn) */
  amountReceived: number;
  /** Balance pending in integer paise = totalAmount - amountReceived */
  balanceAmount: number;
  status: InvoiceStatus;
  bankDetails?: IBankDetails;
  termsAndConditions?: string;
  notes?: string;
  shareToken?: string;
  editHistory: IInvoiceEditLog[];
  createdBy: Types.ObjectId;
  isDeleted: boolean;
}

const invoiceItemSchema = new Schema<IInvoiceItem>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    hsn: { type: String, default: '998361', trim: true },
    quantity: { type: Number, required: true, min: 0.01, default: 1 },
    unit: { type: String, default: 'Nos', trim: true },
    discount: { type: Number, default: 0, min: 0 },
    rate: { type: Number, required: true, min: 0 },
    taxPercent: { type: Number, default: 18, min: 0, max: 100 },
    taxAmount: { type: Number, default: 0 },
    amount: { type: Number, required: true },
  },
  { _id: false }
);

const invoiceEditLogSchema = new Schema<IInvoiceEditLog>(
  {
    modifiedBy: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    modifiedAt: { type: Date, default: Date.now },
    changesSummary: { type: String, required: true },
    note: { type: String, default: '' },
  },
  { _id: false }
);

const bankDetailsSchema = new Schema<IBankDetails>(
  {
    bankName: { type: String, default: 'HDFC Bank', trim: true },
    accountNumber: { type: String, default: '', trim: true },
    ifsc: { type: String, default: '', trim: true },
    branch: { type: String, default: 'Mumbai', trim: true },
    accountHolderName: { type: String, default: 'Media Octus Pvt Ltd', trim: true },
  },
  { _id: false }
);

const invoiceSchema = new Schema<IInvoice>(
  {
    type: {
      type: String,
      enum: INVOICE_TYPES,
      default: 'sales_invoice',
      index: true,
    },
    invoicePrefix: {
      type: String,
      default: 'INV',
      trim: true,
    },
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    partyId: {
      type: Schema.Types.ObjectId,
      ref: 'Lead',
      default: null,
      index: true,
    },
    partyName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    billingAddress: {
      type: String,
      default: '',
      trim: true,
    },
    shippingAddress: {
      type: String,
      default: '',
      trim: true,
    },
    gstin: {
      type: String,
      default: '',
      trim: true,
    },
    placeOfSupply: {
      type: String,
      default: 'Maharashtra (27)',
      trim: true,
    },
    contactPerson: {
      type: String,
      default: '',
      trim: true,
    },
    contactMobile: {
      type: String,
      default: '',
      trim: true,
    },
    contactEmail: {
      type: String,
      default: '',
      trim: true,
    },
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'Campaign',
      default: null,
      index: true,
    },
    invoiceDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    dueDate: {
      type: Date,
      required: true,
      index: true,
    },
    items: {
      type: [invoiceItemSchema],
      default: [],
      validate: [(v: IInvoiceItem[]) => v.length > 0, 'At least one item is required'],
    },
    subtotal: {
      type: Number,
      required: true,
      default: 0,
    },
    discount: {
      type: Number,
      default: 0,
    },
    additionalCharges: {
      type: Number,
      default: 0,
    },
    taxableAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    taxAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    tcs: {
      type: Number,
      default: 0,
    },
    roundOff: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    amountReceived: {
      type: Number,
      default: 0,
    },
    balanceAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    status: {
      type: String,
      enum: INVOICE_STATUSES,
      default: 'Draft',
      index: true,
    },
    bankDetails: {
      type: bankDetailsSchema,
      default: () => ({}),
    },
    termsAndConditions: {
      type: String,
      default: '1. Payment due within specified due date.\n2. Goods/Services once sold will not be returned.\n3. All disputes subject to Mumbai jurisdiction.',
      trim: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    shareToken: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      index: true,
    },
    editHistory: {
      type: [invoiceEditLogSchema],
      default: [],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

invoiceSchema.plugin(basePlugin);

invoiceSchema.index({ type: 1, isDeleted: 1, createdAt: -1 });
invoiceSchema.index({ partyId: 1, isDeleted: 1 });
invoiceSchema.index({ status: 1, isDeleted: 1 });

export const Invoice =
  (mongoose.models.Invoice as mongoose.Model<IInvoice>) ??
  mongoose.model<IInvoice>('Invoice', invoiceSchema);
