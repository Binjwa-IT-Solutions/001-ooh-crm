import { Schema, model, Types, Document } from 'mongoose';

export interface IExceptionAcknowledgement extends Document {
  exceptionKey: string;
  exceptionType: string;
  entityId: string;
  acknowledgedBy: Types.ObjectId;
  acknowledgedAt: Date;
  notes?: string;
}

const exceptionAcknowledgementSchema = new Schema<IExceptionAcknowledgement>(
  {
    exceptionKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    exceptionType: {
      type: String,
      required: true,
      index: true,
    },
    entityId: {
      type: String,
      required: true,
      index: true,
    },
    acknowledgedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    acknowledgedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
);

export const ExceptionAcknowledgement = model<IExceptionAcknowledgement>(
  'ExceptionAcknowledgement',
  exceptionAcknowledgementSchema,
);
