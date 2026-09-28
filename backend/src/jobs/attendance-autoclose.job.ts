import Attendance from '../modules/HR/models/attendance.model.js';
import ShiftConfig from '../modules/HR/models/shift-config.model.js';
import { Employee } from '../modules/employees/employees.model.js';

/**
 * ATTENDANCE AUTO-CLOSE JOB — G2
 *
 * Runs nightly (end-of-day at 23:55) to auto-close forgotten check-outs.
 * - Identifies records with a check-in but no check-out.
 * - Resolves the employee's department shift configuration.
 * - Sets checkOutTime based on shift end time and calculates totalHours.
 * - Flags the record as `autoClosed: true` and `flaggedForReview: true` for HR review.
 * - Safe to run idempotently.
 */
export async function attendanceAutoCloseJob(): Promise<{ closedCount: number }> {
  try {
    console.log('[job:attendance-autoclose] starting nightly forgotten check-outs run...');

    const now = new Date();
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    // Find all attendance records with check-in but no check-out on or before today
    const unclosedRecords = await Attendance.find({
      checkInTime: { $ne: null },
      checkOutTime: null,
      date: { $lte: endOfToday },
      deletedAt: null,
    });

    let closedCount = 0;

    for (const record of unclosedRecords) {
      const employee = await Employee.findById(record.employeeId);
      const shiftConfig = employee?.department
        ? await ShiftConfig.findOne({ department: employee.department })
        : null;

      const [endH, endM] = (shiftConfig?.endTime || '18:30').split(':').map(Number);
      const checkOutTime = new Date(record.date);
      checkOutTime.setHours(endH, endM, 0, 0);

      // If check-in happened after or at shift end, default to 8 hours after check-in
      const inTime = new Date(record.checkInTime!).getTime();
      let outTime = checkOutTime.getTime();
      if (outTime <= inTime) {
        outTime = inTime + 8 * 60 * 60 * 1000;
        checkOutTime.setTime(outTime);
      }

      const diffMs = Math.max(0, outTime - inTime);
      const totalHours = Number((diffMs / (1000 * 60 * 60)).toFixed(2));

      const threshold = shiftConfig?.halfDayThresholdHours ?? 4;
      let finalStatus = record.status;
      if (totalHours < threshold) {
        finalStatus = 'Half-Day';
      } else if (record.status !== 'Late') {
        finalStatus = 'Present';
      }

      record.checkOutTime = checkOutTime;
      record.totalHours = totalHours;
      record.status = finalStatus;
      record.autoClosed = true;
      record.flaggedForReview = true;
      record.reviewNotes = 'Auto-closed at end of day due to missing check-out (flagged for HR review)';
      record.updatedBy = record.employeeId;

      await record.save();
      closedCount++;
      console.log(`[job:attendance-autoclose] Auto-closed attendance record ${record._id} for ${employee?.fullName || record.employeeId}`);
    }

    console.log(`[job:attendance-autoclose] completed. Closed ${closedCount} forgotten check-out record(s).`);
    return { closedCount };
  } catch (error) {
    console.error('[job:attendance-autoclose] failed:', error);
    return { closedCount: 0 };
  }
}
