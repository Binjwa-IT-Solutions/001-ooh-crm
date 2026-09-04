import { Badge } from '@/shared/ui';
import { Attendance } from '../types';
import { formatHoursToHM } from '@/shared/utils/formatters';

export function TeamAttendanceTable({ records }: { records: Attendance[] | null }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-4 py-3 font-medium text-slate-600">Employee</th>
            <th className="px-4 py-3 font-medium text-slate-600">Date</th>
            <th className="px-4 py-3 font-medium text-slate-600">Status</th>
            <th className="px-4 py-3 font-medium text-slate-600">Check In</th>
            <th className="px-4 py-3 font-medium text-slate-600">Check In Location</th>
            <th className="px-4 py-3 font-medium text-slate-600">Check Out</th>
            <th className="px-4 py-3 font-medium text-slate-600">Check Out Location</th>
            <th className="px-4 py-3 font-medium text-slate-600">Hours</th>
            <th className="px-4 py-3 font-medium text-slate-600">Work Type</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {records?.map((record, index) => (
            <tr key={record.id || record._id || index} className="hover:bg-slate-50 transition-colors">
              <td className="px-4 py-3 font-medium text-slate-800">
                {/* Fallback until populated */}
                {(record.employeeId as any)?.name || (record.employeeId as any)?.fullName || record.employeeId?.toString() || 'Unknown'}
              </td>
              <td className="px-4 py-3 text-slate-600">
                {new Date(record.date).toLocaleDateString()}
              </td>
              <td className="px-4 py-3">
                <div className="animate-in fade-in duration-300">
                  <Badge>
                    {record.status}
                  </Badge>
                </div>
              </td>
              <td className="px-4 py-3 text-slate-600">
                {record.checkInTime ? new Date(record.checkInTime).toLocaleTimeString() : '--:--'}
              </td>
              <td className="px-4 py-3 text-slate-600 text-xs">
                {record.checkInGps ? (
                  <a href={`https://maps.google.com/?q=${record.checkInGps.lat},${record.checkInGps.lng}`} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">
                    {record.checkInGps.lat.toFixed(4)}, {record.checkInGps.lng.toFixed(4)}
                  </a>
                ) : 'Not Available'}
              </td>
              <td className="px-4 py-3 text-slate-600">
                {record.checkOutTime ? new Date(record.checkOutTime).toLocaleTimeString() : '--:--'}
              </td>
              <td className="px-4 py-3 text-slate-600 text-xs">
                {record.checkOutGps ? (
                  <a href={`https://maps.google.com/?q=${record.checkOutGps.lat},${record.checkOutGps.lng}`} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">
                    {record.checkOutGps.lat.toFixed(4)}, {record.checkOutGps.lng.toFixed(4)}
                  </a>
                ) : 'Not Available'}
              </td>
              <td className="px-4 py-3 font-medium text-slate-800">
                {formatHoursToHM(record.totalHours)}
              </td>
              <td className="px-4 py-3 text-slate-600">
                {record.workType}
              </td>
            </tr>
          ))}
          {(!records || records.length === 0) && (
            <tr>
              <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                No attendance records found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
