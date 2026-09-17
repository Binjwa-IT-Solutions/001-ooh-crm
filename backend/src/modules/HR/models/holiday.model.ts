import mongoose, { Schema } from 'mongoose';
import { basePlugin, type BaseDocument } from '../../../core/db/basePlugin.js';

export interface IHoliday extends BaseDocument {
  name: string;
  date: Date;
  description?: string;
  code?: string;
  isPredefined?: boolean;
}

const holidaySchema = new Schema<IHoliday>(
  {
    name: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    description: { type: String, trim: true },
    code: { type: String, trim: true },
    isPredefined: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Enable soft delete, createdBy, updatedBy via basePlugin
holidaySchema.plugin(basePlugin);

// Unique compound index: only one active holiday per date
holidaySchema.index({ date: 1, deletedAt: 1 }, { unique: true });

const Holiday = mongoose.models.Holiday as mongoose.Model<IHoliday> ?? mongoose.model<IHoliday>('Holiday', holidaySchema);
export default Holiday;
