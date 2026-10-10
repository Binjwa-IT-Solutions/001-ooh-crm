import mongoose, { Schema, Types } from 'mongoose';
import { basePlugin, type BaseDocument } from '../../../core/db/basePlugin.js';

export const PAYMENT_OUT_METHODS = [
  'bank_transfer',
  'cheque',
  'cash',
  'upi',
] as const;

export const PAYMENT_OUT_CATEGORIES = [
  'media_cost',
  'production_cost',
  'logistics',
  'other',
] as const;

export type PaymentOutMethod = (typeof PAYMENT_OUT_METHODS)[number];
export type PaymentOutCategory = (typeof PAYMENT_OUT_CATEGORIES)[number];

export interface IPaymentOut extends BaseDocument {
  campaignId: Types.ObjectId;
  vendorId: Types.ObjectId;
  poId?: Types.ObjectId | null;
  /** Amount in integer paise (e.g. ₹30,000.00 = 3000000) */
  amount: number;
  paidAt: Date;
  method: PaymentOutMethod;
  category: PaymentOutCategory;
  transactionId?: string;
  vendorInvoice?: string;
  notes?: string;
  recordedBy: Types.ObjectId;
  recordedAt: Date;
  reconciled: boolean;
  reconciledAt?: Date | null;
  reconciledBy?: Types.ObjectId | null;
  attachments?: string[];
}

const paymentOutSchema = new Schema<IPaymentOut>(
  {
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'Campaign',
      required: true,
      index: true,
    },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
      index: true,
    },
    poId: {
      type: Schema.Types.ObjectId,
      ref: 'PurchaseOrder',
      default: null,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    paidAt: {
      type: Date,
      required: true,
      index: true,
    },
    method: {
      type: String,
      enum: PAYMENT_OUT_METHODS,
      required: true,
    },
    category: {
      type: String,
      enum: PAYMENT_OUT_CATEGORIES,
      required: true,
      index: true,
    },
    transactionId: {
      type: String,
      trim: true,
      default: '',
    },
    vendorInvoice: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    recordedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    reconciled: {
      type: Boolean,
      default: false,
      index: true,
    },
    reconciledAt: {
      type: Date,
      default: null,
    },
    reconciledBy: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
    attachments: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

paymentOutSchema.plugin(basePlugin);

paymentOutSchema.index({ campaignId: 1, paidAt: -1 });
paymentOutSchema.index({ vendorId: 1, paidAt: -1 });
paymentOutSchema.index({ category: 1, paidAt: -1 });

export const PaymentOut =
  (mongoose.models.PaymentOut as mongoose.Model<IPaymentOut>) ??
  mongoose.model<IPaymentOut>('PaymentOut', paymentOutSchema);
