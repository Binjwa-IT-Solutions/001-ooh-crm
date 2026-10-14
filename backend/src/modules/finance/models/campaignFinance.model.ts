import mongoose, { Schema, Types } from 'mongoose';
import { basePlugin, type BaseDocument } from '../../../core/db/basePlugin.js';

export const PAYMENT_STATUSES = ['pending', 'partial', 'complete'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export interface ICampaignFinance extends BaseDocument {
  campaignId: Types.ObjectId;

  // REVENUE (sum of all PaymentIn where deletedAt = null)
  revenue: number;
  paymentInCount: number;
  lastPaymentInAt?: Date | null;

  // EXPENSES (sum of all PaymentOut where deletedAt = null)
  expenses: number;
  expenses_media: number;
  expenses_production: number;
  expenses_logistics: number;
  expenses_other: number;
  paymentOutCount: number;
  lastPaymentOutAt?: Date | null;

  // CALCULATED PROFIT & MARGIN
  profit: number;
  /** Margin percentage, e.g. 38.5 for 38.5% */
  margin: number;

  // CONTRACT INFO (from Campaign)
  contractedValue: number;
  actualCost: number;
  budgetVariance: number;

  // STATUS
  paymentStatus: PaymentStatus;
  percentageReceived: number;

  // TIMESTAMPS & DATES
  calculatedAt: Date;
  campaignStartDate?: Date | null;
  campaignEndDate?: Date | null;
}

const campaignFinanceSchema = new Schema<ICampaignFinance>(
  {
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'Campaign',
      required: true,
      unique: true,
      index: true,
    },
    revenue: {
      type: Number,
      default: 0,
    },
    paymentInCount: {
      type: Number,
      default: 0,
    },
    lastPaymentInAt: {
      type: Date,
      default: null,
    },
    expenses: {
      type: Number,
      default: 0,
    },
    expenses_media: {
      type: Number,
      default: 0,
    },
    expenses_production: {
      type: Number,
      default: 0,
    },
    expenses_logistics: {
      type: Number,
      default: 0,
    },
    expenses_other: {
      type: Number,
      default: 0,
    },
    paymentOutCount: {
      type: Number,
      default: 0,
    },
    lastPaymentOutAt: {
      type: Date,
      default: null,
    },
    profit: {
      type: Number,
      default: 0,
      index: true,
    },
    margin: {
      type: Number,
      default: 0,
      index: true,
    },
    contractedValue: {
      type: Number,
      default: 0,
    },
    actualCost: {
      type: Number,
      default: 0,
    },
    budgetVariance: {
      type: Number,
      default: 0,
    },
    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: 'pending',
      index: true,
    },
    percentageReceived: {
      type: Number,
      default: 0,
    },
    calculatedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    campaignStartDate: {
      type: Date,
      default: null,
    },
    campaignEndDate: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

campaignFinanceSchema.plugin(basePlugin);

campaignFinanceSchema.index({ profit: -1 });
campaignFinanceSchema.index({ margin: -1 });
campaignFinanceSchema.index({ calculatedAt: -1 });

export const CampaignFinance =
  (mongoose.models.CampaignFinance as mongoose.Model<ICampaignFinance>) ??
  mongoose.model<ICampaignFinance>('CampaignFinance', campaignFinanceSchema);
