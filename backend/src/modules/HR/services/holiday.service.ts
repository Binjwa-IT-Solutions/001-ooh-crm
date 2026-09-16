import mongoose from 'mongoose';
import type { RequestContext } from '../../../core/context.js';
import { ConflictError, NotFoundError, ValidationError } from '../../../core/errors/index.js';
import Holiday from '../models/holiday.model.js';

function day(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function toIso(value: unknown): string {
  if (!value) return new Date().toISOString();
  const d = value instanceof Date ? value : new Date(value as string | number);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export const holidayService = {
  async list(_ctx: RequestContext) {
    const holidays = await Holiday.find({ deletedAt: null }).sort({ date: 1 });
    return holidays.map((h) => ({
      id: String(h._id),
      name: h.name,
      date: toIso(h.date),
      description: h.description ?? null,
      code: h.code ?? null,
      isPredefined: h.isPredefined ?? false,
      createdAt: toIso(h.createdAt),
      updatedAt: toIso(h.updatedAt),
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
      isPredefined: false,
      createdBy: new mongoose.Types.ObjectId(ctx.user.id),
      updatedBy: new mongoose.Types.ObjectId(ctx.user.id),
    });
    return {
      id: String(holiday._id),
      name: holiday.name,
      date: toIso(holiday.date),
      description: holiday.description ?? null,
      code: holiday.code ?? null,
      isPredefined: holiday.isPredefined ?? false,
      createdAt: toIso(holiday.createdAt),
      updatedAt: toIso(holiday.updatedAt),
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
      { returnDocument: 'after' }
    );
    if (!holiday) {
      throw new NotFoundError('Holiday not found');
    }
    return {
      id: String(holiday._id),
      name: holiday.name,
      date: toIso(holiday.date),
      description: holiday.description ?? null,
      code: holiday.code ?? null,
      isPredefined: holiday.isPredefined ?? false,
      createdAt: toIso(holiday.createdAt),
      updatedAt: toIso(holiday.updatedAt),
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
      { returnDocument: 'after' }
    );
    if (!holiday) {
      throw new NotFoundError('Holiday not found or already deleted');
    }
    return {
      id: String(holiday._id),
      name: holiday.name,
      date: toIso(holiday.date),
      description: holiday.description ?? null,
      code: holiday.code ?? null,
      isPredefined: holiday.isPredefined ?? false,
      createdAt: toIso(holiday.createdAt),
      updatedAt: toIso(holiday.updatedAt),
    };
  },

  async seedPredefinedHolidays(): Promise<void> {
    const predefinedList: Array<{ code: string; name: string; date: Date; description?: string }> = [
      // 2025
      { code: 'HOL_2025_NY', name: "New Year's Day", date: new Date(Date.UTC(2025, 0, 1)), description: "New Year's Day" },
      { code: 'HOL_2025_RD', name: 'Republic Day', date: new Date(Date.UTC(2025, 0, 26)), description: 'National Holiday' },
      { code: 'HOL_2025_MS', name: 'Maha Shivratri', date: new Date(Date.UTC(2025, 1, 26)), description: 'Maha Shivratri' },
      { code: 'HOL_2025_HL', name: 'Holi', date: new Date(Date.UTC(2025, 2, 14)), description: 'Festival of Colors' },
      { code: 'HOL_2025_EID', name: 'Eid ul-Fitr', date: new Date(Date.UTC(2025, 2, 31)), description: 'Eid ul-Fitr' },
      { code: 'HOL_2025_ID', name: 'Independence Day', date: new Date(Date.UTC(2025, 7, 15)), description: 'National Holiday' },
      { code: 'HOL_2025_GJ', name: 'Gandhi Jayanti', date: new Date(Date.UTC(2025, 9, 2)), description: 'Mahatma Gandhi Birthday' },
      { code: 'HOL_2025_DUS', name: 'Dussehra', date: new Date(Date.UTC(2025, 9, 2)), description: 'Vijayadashami' },
      { code: 'HOL_2025_DIW', name: 'Diwali', date: new Date(Date.UTC(2025, 9, 20)), description: 'Festival of Lights' },
      { code: 'HOL_2025_XMAS', name: 'Christmas Day', date: new Date(Date.UTC(2025, 11, 25)), description: 'Christmas' },

      // 2026
      { code: 'HOL_2026_NY', name: "New Year's Day", date: new Date(Date.UTC(2026, 0, 1)), description: "New Year's Day" },
      { code: 'HOL_2026_RD', name: 'Republic Day', date: new Date(Date.UTC(2026, 0, 26)), description: 'National Holiday' },
      { code: 'HOL_2026_MS', name: 'Maha Shivratri', date: new Date(Date.UTC(2026, 1, 15)), description: 'Maha Shivratri' },
      { code: 'HOL_2026_HL', name: 'Holi', date: new Date(Date.UTC(2026, 2, 4)), description: 'Festival of Colors' },
      { code: 'HOL_2026_EID', name: 'Eid ul-Fitr', date: new Date(Date.UTC(2026, 2, 20)), description: 'Eid ul-Fitr' },
      { code: 'HOL_2026_ID', name: 'Independence Day', date: new Date(Date.UTC(2026, 7, 15)), description: 'National Holiday' },
      { code: 'HOL_2026_GJ', name: 'Gandhi Jayanti', date: new Date(Date.UTC(2026, 9, 2)), description: 'Mahatma Gandhi Birthday' },
      { code: 'HOL_2026_DUS', name: 'Dussehra', date: new Date(Date.UTC(2026, 9, 20)), description: 'Vijayadashami' },
      { code: 'HOL_2026_DIW', name: 'Diwali', date: new Date(Date.UTC(2026, 10, 8)), description: 'Festival of Lights' },
      { code: 'HOL_2026_XMAS', name: 'Christmas Day', date: new Date(Date.UTC(2026, 11, 25)), description: 'Christmas' },

      // 2027
      { code: 'HOL_2027_NY', name: "New Year's Day", date: new Date(Date.UTC(2027, 0, 1)), description: "New Year's Day" },
      { code: 'HOL_2027_RD', name: 'Republic Day', date: new Date(Date.UTC(2027, 0, 26)), description: 'National Holiday' },
      { code: 'HOL_2027_MS', name: 'Maha Shivratri', date: new Date(Date.UTC(2027, 2, 6)), description: 'Maha Shivratri' },
      { code: 'HOL_2027_EID', name: 'Eid ul-Fitr', date: new Date(Date.UTC(2027, 2, 10)), description: 'Eid ul-Fitr' },
      { code: 'HOL_2027_HL', name: 'Holi', date: new Date(Date.UTC(2027, 2, 22)), description: 'Festival of Colors' },
      { code: 'HOL_2027_ID', name: 'Independence Day', date: new Date(Date.UTC(2027, 7, 15)), description: 'National Holiday' },
      { code: 'HOL_2027_GJ', name: 'Gandhi Jayanti', date: new Date(Date.UTC(2027, 9, 2)), description: 'Mahatma Gandhi Birthday' },
      { code: 'HOL_2027_DUS', name: 'Dussehra', date: new Date(Date.UTC(2027, 9, 9)), description: 'Vijayadashami' },
      { code: 'HOL_2027_DIW', name: 'Diwali', date: new Date(Date.UTC(2027, 9, 29)), description: 'Festival of Lights' },
      { code: 'HOL_2027_XMAS', name: 'Christmas Day', date: new Date(Date.UTC(2027, 11, 25)), description: 'Christmas' },
    ];

    for (const h of predefinedList) {
      const holidayDate = day(h.date);
      // Check if already seeded by code, or an active holiday on this date exists
      const existing = await Holiday.findOne({
        $or: [
          { code: h.code },
          { date: holidayDate, deletedAt: null },
        ],
      });

      if (!existing) {
        try {
          await Holiday.create({
            name: h.name,
            date: holidayDate,
            description: h.description,
            code: h.code,
            isPredefined: true,
          });
        } catch {
          // Ignore unique index collision if another process or thread inserted concurrently
        }
      }
    }
  },
};
