import { Schema, model, type Types } from 'mongoose';
import { basePlugin, type BaseDocument } from '../../core/db/basePlugin.js';

export interface ITeam extends BaseDocument {
  name: string;
  managerId: Types.ObjectId;
  description?: string;
  members: Types.ObjectId[];
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
}

const teamSchema = new Schema<ITeam>(
  {
    name: { type: String, required: true, trim: true },
    managerId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    description: { type: String, trim: true, default: '' },
    members: [{ type: Schema.Types.ObjectId, ref: 'Employee' }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

teamSchema.plugin(basePlugin);
teamSchema.index({ managerId: 1, name: 1, deletedAt: 1 });

export const Team = model<ITeam>('Team', teamSchema);
