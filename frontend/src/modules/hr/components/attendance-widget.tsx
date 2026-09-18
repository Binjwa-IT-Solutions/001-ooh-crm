import { useState, useEffect } from 'react';
import { Card, Button, Badge, Spinner, Alert, SelectField } from '@/shared/ui';
import { useMyAttendance } from '../hooks/use-attendance';
import { attendanceApi } from '../api';
import { WorkType } from '../types';
import { formatHoursToHM } from '@/shared/utils/formatters';

export type BreakType = 'Lunch' | 'Tea' | 'Other';

interface ActiveBreak {
  type: BreakType;
  startTime: number;
}

interface CompletedBreak {
  type: BreakType;
  startTime: number;
  endTime: number;
  durationMinutes: number;
}

function formatElapsed(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hrs > 0) {
    return `${hrs}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function AttendanceWidget() {
  const { data: attendance, isLoading, mutate } = useMyAttendance();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workType, setWorkType] = useState<WorkType>('Office');

  // Break Feature State
  const [selectedBreakType, setSelectedBreakType] = useState<BreakType>('Lunch');
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [checkoutNote, setCheckoutNote] = useState<string | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];
  const storageKey = `attendance_breaks_${todayStr}`;

  const [activeBreak, setActiveBreak] = useState<ActiveBreak | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved).activeBreak || null : null;
    } catch {
      return null;
    }
  });

  const [pastBreaks, setPastBreaks] = useState<CompletedBreak[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved).pastBreaks || [] : [];
    } catch {
      return [];
    }
  });

  // Sync to localStorage
  const saveBreaks = (active: ActiveBreak | null, past: CompletedBreak[]) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ activeBreak: active, pastBreaks: past }));
    } catch (e) {
      console.warn('Failed to save breaks in localStorage', e);
    }
  };

  const now = new Date();
  const todayRecord = attendance?.find((r) => {
    const d = new Date(r.date);
    return d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
  });

  const isCheckedIn = !!todayRecord?.checkInTime;
  const isCheckedOut = !!todayRecord?.checkOutTime;

  // Live timer tick for active break and total hours
  useEffect(() => {
    if (!activeBreak && !isCheckedIn) return;
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [activeBreak, isCheckedIn]);

  // Start a new break
  const handleStartBreak = () => {
    if (!isCheckedIn || isCheckedOut) return;
    const newBreak: ActiveBreak = {
      type: selectedBreakType,
      startTime: Date.now(),
    };
    setActiveBreak(newBreak);
    setCheckoutNote(null);
    saveBreaks(newBreak, pastBreaks);
  };

  // End the currently active break
  const handleEndBreak = () => {
    if (!activeBreak) return;
    const endTime = Date.now();
    const durationMinutes = (endTime - activeBreak.startTime) / (1000 * 60);
    const completed: CompletedBreak = {
      type: activeBreak.type,
      startTime: activeBreak.startTime,
      endTime,
      durationMinutes,
    };
    const updatedPast = [...pastBreaks, completed];
    setPastBreaks(updatedPast);
    setActiveBreak(null);
    saveBreaks(null, updatedPast);
  };

  const handleAction = async (action: 'check-in' | 'check-out') => {
    setLoading(true);
    setError(null);
    try {
      let finalBreaks = [...pastBreaks];
      // Auto-end active break upon checkout
      if (action === 'check-out' && activeBreak) {
        const endTime = Date.now();
        const durationMinutes = (endTime - activeBreak.startTime) / (1000 * 60);
        const completed: CompletedBreak = {
          type: activeBreak.type,
          startTime: activeBreak.startTime,
          endTime,
          durationMinutes,
        };
        finalBreaks = [...pastBreaks, completed];
        setPastBreaks(finalBreaks);
        setActiveBreak(null);
        saveBreaks(null, finalBreaks);
        setCheckoutNote('Break ended automatically on checkout.');
      }

      let gps: { lat: number; lng: number } | undefined;
      let gpsFlag = false;

      // Try to get GPS
      if ('geolocation' in navigator) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          gps = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
        } catch (err) {
          console.warn('GPS unavailable:', err);
          gpsFlag = true;
        }
      } else {
        gpsFlag = true;
      }

      if (action === 'check-in') {
        await attendanceApi.checkIn({ gps, workType, deviceInfo: navigator.userAgent });
      } else {
        await attendanceApi.checkOut({
          gps,
          breaks: finalBreaks.map(b => ({
            type: b.type,
            startTime: new Date(b.startTime),
            endTime: new Date(b.endTime),
            durationMinutes: Number(b.durationMinutes.toFixed(2)),
          })),
        });
      }

      await mutate();
      if (gpsFlag) {
        // Optional: show a toast or note about GPS failure, but do not block
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || `Failed to ${action}`);
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) return <Spinner />;

  // Gross hours worked today
  let grossHours = 0;
  if (todayRecord?.totalHours) {
    grossHours = todayRecord.totalHours;
  } else if (todayRecord?.checkInTime) {
    const inTime = new Date(todayRecord.checkInTime).getTime();
    const outTime = todayRecord.checkOutTime ? new Date(todayRecord.checkOutTime).getTime() : currentTime;
    grossHours = Math.max(0, (outTime - inTime) / (1000 * 60 * 60));
  }

  // Total break duration in hours
  const serverBreakHours = todayRecord?.totalBreakMinutes ? todayRecord.totalBreakMinutes / 60 : 0;
  const completedBreakHours = pastBreaks.reduce((acc, b) => acc + (b.durationMinutes / 60), 0);
  const activeBreakHours = activeBreak ? Math.max(0, (currentTime - activeBreak.startTime) / (1000 * 60 * 60)) : 0;
  const totalBreakHours = isCheckedOut && serverBreakHours > 0 ? serverBreakHours : (completedBreakHours + activeBreakHours);

  // Net actual working hours = gross - break
  const netWorkingHours = isCheckedOut && todayRecord?.actualHours !== undefined
    ? todayRecord.actualHours
    : Math.max(0, grossHours - totalBreakHours);

  // Required hours (standard 8 hours)
  const requiredHours = todayRecord?.shiftDetails?.requiredHours ?? 8;
  const overtimeHours = isCheckedOut && todayRecord?.overtimeHours !== undefined
    ? todayRecord.overtimeHours
    : Math.max(0, netWorkingHours - requiredHours);

  return (
    <Card className="p-6 space-y-4">
      <div className="flex justify-between  items-center">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Attendance</h3>
        </div>
        {todayRecord?.status && (
          <div className="animate-in fade-in duration-300">
            <Badge>
              {todayRecord.status}
            </Badge>
          </div>
        )}
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="p-3 bg-slate-50 rounded-lg">
          <p className="text-slate-500 mb-0.5 text-xs">Check In</p>
          <p className="font-medium text-slate-800">
            {todayRecord?.checkInTime ? new Date(todayRecord.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
          </p>
        </div>
        <div className="p-3 bg-slate-50 rounded-lg">
          <p className="text-slate-500 mb-0.5 text-xs">Check Out</p>
          <p className="font-medium text-slate-800">
            {todayRecord?.checkOutTime ? new Date(todayRecord.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (isCheckedIn ? 'In Progress' : '--:--')}
          </p>
        </div>
        <div className="p-3 bg-slate-50 rounded-lg">
          <p className="text-slate-500 mb-0.5 text-xs">Break Time</p>
          <p className="font-medium text-slate-800">
            {totalBreakHours > 0 ? formatHoursToHM(totalBreakHours) : '0h 00m'}
          </p>
        </div>
        <div className="p-3 bg-slate-50 rounded-lg">
          <p className="text-slate-500 mb-0.5 text-xs">Required Hours</p>
          <p className="font-medium text-slate-800">
            {requiredHours}h 00m
          </p>
        </div>
      </div>

      {/* Net Working Hours Box */}
      <div className="p-3.5 bg-brand-50/50 border border-brand-100 rounded-lg flex items-center justify-between">
        <div>
          <span className="text-xs font-medium text-slate-600">Actual Working Hours</span>
          <p className="font-bold text-brand-800 text-xl tracking-tight">
            {isCheckedIn || isCheckedOut ? formatHoursToHM(netWorkingHours) : '--:--'}
          </p>
        </div>
        {overtimeHours > 0 && (
          <div className="text-right">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              Overtime: +{formatHoursToHM(overtimeHours)}
            </span>
          </div>
        )}
      </div>

      {!isCheckedIn && (
        <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
          <SelectField
            label="Work Type"
            value={workType}
            onChange={(e) => setWorkType(e.target.value as WorkType)}
            options={[
              { label: 'Office', value: 'Office' },
              { label: 'Remote', value: 'Remote' },
              { label: 'Field Visit', value: 'Field Visit' },
            ]}
          />

          {/* Break section: placed between Work Type and Check In button (disabled before Check In) */}
          <div className="space-y-1.5 opacity-60">
            <label className="block text-sm font-medium text-slate-700">Break</label>
            <div className="flex gap-2">
              <select
                disabled
                className="h-11 flex-1 rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm text-slate-400 cursor-not-allowed"
              >
                <option>Lunch</option>
                <option>Tea</option>
                <option>Other</option>
              </select>
              <Button
                type="button"
                variant="secondary"
                disabled
                className="cursor-not-allowed text-xs px-3"
                title="Check in first to start a break"
              >
                Start Break
              </Button>
            </div>
            <p className="text-[11px] text-slate-400">Available after Check In</p>
          </div>

          <Button
            className="w-full transition-all duration-200 ease-in-out hover:scale-[1.02]"
            variant="primary"
            onClick={() => handleAction('check-in')}
            isLoading={loading}
          >
            Check In
          </Button>
        </div>
      )}

      {isCheckedIn && !isCheckedOut && (
        <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
          {checkoutNote && (
            <div className="p-2.5 text-xs bg-amber-50 text-amber-800 border border-amber-200 rounded-lg animate-in fade-in duration-200">
              {checkoutNote}
            </div>
          )}

          {/* Break Section: Active Session */}
          {activeBreak ? (
            <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-lg space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  On Break: {activeBreak.type}
                </span>
                <span className="text-xs font-mono font-bold text-amber-900">
                  {formatElapsed(currentTime - activeBreak.startTime)}
                </span>
              </div>
              <Button
                type="button"
                variant="secondary"
                fullWidth
                onClick={handleEndBreak}
                className="border-amber-400 bg-white text-amber-900 hover:bg-amber-100 hover:text-amber-950 transition-colors h-10 text-xs font-semibold"
              >
                End Break
              </Button>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Break</label>
              <div className="flex gap-2">
                <select
                  value={selectedBreakType}
                  onChange={(e) => setSelectedBreakType(e.target.value as BreakType)}
                  className="h-11 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-primary transition-colors"
                >
                  <option value="Lunch">Lunch Break</option>
                  <option value="Tea">Tea Break</option>
                  <option value="Other">Other Break</option>
                </select>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleStartBreak}
                  className="border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100 hover:border-amber-400 transition-colors text-xs font-medium px-4"
                >
                  Start Break
                </Button>
              </div>
            </div>
          )}

          {/* Past Breaks list for today */}
          {pastBreaks.length > 0 && (
            <div className="text-xs text-slate-500 space-y-1 pt-0.5">
              <p className="font-medium text-slate-600">Today&apos;s Breaks ({pastBreaks.length}):</p>
              <div className="flex flex-wrap gap-1.5">
                {pastBreaks.map((b, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px]"
                  >
                    {b.type}: {Math.round(b.durationMinutes)}m
                  </span>
                ))}
              </div>
            </div>
          )}

          <Button
            className="w-full transition-all duration-200 ease-in-out hover:scale-[1.02]"
            variant="secondary"
            onClick={() => handleAction('check-out')}
            isLoading={loading}
          >
            Check Out
          </Button>
        </div>
      )}

      {isCheckedOut && (
        <div className="space-y-3">
          {checkoutNote && (
            <div className="p-2.5 text-xs bg-amber-50 text-amber-800 border border-amber-200 rounded-lg animate-in fade-in duration-200">
              {checkoutNote}
            </div>
          )}
          {pastBreaks.length > 0 && (
            <div className="text-xs text-slate-500 space-y-1">
              <p className="font-medium text-slate-600">Today&apos;s Breaks ({pastBreaks.length}):</p>
              <div className="flex flex-wrap gap-1.5">
                {pastBreaks.map((b, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px]"
                  >
                    {b.type}: {Math.round(b.durationMinutes)}m
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="p-3 bg-green-50 text-green-700 rounded-lg text-center font-medium animate-in fade-in zoom-in-95 duration-300 text-sm">
            Attendance completed for today.
          </div>
        </div>
      )}
    </Card>
  );
}
