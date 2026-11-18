import mongoose, { Schema, Types } from 'mongoose';
import { basePlugin, type BaseDocument } from '../../core/db/basePlugin.js';

export const CANDIDATE_STATUSES = ['Scheduled', 'Interviewed', 'Selected', 'Rejected', 'On Hold'] as const;
export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number];

export interface InterviewRound {
  _id?: Types.ObjectId;
  roundNumber?: number;
  roundName?: string;
  interviewDate: Date;
  interviewedBy: Types.ObjectId;
  notes?: string | null;
  status?: string | null;
  createdAt?: Date;
}

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
  interviewRounds?: InterviewRound[];
}

const interviewRoundSchema = new Schema(
  {
    roundNumber: { type: Number, default: 1 },
    roundName: { type: String, default: 'Interview Round' },
    interviewDate: { type: Date, required: true },
    interviewedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    notes: { type: String, default: null },
    status: { type: String, default: 'Scheduled' },
  },
  { _id: true, timestamps: { createdAt: true, updatedAt: false } }
);

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
    interviewRounds: {
      type: [interviewRoundSchema],
      default: [],
    },
  },
  { collection: 'candidates' }
);

candidateSchema.plugin(basePlugin);

export const CandidateModel = mongoose.model<Candidate>('Candidate', candidateSchema);
