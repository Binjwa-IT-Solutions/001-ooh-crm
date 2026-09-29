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
  negotiatedRatePerDay?: number;
  days?: number;
  amount?: number;
}

export interface IPurchaseOrder extends BaseDocument {
  poNumber: string;
  pricingId?: string;
  campaignId?: mongoose.Types.ObjectId | null;
  vendorId: mongoose.Types.ObjectId;

  city?: string;
  spaceType?: string;
  cardRate?: number;
  negotiatedRate?: number;
  discountGiven?: number;
  discountPercent?: number;
  companyCostPrice?: number;
  companySellingPrice?: number;
  profitPerUnit?: number;
  profitMarginPercent?: number;
  durationDays?: number;
  validityFrom?: Date;
  validityTo?: Date;
  negotiationRounds?: number;
  negotiationNotes?: string;
  approvedBy?: string;

  lineItems: IPurchaseOrderLineItem[];
  totalAmount: number;
  status: PurchaseOrderStatus;
  issuedAt?: Date;
  pdfKey?: string;
}

const lineItemSchema = new Schema<IPurchaseOrderLineItem>(
  {
    siteId: {
      type: Schema.Types.ObjectId,
      ref: "Site",
      required: false,
    },

    city: {
      type: String,
      trim: true,
    },

    spaceType: {
      type: String,
      trim: true,
    },

    from: {
      type: Date,
    },

    to: {
      type: Date,
    },

    negotiatedRatePerDay: {
      type: Number,
      default: 0,
      min: 0,
    },

    days: {
      type: Number,
      default: 1,
      min: 1,
    },

    amount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    _id: false,
  },
);

const purchaseOrderSchema = new Schema<IPurchaseOrder>(
  {
    poNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    pricingId: {
      type: String,
      index: true,
      trim: true,
    },

    campaignId: {
      type: Schema.Types.ObjectId,
      ref: "Campaign",
      index: true,
      default: null,
    },

    vendorId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Vendor",
      index: true,
    },

    city: {
      type: String,
      trim: true,
      default: "",
    },

    spaceType: {
      type: String,
      trim: true,
      default: "Billboard",
    },

    cardRate: {
      type: Number,
      default: 0,
      min: 0,
    },

    negotiatedRate: {
      type: Number,
      default: 0,
      min: 0,
    },

    discountGiven: {
      type: Number,
      default: 0,
    },

    discountPercent: {
      type: Number,
      default: 0,
    },

    companyCostPrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    companySellingPrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    profitPerUnit: {
      type: Number,
      default: 0,
    },

    profitMarginPercent: {
      type: Number,
      default: 0,
    },

    durationDays: {
      type: Number,
      default: 30,
      min: 1,
    },

    validityFrom: {
      type: Date,
    },

    validityTo: {
      type: Date,
    },

    negotiationRounds: {
      type: Number,
      default: 1,
      min: 1,
    },

    negotiationNotes: {
      type: String,
      trim: true,
      default: "",
    },

    approvedBy: {
      type: String,
      trim: true,
      default: "",
    },

    lineItems: {
      type: [lineItemSchema],
      default: [],
    },

    totalAmount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    status: {
      type: String,
      enum: [
        "Draft",
        "Issued",
        "Accepted",
        "Cancelled",
      ],
      default: "Draft",
      index: true,
    },

    issuedAt: {
      type: Date,
    },

    pdfKey: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

purchaseOrderSchema.plugin(basePlugin);

export const PurchaseOrder = mongoose.model<IPurchaseOrder>(
  "PurchaseOrder",
  purchaseOrderSchema,
);