/**
 * Seeds realistic demo attendance for every active employee so the
 * Attendance pages (metrics, late arrivals, reports) have something to show.
 *
 *   npm run seed:attendance               last 30 days (incl. today)
 *   npm run seed:attendance -- --days 60  custom window
 *   npm run seed:attendance -- --reset    delete previously seeded demo rows first
 *
 * Run `npm run seed` first so employees exist.
 * Only touches rows tagged deviceInfo = "demo-seed"; real punches are never overwritten.
 */
import { config } from '../config/index.js';
import { connectDatabase, disconnectDatabase } from '../core/db/connect.js';
import { Employee } from '../modules/employees/employees.model.js';
import Attendance from '../modules/HR/models/attendance.model.js';
import ShiftConfig from '../modules/HR/models/shift-config.model.js';

const TAG = 'demo-seed';
const DEFAULT_SHIFT = { startTime: '09:30', endTime: '18:30', graceMinutes: 15 };
const OFFICE_GPS = { lat: 19.076, lng: 72.8777 };

// Small deterministic PRNG so re-runs produce the same picture
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function at(day: Date, hhmm: string, offsetMinutes = 0): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(day);
  d.setHours(h, m, 0, 0);
  return new Date(d.getTime() + offsetMinutes * 60000);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

async function main() {
  if (config.isProduction) throw new Error('Refusing to seed demo attendance with NODE_ENV=production');

  const daysArg = process.argv.indexOf('--days');
  const days = daysArg > -1 ? Math.max(1, Number(process.argv[daysArg + 1]) || 30) : 30;
  const reset = process.argv.includes('--reset');

  await connectDatabase();

  if (reset) {
    const { deletedCount } = await Attendance.deleteMany({ deviceInfo: TAG });
    console.log(`Removed ${deletedCount} previously seeded attendance rows`);
  }

  const employees = await Employee.find({ deletedAt: null });
  if (employees.length === 0) {
    console.log('No employees found — run `npm run seed` first.');
    await disconnectDatabase();
    return;
  }

  const shiftConfigs = await ShiftConfig.find({});
  const shiftByDept = new Map(shiftConfigs.map((s) => [s.department, s]));

  const today = startOfDay(new Date());
  const now = new Date();
  let created = 0;
  let skipped = 0;

  for (const emp of employees) {
    const dept = (emp as any).department as string | undefined;
    const cfg = (dept && shiftByDept.get(dept)) || DEFAULT_SHIFT;
    const shift = {
      name: dept ? `${dept} Shift` : 'General Shift',
      startTime: cfg.startTime,
      endTime: cfg.endTime,
      requiredHours: 8,
    };
    // Each person gets a "personality": some are habitually late, some never
    const personRand = mulberry32(hashString(String(emp._id)));
    const lateTendency = personRand() < 0.25 ? 0.35 : 0.08;

    for (let i = days - 1; i >= 0; i--) {
      const day = new Date(today);
      day.setDate(day.getDate() - i);
      if (day.getDay() === 0) continue; // Sunday off

      const rand = mulberry32(hashString(`${emp._id}-${day.toDateString()}`));
      const roll = rand();
      const isToday = i === 0;

      let status: 'Present' | 'Late' | 'Absent' | 'Leave' | 'Half-Day';
      if (roll < 0.04) status = 'Leave';
      else if (roll < 0.08) status = 'Absent';
      else if (roll < 0.12) status = 'Half-Day';
      else if (rand() < lateTendency) status = 'Late';
      else status = 'Present';

      const doc: Record<string, unknown> = {
        employeeId: emp._id,
        date: day,
        shiftDetails: shift,
        workType: rand() < 0.1 ? 'Remote' : 'Office',
        status,
        deviceInfo: TAG,
        createdBy: emp._id,
      };

      if (status === 'Present' || status === 'Late' || status === 'Half-Day') {
        const offset =
          status === 'Late'
            ? cfg.graceMinutes + 1 + Math.floor(rand() * 60) // 16–75 min late
            : -20 + Math.floor(rand() * (cfg.graceMinutes + 20)); // up to 20 min early, within grace
        const checkIn = at(day, shift.startTime, offset);

        // Today: people whose check-in time hasn't happened yet just haven't arrived
        if (isToday && checkIn > now) {
          skipped++;
          continue;
        }

        const breakMin = 30 + Math.floor(rand() * 31);
        const grossHours = status === 'Half-Day' ? 4 + rand() * 0.8 : 8.6 + rand() * 1.6;
        const checkOut = new Date(checkIn.getTime() + grossHours * 3600000);

        doc.checkInTime = checkIn;
        doc.checkInGps = OFFICE_GPS;

        if (!(isToday && checkOut > now)) {
          const actual = grossHours - breakMin / 60;
          doc.checkOutTime = checkOut;
          doc.checkOutGps = OFFICE_GPS;
          doc.totalHours = round2(grossHours);
          doc.actualHours = round2(actual);
          doc.overtimeHours = round2(Math.max(actual - 8, 0));
          doc.totalBreakMinutes = breakMin;
          doc.breaks = [
            {
              type: 'Lunch',
              startTime: at(day, '13:30'),
              endTime: at(day, '13:30', breakMin),
              durationMinutes: breakMin,
            },
          ];
        }
      } else if (isToday) {
        // Don't mark anyone absent/on-leave for today in advance except leave
        if (status === 'Absent') {
          skipped++;
          continue;
        }
      }

      // Insert only if this employee has no record for that day (never overwrite real punches)
      const res = await Attendance.updateOne(
        { employeeId: emp._id, date: day },
        { $setOnInsert: doc },
        { upsert: true }
      );
      if (res.upsertedCount) created++;
      else skipped++;
    }
  }

  console.log(`Seeded ${created} attendance rows for ${employees.length} employees over ${days} days (${skipped} skipped).`);
  await disconnectDatabase();
}

main().catch((err) => {
  console.error('[seed-attendance] failed:', err);
  process.exit(1);
});
