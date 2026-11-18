import { Badge } from '@/shared/ui';
import { Attendance } from '../types';
import { formatHoursToHM } from '@/shared/utils/formatters';

export function TeamAttendanceTable({ records }: { records: Attendance[] | null }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm whitespace-nowrap">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-4 py-3 font-medium text-slate-600">Employee</th>
            <th className="px-4 py-3 font-medium text-slate-600">Date</th>
            <th className="px-4 py-3 font-medium text-slate-600">Shift</th>
            <th className="px-4 py-3 font-medium text-slate-600">Status</th>
            <th className="px-4 py-3 font-medium text-slate-600">Check In</th>
            <th className="px-4 py-3 font-medium text-slate-600">Check In Location</th>
            <th className="px-4 py-3 font-medium text-slate-600">Check Out</th>
            <th className="px-4 py-3 font-medium text-slate-600">Check Out Location</th>
            <th className="px-4 py-3 font-medium text-slate-600">Break</th>
            <th className="px-4 py-3 font-semibold text-slate-800">Working Hours</th>
            <th className="px-4 py-3 font-semibold text-emerald-700">Overtime</th>
            <th className="px-4 py-3 font-medium text-slate-600">Work Type</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {records?.map((record, index) => {
            const hasCheckedOut = !!record.checkOutTime;
            const breakMins = record.totalBreakMinutes ?? (record.breaks?.reduce((acc, b) => acc + (b.durationMinutes || 0), 0) ?? 0);
            const workHours = record.actualHours ?? record.totalHours;
            const ovt = record.overtimeHours ?? (workHours && workHours > 8 ? workHours - 8 : 0);

            const shiftLabel = record.shiftDetails?.name
              ? `${record.shiftDetails.name}`
              : 'General Shift';

            return (
              <tr key={record.id || record._id || index} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-medium text-slate-800">
                  {(record.employeeId as any)?.name || (record.employeeId as any)?.fullName || record.employeeId?.toString() || 'Unknown'}
                  {(record.employeeId as any)?.department && (
                    <div className="text-xs text-slate-400 font-normal">{(record.employeeId as any).department}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {new Date(record.date).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-slate-600 text-xs">
                  {shiftLabel}
                </td>
                <td className="px-4 py-3">
                  <div className="animate-in fade-in duration-300">
                    <Badge>
                      {record.status}
                    </Badge>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {record.checkInTime ? new Date(record.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                </td>
                <td className="px-4 py-3 text-slate-600 text-xs">
                  {record.checkInGps ? (
                    <a href={`https://maps.google.com/?q=${record.checkInGps.lat},${record.checkInGps.lng}`} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">
                      {record.checkInGps.lat.toFixed(4)}, {record.checkInGps.lng.toFixed(4)}
                    </a>
                  ) : 'Not Available'}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {hasCheckedOut ? (
                    new Date(record.checkOutTime!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                      In Progress
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600 text-xs">
                  {record.checkOutGps ? (
                    <a href={`https://maps.google.com/?q=${record.checkOutGps.lat},${record.checkOutGps.lng}`} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">
                      {record.checkOutGps.lat.toFixed(4)}, {record.checkOutGps.lng.toFixed(4)}
                    </a>
                  ) : 'Not Available'}
                </td>
                <td className="px-4 py-3 text-slate-600 text-xs">
                  {breakMins > 0 ? `${Math.round(breakMins)}m` : '0m'}
                </td>
                <td className="px-4 py-3 font-semibold text-brand-800">
                  {hasCheckedOut ? formatHoursToHM(workHours) : '--'}
                </td>
                <td className="px-4 py-3 text-xs">
                  {hasCheckedOut && ovt > 0 ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      +{formatHoursToHM(ovt)}
                    </span>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600 text-xs">
                  {record.workType}
                </td>
              </tr>
            );
          })}
          {(!records || records.length === 0) && (
            <tr>
              <td colSpan={12} className="px-4 py-8 text-center text-slate-500">
                No attendance records found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
