import { useState, useMemo } from 'react';
import { Card, Badge } from '@/shared/ui';
import { Attendance } from '../types';

export function AttendanceCalendar({ records }: { records: Attendance[] | null }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const recordMap = useMemo(() => {
    const map = new Map<number, Attendance>();
    if (!records) return map;
    
    for (const record of records) {
      const d = new Date(record.date);
      if (d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear()) {
        map.set(d.getDate(), record);
      }
    }
    return map;
  }, [records, currentDate]);

  const renderDays = () => {
    const days = [];
    // Empty cells for the first row
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`empty-${i}`} className="p-2 border border-slate-100 bg-slate-50 opacity-50" />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const record = recordMap.get(day);
      let bgColor = 'bg-white';
      let borderTone = 'border-slate-100';
      
      if (record) {
        switch (record.status) {
          case 'Present': bgColor = 'bg-emerald-50'; borderTone = 'border-emerald-200'; break;
          case 'Late': bgColor = 'bg-amber-50'; borderTone = 'border-amber-200'; break;
          case 'Half-Day': bgColor = 'bg-blue-50'; borderTone = 'border-blue-200'; break;
          case 'Absent': bgColor = 'bg-red-50'; borderTone = 'border-red-200'; break;
        }
      }

      days.push(
        <div 
          key={day} 
          className={`h-24 p-2 border ${borderTone} ${bgColor} hover:scale-[1.03] transition-transform duration-200 ease-in-out z-10 hover:z-20 hover:shadow-sm relative cursor-default`}
        >
          <span className="text-sm font-medium text-slate-700">{day}</span>
          {record && (
            <div className="mt-1 animate-in fade-in duration-300">
              <Badge>{record.status}</Badge>
            </div>
          )}
        </div>
      );
    }
    return days;
  };

  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-slate-800">Attendance Calendar</h3>
        <div className="flex gap-2">
          <button 
            onClick={handlePrevMonth}
            className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
          >
            Prev
          </button>
          <span className="font-medium text-slate-800 min-w-[140px] text-center self-center">{monthName}</span>
          <button 
            onClick={handleNextMonth}
            className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
          >
            Next
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center text-sm font-medium text-slate-500 mb-2">
        <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
      </div>
      <div className="grid grid-cols-7">
        {renderDays()}
      </div>
    </Card>
  );
}
