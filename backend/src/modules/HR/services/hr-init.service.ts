import { holidayService } from './holiday.service.js';
import ShiftConfig from '../models/shift-config.model.js';
import { DEPARTMENTS } from '../../employees/employees.model.js';

export async function initializeHRDefaults(): Promise<void> {
  try {
    // 1. Seed predefined holidays
    await holidayService.seedPredefinedHolidays();

    // 2. Leave types are NOT seeded — HR/admin create them under Leave → Leave Types.

    // 3. Seed default Shift Configurations for all departments
    for (const department of DEPARTMENTS) {
      const existing = await ShiftConfig.findOne({ department });
      if (!existing) {
        try {
          await ShiftConfig.create({
            department,
            startTime: '09:30',
            endTime: '18:30',
            graceMinutes: 15,
            halfDayThresholdHours: 4,
          });
        } catch {
          // Ignore unique collision
        }
      }
    }
  } catch (err) {
    console.error('[hr-init] Error initializing default HR defaults:', err);
  }
}
