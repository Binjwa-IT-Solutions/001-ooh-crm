import mongoose, { Schema, Types } from 'mongoose';
import { basePlugin, type BaseDocument } from '../../../core/db/basePlugin.js';

export interface IProfitLog extends BaseDocument {
  campaignId: Types.ObjectId;
  logDate: Date;
  revenue: number;
  expenses: number;
  profit: number;
  margin: number;
  timestamp: Date;
  notes?: string;
}

const profitLogSchema = new Schema<IProfitLog>(
  {
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'Campaign',
      required: true,
      index: true,
    },
    logDate: {
      type: Date,
      required: true,
      index: true,
    },
    revenue: {
      type: Number,
      required: true,
      default: 0,
    },
    expenses: {
      type: Number,
      required: true,
      default: 0,
    },
    profit: {
      type: Number,
      required: true,
      default: 0,
    },
    margin: {
      type: Number,
      required: true,
      default: 0,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true }
);

profitLogSchema.plugin(basePlugin);

profitLogSchema.index({ campaignId: 1, logDate: -1 });
profitLogSchema.index({ logDate: -1 });

export const ProfitLog =
  (mongoose.models.ProfitLog as mongoose.Model<IProfitLog>) ??
  mongoose.model<IProfitLog>('ProfitLog', profitLogSchema);
