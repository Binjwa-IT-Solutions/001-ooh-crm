import { holidayService } from './holiday.service.js';
import { LeaveType } from '../leaveTypes/leaveTypes.model.js';
import ShiftConfig from '../models/shift-config.model.js';
import { DEPARTMENTS } from '../../employees/employees.model.js';

export async function initializeHRDefaults(): Promise<void> {
  try {
    // 1. Seed predefined holidays
    await holidayService.seedPredefinedHolidays();

    // 2. Seed default leave types if they don't exist
    const defaultTypes = [
      { name: 'Casual Leave', code: 'CL', annualQuota: 12, carryForward: false, maxCarryForward: 0, encashable: false, requiresDocument: false, status: 'Active' as const },
      { name: 'Sick Leave', code: 'SL', annualQuota: 12, carryForward: false, maxCarryForward: 0, encashable: false, requiresDocument: false, status: 'Active' as const },
      { name: 'Privilege Leave', code: 'PL', annualQuota: 15, carryForward: true, maxCarryForward: 30, encashable: true, requiresDocument: false, status: 'Active' as const },
      { name: 'Maternity Leave', code: 'ML', annualQuota: 182, carryForward: false, maxCarryForward: 0, encashable: false, requiresDocument: false, status: 'Active' as const },
      { name: 'Paternity Leave', code: 'PTL', annualQuota: 15, carryForward: false, maxCarryForward: 0, encashable: false, requiresDocument: false, status: 'Active' as const },
      { name: 'Compensatory Off', code: 'COMP', annualQuota: 0, carryForward: false, maxCarryForward: 0, encashable: false, requiresDocument: false, status: 'Active' as const },
      { name: 'Leave Without Pay', code: 'LWP', annualQuota: null, carryForward: false, maxCarryForward: 0, encashable: false, requiresDocument: false, status: 'Active' as const },
    ];

    for (const type of defaultTypes) {
      const existing = await LeaveType.findOne({ code: type.code });
      if (!existing) {
        try {
          await LeaveType.create(type);
        } catch {
          // Ignore unique collision if another process inserted concurrently
        }
      }
    }

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
