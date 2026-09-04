import mongoose from 'mongoose';
import type { RequestContext } from '../../../core/context.js';
import { ConflictError, NotFoundError, ValidationError } from '../../../core/errors/index.js';
import Holiday from '../models/holiday.model.js';

function day(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export const holidayService = {
  async list(_ctx: RequestContext) {
    const holidays = await Holiday.find({ deletedAt: null }).sort({ date: 1 });
    return holidays.map((h) => ({
      id: String(h._id),
      name: h.name,
      date: h.date.toISOString(),
      description: h.description ?? null,
      createdAt: h.createdAt.toISOString(),
      updatedAt: h.updatedAt.toISOString(),
    }));
  },

  async create(data: { name: string; date: Date; description?: string }, ctx: RequestContext) {
    const holidayDate = day(data.date);
    const existing = await Holiday.findOne({ date: holidayDate, deletedAt: null });
    if (existing) {
      throw new ConflictError('A holiday is already defined for this date');
    }
    const holiday = await Holiday.create({
      name: data.name,
      date: holidayDate,
      description: data.description,
      createdBy: new mongoose.Types.ObjectId(ctx.user.id),
      updatedBy: new mongoose.Types.ObjectId(ctx.user.id),
    });
    return {
      id: String(holiday._id),
      name: holiday.name,
      date: holiday.date.toISOString(),
      description: holiday.description ?? null,
      createdAt: holiday.createdAt.toISOString(),
      updatedAt: holiday.updatedAt.toISOString(),
    };
  },

  async update(id: string, data: { name: string; date: Date; description?: string }, ctx: RequestContext) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid holiday ID');
    }
    const holidayDate = day(data.date);
    const existing = await Holiday.findOne({ _id: { $ne: id }, date: holidayDate, deletedAt: null });
    if (existing) {
      throw new ConflictError('A holiday is already defined for this date');
    }
    const holiday = await Holiday.findOneAndUpdate(
      { _id: id, deletedAt: null },
      {
        $set: {
          name: data.name,
          date: holidayDate,
          description: data.description,
          updatedBy: new mongoose.Types.ObjectId(ctx.user.id),
        },
      },
      { new: true }
    );
    if (!holiday) {
      throw new NotFoundError('Holiday not found');
    }
    return {
      id: String(holiday._id),
      name: holiday.name,
      date: holiday.date.toISOString(),
      description: holiday.description ?? null,
      createdAt: holiday.createdAt.toISOString(),
      updatedAt: holiday.updatedAt.toISOString(),
    };
  },

  async delete(id: string, ctx: RequestContext) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid holiday ID');
    }
    const holiday = await Holiday.findOneAndUpdate(
      { _id: id, deletedAt: null },
      {
        $set: {
          deletedAt: new Date(),
          updatedBy: new mongoose.Types.ObjectId(ctx.user.id),
        },
      },
      { new: true }
    );
    if (!holiday) {
      throw new NotFoundError('Holiday not found or already deleted');
    }
    return {
      id: String(holiday._id),
      name: holiday.name,
      date: holiday.date.toISOString(),
      description: holiday.description ?? null,
      createdAt: holiday.createdAt.toISOString(),
      updatedAt: holiday.updatedAt.toISOString(),
    };
  },
};
