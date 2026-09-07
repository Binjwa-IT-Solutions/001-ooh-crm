import mongoose, { Schema, Types } from 'mongoose';
import { basePlugin, type BaseDocument } from '../../core/db/basePlugin.js';

export const CANDIDATE_STATUSES = ['Scheduled', 'Interviewed', 'Selected', 'Rejected', 'On Hold'] as const;
export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number];

export interface Candidate extends BaseDocument {
  name: string;
  email: string;
  mobile: string;
  position: string;
  interviewDate: Date;
  interviewedBy: Types.ObjectId;
  status: CandidateStatus;
  resumeFileKey?: string | null;
  notes?: string | null;
}

const candidateSchema = new Schema<Candidate>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    mobile: { type: String, required: true },
    position: { type: String, required: true },
    interviewDate: { type: Date, required: true },
    interviewedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: CANDIDATE_STATUSES,
      default: 'Scheduled',
      required: true,
    },
    resumeFileKey: { type: String, default: null },
    notes: { type: String, default: null },
  },
  { collection: 'candidates' }
);

candidateSchema.plugin(basePlugin);

export const CandidateModel = mongoose.model<Candidate>('Candidate', candidateSchema);
