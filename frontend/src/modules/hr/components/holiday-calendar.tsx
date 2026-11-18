/* eslint-disable react-hooks/set-state-in-effect, @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
'use client';

import { useState } from 'react';
import { Card, Badge, Spinner, Button, Alert, Field, TextAreaField, Dropdown } from '@/shared/ui';
import { useHolidays, useCalendarLeaves } from '@/modules/hr/hooks/use-leave';
import { holidayApi } from '@/modules/hr/api';
import { useAuth } from '@/shared/auth/auth-context';

/**
 * Company holiday calendar — shared by the Leave page tab and the top-level /calendar page.
 * Everyone sees holidays and Sundays; people on approved leave are shown to managers,
 * HR and admins (everyone else sees only their own). HR/admin can add, edit and remove holidays.
 */

/** "Approved by Priya Sharma (HR) · 18 Nov, 2:30 pm" — who decided a leave and when. */
export function DecisionNote({ req, className = '' }: { req: any; className?: string }) {
  if (req.status !== 'Approved' && req.status !== 'Rejected') return null;
  const when = req.decidedAt || req.approvedAt;
  if (!req.decidedByName && !when) return null;

  const verb = req.status === 'Approved' ? 'Approved' : 'Rejected';
  const tone = req.status === 'Approved' ? 'text-emerald-700' : 'text-rose-700';
  const at = when
    ? new Date(when).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
    : null;

  return (
    <p className={`text-[11px] leading-snug ${className}`}>
      <span className={`font-semibold ${tone}`}>{verb}</span>
      {req.decidedByName && (
        <>
          {' by '}
          <span className="font-semibold text-slate-700">{req.decidedByName}</span>
          {req.decidedByRole && <span className="text-slate-500"> ({req.decidedByRole})</span>}
        </>
      )}
      {at && <span className="text-slate-500"> · {at}</span>}
    </p>
  );
}


// ------------------------------------------------------------- Holiday Calendar Tab
export function HolidayCalendar() {
  const { hasPermission } = useAuth();
  const canManageHolidays = hasPermission('holiday.manage');

  const { data: holidays, isLoading: isHolidaysLoading, error: fetchError, mutate: mutateHolidays } = useHolidays();

  const now = new Date();
  const [currentYear, setCurrentYear] = useState(() => now.getUTCFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => now.getUTCMonth());

  const { data: calendarLeaves, isLoading: isLeavesLoading, mutate: mutateLeaves } = useCalendarLeaves(currentYear, currentMonth);

  const isLoading = isHolidaysLoading || isLeavesLoading;

  const mutate = async () => {
    await Promise.all([mutateHolidays(), mutateLeaves()]);
  };

  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const MONTHS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  };

  const getStartDayOfWeek = (year: number, month: number) => {
    return new Date(Date.UTC(year, month, 1)).getUTCDay();
  };

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const startDayOfWeek = getStartDayOfWeek(currentYear, currentMonth);

  const prevMonth = () => {
    setFormError(null);
    setSelectedDay(null);
    setIsEditing(false);
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((prev) => prev - 1);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
  };

  const nextMonth = () => {
    setFormError(null);
    setSelectedDay(null);
    setIsEditing(false);
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
  };

  const getHolidayForDay = (dayNum: number) => {
    if (!holidays) return null;
    const found = holidays.find((h) => {
      const hDate = new Date(h.date);
      const hYear = hDate.getUTCFullYear();
      const hMonth = hDate.getUTCMonth();
      const hDay = hDate.getUTCDate();
      return hYear === currentYear && hMonth === currentMonth && hDay === dayNum;
    });
    return found || null;
  };

  const getLeavesForDay = (dayNum: number) => {
    if (!calendarLeaves || calendarLeaves.length === 0) return [];
    const dayStart = new Date(Date.UTC(currentYear, currentMonth, dayNum, 0, 0, 0, 0)).getTime();
    const dayEnd = new Date(Date.UTC(currentYear, currentMonth, dayNum, 23, 59, 59, 999)).getTime();
    return calendarLeaves.filter((req) => {
      const from = new Date(req.fromDate).getTime();
      const to = new Date(req.toDate).getTime();
      return from <= dayEnd && to >= dayStart;
    });
  };

  const handleSelectDay = (dayNum: number) => {
    setSelectedDay(dayNum);
    const existingHoliday = getHolidayForDay(dayNum);
    if (existingHoliday) {
      setFormName(existingHoliday.name);
      setFormDescription(existingHoliday.description || '');
    } else {
      setFormName('');
      setFormDescription('');
    }
    setIsEditing(false);
    setFormError(null);
  };

  const handleSaveHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDay) return;

    if (!formName.trim()) {
      setFormError('Holiday name is required.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const dateString = new Date(Date.UTC(currentYear, currentMonth, selectedDay)).toISOString();
    const existingHoliday = getHolidayForDay(selectedDay);

    try {
      if (existingHoliday) {
        await holidayApi.updateHoliday(existingHoliday.id, {
          name: formName,
          date: dateString,
          description: formDescription,
        });
      } else {
        await holidayApi.createHoliday({
          name: formName,
          date: dateString,
          description: formDescription,
        });
      }
      setIsEditing(false);
      await mutate();
    } catch (err: any) {
      setFormError(err.message || 'An error occurred while saving the holiday.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteHoliday = async () => {
    if (!selectedDay) return;
    const existingHoliday = getHolidayForDay(selectedDay);
    if (!existingHoliday) return;

    if (!confirm(`Are you sure you want to delete the holiday "${existingHoliday.name}"?`)) {
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      await holidayApi.deleteHoliday(existingHoliday.id);
      setSelectedDay(null);
      setIsEditing(false);
      setFormName('');
      setFormDescription('');
      await mutate();
    } catch (err: any) {
      setFormError(err.message || 'An error occurred while deleting the holiday.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const calendarCells = [];
  for (let i = 0; i < startDayOfWeek; i++) {
    calendarCells.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarCells.push(i);
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner label="Loading calendar..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-slate-800">Company Holiday Calendar</h2>
        <p className="text-sm text-slate-500">
          View official non-working days.{' '}
          {canManageHolidays ? 'Add, edit, or remove holidays.' : 'Sundays are automatic weekly holidays.'}
        </p>
      </div>

      {fetchError && <Alert tone="error">{fetchError.message}</Alert>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <Dropdown
                  showArrow={false}
                  value={String(currentMonth)}
                  onChange={(val) => {
                    setFormError(null);
                    setSelectedDay(null);
                    setIsEditing(false);
                    setCurrentMonth(Number(val));
                  }}
                  options={MONTHS.map((month, index) => ({
                    value: String(index),
                    label: month,
                  }))}
                  triggerClassName="px-3 py-1.5 text-sm font-semibold min-w-[120px]"
                />
                <Dropdown
                  showArrow={false}
                  value={String(currentYear)}
                  onChange={(val) => {
                    setFormError(null);
                    setSelectedDay(null);
                    setIsEditing(false);
                    setCurrentYear(Number(val));
                  }}
                  options={[2024, 2025, 2026, 2027, 2028, 2029, 2030].map((yr) => ({
                    value: String(yr),
                    label: String(yr),
                  }))}
                  triggerClassName="px-3 py-1.5 text-sm font-semibold min-w-[85px]"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold text-[#8B2424] transition hover:bg-[#F9DADA] border border-gray-200"
                >
                  ‹ Prev
                </button>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold text-[#8B2424] transition hover:bg-[#F9DADA] border border-gray-200"
                >
                  Next ›
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center font-semibold text-xs text-slate-500 border-b pb-2 mb-2">
              <div className="text-red-500">SUN</div>
              <div>MON</div>
              <div>TUE</div>
              <div>WED</div>
              <div>THU</div>
              <div>FRI</div>
              <div>SAT</div>
            </div>

            <div className="grid grid-cols-7 gap-2">
              {calendarCells.map((dayNum, idx) => {
                if (dayNum === null) {
                  return <div key={`empty-${idx}`} className="min-h-[4.5rem] bg-slate-50/50 rounded-lg"></div>;
                }

                const dayOfWeek = idx % 7;
                const isSunday = dayOfWeek === 0;
                const holiday = getHolidayForDay(dayNum);
                const dayLeaves = getLeavesForDay(dayNum);
                const isSelected = selectedDay === dayNum;

                let cellBg = 'bg-white hover:bg-[#F9DADA]/50 hover:text-[#8B2424]';
                let borderStyle = 'border border-slate-200';
                let textStyle = 'text-slate-800';

                if (isSunday) {
                  cellBg = 'bg-red-50/50 hover:bg-red-50';
                  textStyle = 'text-red-600 font-semibold';
                }

                if (holiday) {
                  cellBg = 'bg-emerald-50 hover:bg-emerald-100';
                  textStyle = 'text-emerald-700 font-bold';
                  borderStyle = 'border-2 border-emerald-300';
                } else if (dayLeaves.length > 0) {
                  cellBg = 'bg-[#FFF5F5] hover:bg-[#F9DADA]/60';
                  borderStyle = 'border border-[#F9DADA]';
                }

                if (isSelected) {
                  borderStyle = 'border-2 border-[#8B2424] ring-2 ring-[#F9DADA]';
                }

                return (
                  <button
                    key={`day-${dayNum}`}
                    type="button"
                    onClick={() => handleSelectDay(dayNum)}
                    className={`min-h-[4.5rem] p-1.5 rounded-lg flex flex-col justify-between items-start transition-all relative text-left ${cellBg} ${borderStyle}`}
                  >
                    <span className={`text-xs ${textStyle}`}>{dayNum}</span>
                    <div className="w-full space-y-0.5 mt-0.5">
                      {holiday && (
                        <span className="block w-full text-[10px] truncate text-emerald-800 font-medium" title={holiday.name}>
                          {holiday.name}
                        </span>
                      )}
                      {dayLeaves.length > 0 && (
                        <span
                          className="inline-flex items-center px-1 py-0.5 text-[9px] font-semibold bg-[#F9DADA] text-[#8B2424] rounded truncate max-w-full"
                          title={dayLeaves
                            .map(
                              (l) =>
                                `${l.employeeName || 'Staff'} (${l.leaveTypeName || 'Leave'})` +
                                (l.decidedByName ? ` — approved by ${l.decidedByName}` : '')
                            )
                            .join('\n')}
                        >
                          {dayLeaves.length === 1
                            ? (dayLeaves[0].employeeName?.split(' ')[0] || '1 on leave')
                            : `${dayLeaves.length} on leave`}
                        </span>
                      )}
                      {isSunday && !holiday && <span className="block text-[8px] text-red-400 font-normal">Weekly</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </Card>

        <Card className="p-6">
          {selectedDay === null ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="text-slate-400 text-3xl mb-2">📅</div>
              <p className="font-semibold text-slate-700">No date selected</p>
              <p className="text-xs text-slate-400 mt-1 max-w-[200px]">
                Click on any calendar day to view holiday details, approved leaves, or add new holidays.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="font-bold text-slate-800">
                  {MONTHS[currentMonth]} {selectedDay}, {currentYear}
                </h3>
                <Button variant="ghost" className="h-8 w-8 !p-0" onClick={() => setSelectedDay(null)}>
                  ✕
                </Button>
              </div>

              {formError && <Alert tone="error">{formError}</Alert>}

              {(() => {
                const holiday = getHolidayForDay(selectedDay);
                const dayLeaves = getLeavesForDay(selectedDay);
                const dayDate = new Date(Date.UTC(currentYear, currentMonth, selectedDay));
                const isSunday = dayDate.getUTCDay() === 0;

                if (isEditing && canManageHolidays) {
                  return (
                    <form onSubmit={handleSaveHoliday} className="space-y-4">
                      <h4 className="text-sm font-semibold text-slate-700">
                        {holiday ? 'Edit Holiday' : 'Add Holiday'}
                      </h4>
                      <Field
                        label="Holiday Name"
                        placeholder="e.g. Independence Day"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        required
                        disabled={isSubmitting}
                      />

                      <TextAreaField
                        label="Description (Optional)"
                        placeholder="Short description of the holiday..."
                        value={formDescription}
                        onChange={(e) => setFormDescription(e.target.value)}
                        disabled={isSubmitting}
                        rows={3}
                      />

                      <div className="flex gap-2 pt-2">
                        <Button type="submit" className="flex-1" isLoading={isSubmitting}>
                          {holiday ? 'Update' : 'Save'}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            if (holiday) {
                              setFormName(holiday.name);
                              setFormDescription(holiday.description || '');
                            }
                            setIsEditing(false);
                          }}
                          disabled={isSubmitting}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  );
                }

                return (
                  <div className="space-y-4">
                    {/* Holiday Section */}
                    {holiday ? (
                      <div className="space-y-3">
                        <div>
                          <span className="text-xs text-slate-400 uppercase tracking-wider">Holiday Name</span>
                          <p className="font-semibold text-slate-800 text-lg">{holiday.name}</p>
                        </div>

                        {holiday.description && (
                          <div>
                            <span className="text-xs text-slate-400 uppercase tracking-wider">Description</span>
                            <p className="text-sm text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 mt-1">
                              {holiday.description}
                            </p>
                          </div>
                        )}

                        <div className="pt-1 flex flex-wrap gap-2">
                          {isSunday && <Badge>Sunday Weekly Holiday</Badge>}
                          {!isSunday && <Badge>Company Public Holiday</Badge>}
                        </div>

                        {canManageHolidays && (
                          <div className="flex gap-2 pt-3 border-t">
                            <Button variant="secondary" className="flex-1" onClick={() => setIsEditing(true)}>
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              className="text-red-600 hover:bg-red-50"
                              onClick={handleDeleteHoliday}
                              disabled={isSubmitting}
                            >
                              Delete
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <p className="font-semibold text-slate-700">{isSunday ? 'Sunday Weekly Holiday' : 'Regular Workday'}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {isSunday
                              ? 'Sundays are automatically treated as weekly non-working days.'
                              : 'No official holiday is scheduled for this date.'}
                          </p>
                        </div>
                        {canManageHolidays && (
                          <Button
                            variant="secondary"
                            className="h-9 px-3 text-xs"
                            onClick={() => {
                              setFormName('');
                              setFormDescription('');
                              setIsEditing(true);
                            }}
                          >
                            + Add Holiday
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Approved Leaves Section */}
                    <div className="pt-4 border-t border-slate-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          On Leave ({dayLeaves.length})
                        </span>
                      </div>
                      {dayLeaves.length > 0 ? (
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {dayLeaves.map((l) => (
                            <div key={l.id} className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-100 text-xs">
                              <div className="flex items-center justify-between">
                                <p className="font-semibold text-blue-900">{l.employeeName || 'Employee'}</p>
                                <span className="text-[10px] px-1.5 py-0.5 bg-blue-200/70 text-blue-800 rounded font-medium">
                                  {l.leaveTypeName || 'Leave'}
                                </span>
                              </div>
                              <p className="text-slate-500 text-[11px] mt-1">
                                {new Date(l.fromDate).toLocaleDateString()} &ndash; {new Date(l.toDate).toLocaleDateString()} ({l.days} day{l.days > 1 ? 's' : ''})
                              </p>
                              {l.reason && (
                                <p className="text-slate-600 text-[11px] italic mt-1 line-clamp-2">
                                  &ldquo;{l.reason}&rdquo;
                                </p>
                              )}
                              <DecisionNote req={l} className="mt-1.5 pt-1.5 border-t border-blue-100" />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">No employees on approved leave.</p>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

