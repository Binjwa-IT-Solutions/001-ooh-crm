import mongoose, { Schema } from "mongoose";
import { basePlugin, type BaseDocument } from "../../core/db/basePlugin.js";

export type PurchaseOrderStatus =
  | "Draft"
  | "Issued"
  | "Accepted"
  | "Cancelled";

export interface IPurchaseOrderLineItem {
  siteId?: mongoose.Types.ObjectId;
  city?: string;
  spaceType?: string;
  from?: Date;
  to?: Date;
  ratePerDay?: number;
  days?: number;
  amount?: number;
  item?: string;
  service?: string;
  description?: string;
  hsn?: string;
  qty?: number;
  unit?: string;
  rate?: number;
  discount?: number;
  tax?: number;
}

export interface IBankDetails {
  bankName?: string;
  personName?: string;
  accountNumber?: string;
  ifsc?: string;
  branch?: string;
}

export interface IPurchaseOrder extends BaseDocument {
  poNumber: string;
  pricingId?: string;
  campaignId?: mongoose.Types.ObjectId | null;
  campaignName?: string;
  vendorId?: mongoose.Types.ObjectId;
  vendorName?: string;

  city?: string;
  spaceType?: string;
  cardRate?: number;
  negotiatedRate?: number;
  durationDays?: number;
  validityFrom?: Date;
  validityTo?: Date;

  poDate?: Date;
  placeOfSupply?: string;
  vendorAddress?: string;
  vendorGstin?: string;
  subtotal?: number;
  gstRate?: number;
  gstAmount?: number;
  companyName?: string;
  companyAddress?: string;
  companyGstin?: string;
  companyEmail?: string;
  companyPhone?: string;

  notes?: string;
  termsAndConditions?: string[];
  bankDetails?: IBankDetails | null;

  paymentTerms?: string;
  dueDate?: Date;
  paymentMethod?: string;
  gstApplicable?: boolean;
  accountsStatus?: string;
  accountsComments?: string;

  lineItems: IPurchaseOrderLineItem[];
  totalAmount: number;

  status: PurchaseOrderStatus;
  issuedAt?: Date;

  signatureUrl?: string;
  documentUrl?: string;
  pdfKey?: string;

  invoiceNumber?: string;
  invoiceDate?: Date;
  paymentStatus?: "Pending" | "Partial" | "Paid";
  paidAmount?: number;
  paymentDate?: Date;
}

const lineItemSchema = new Schema<IPurchaseOrderLineItem>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site" },
    city: String,
    spaceType: String,
    from: Date,
    to: Date,
    ratePerDay: { type: Number, default: 0 },
    days: { type: Number, default: 1 },
    amount: { type: Number, default: 0 },
    item: String,
    service: String,
    description: String,
    hsn: String,
    qty: { type: Number, default: 1 },
    unit: { type: String, default: "PCS" },
    rate: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 18 },
  },
  { _id: false },
);

const purchaseOrderSchema = new Schema<IPurchaseOrder>(
  {
    poNumber: { type: String, required: true, unique: true, index: true },
    pricingId: String,

    campaignId: {
      type: Schema.Types.ObjectId,
      ref: "Campaign",
      default: null,
    },
    campaignName: String,

    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      required: false,
      index: true,
    },
    vendorName: String,

    city: String,
    spaceType: { type: String, default: "Billboard" },

    cardRate: { type: Number, default: 0 },
    negotiatedRate: { type: Number, default: 0 },

    durationDays: { type: Number, default: 30 },
    validityFrom: Date,
    validityTo: Date,

    poDate: { type: Date, default: Date.now },
    placeOfSupply: { type: String, default: "Madhya Pradesh" },
    vendorAddress: String,
    vendorGstin: String,
    subtotal: { type: Number, default: 0 },
    gstRate: { type: Number, default: 18 },
    gstAmount: { type: Number, default: 0 },
    companyName: String,
    companyAddress: String,
    companyGstin: String,
    companyEmail: String,
    companyPhone: String,
    notes: String,
    termsAndConditions: { type: [String], default: [] },
    bankDetails: {
      bankName: String,
      personName: String,
      accountNumber: String,
      ifsc: String,
      branch: String,
    },

    paymentTerms: { type: String, default: "Net 30" },
    dueDate: Date,
    paymentMethod: { type: String, default: "Bank Transfer" },
    gstApplicable: { type: Boolean, default: true },
    accountsStatus: { type: String, default: "Pending Approval" },
    accountsComments: String,

    lineItems: { type: [lineItemSchema], default: [] },
    totalAmount: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["Draft", "Issued", "Accepted", "Cancelled"],
      default: "Draft",
      index: true,
    },

    issuedAt: Date,

    signatureUrl: String,
    documentUrl: String,
    pdfKey: String,

    invoiceNumber: String,
    invoiceDate: Date,

    paymentStatus: {
      type: String,
      enum: ["Pending", "Partial", "Paid"],
      default: "Pending",
    },

    paidAmount: { type: Number, default: 0 },
    paymentDate: Date,
  },
  { timestamps: true },
);

purchaseOrderSchema.plugin(basePlugin);

export const PurchaseOrder = mongoose.model<IPurchaseOrder>(
  "PurchaseOrder",
  purchaseOrderSchema,
);