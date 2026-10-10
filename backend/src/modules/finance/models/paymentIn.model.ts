import mongoose, { Schema, Types } from 'mongoose';
import { basePlugin, type BaseDocument } from '../../../core/db/basePlugin.js';

export const PAYMENT_IN_METHODS = [
  'bank_transfer',
  'cheque',
  'cash',
  'upi',
  'credit_card',
] as const;

export type PaymentInMethod = (typeof PAYMENT_IN_METHODS)[number];

export interface IPaymentIn extends BaseDocument {
  campaignId: Types.ObjectId;
  clientId?: Types.ObjectId | null;
  invoiceId?: Types.ObjectId | null;
  /** Amount in integer paise (e.g. ₹50,000.00 = 5000000) */
  amount: number;
  receivedAt: Date;
  method: PaymentInMethod;
  transactionId?: string;
  notes?: string;
  recordedBy: Types.ObjectId;
  recordedAt: Date;
  reconciled: boolean;
  reconciledAt?: Date | null;
  reconciledBy?: Types.ObjectId | null;
  attachments?: string[];
}

const paymentInSchema = new Schema<IPaymentIn>(
  {
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'Campaign',
      required: true,
      index: true,
    },
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Lead',
      default: null,
    },
    invoiceId: {
      type: Schema.Types.ObjectId,
      ref: 'Invoice',
      default: null,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    receivedAt: {
      type: Date,
      required: true,
      index: true,
    },
    method: {
      type: String,
      enum: PAYMENT_IN_METHODS,
      required: true,
    },
    transactionId: {
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

paymentInSchema.plugin(basePlugin);

paymentInSchema.index({ campaignId: 1, recordedAt: -1 });
paymentInSchema.index({ campaignId: 1, receivedAt: -1 });

export const PaymentIn =
  (mongoose.models.PaymentIn as mongoose.Model<IPaymentIn>) ??
  mongoose.model<IPaymentIn>('PaymentIn', paymentInSchema);
