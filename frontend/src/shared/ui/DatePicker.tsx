'use client';

import React, { useState, useEffect, useRef, useId } from 'react';

export interface DatePickerProps {
  label?: string;
  value?: string; // Format: YYYY-MM-DD
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  min?: string;
  max?: string;
  className?: string;
  triggerClassName?: string;
  name?: string;
  id?: string;
  error?: string;
}

/**
 * Standardized DatePicker matching the Campaigns and Operations calendar design:
 * - Trigger button with calendar icon 📅, focus ring-2 ring-[#F9DADA], border-[#8B2424]
 * - Popup calendar with Month & Year navigation (‹ ›)
 * - Weekday headers: Su, Mo, Tu, We, Th, Fr, Sa
 * - Day cells:
 *   - Hover: hover:bg-[#F9DADA] hover:text-[#8B2424]
 *   - Selected: bg-[#8B2424] text-[#F9DADA] font-bold
 *   - Today: border border-[#8B2424]/40 font-semibold text-[#8B2424]
 */
export function DatePicker({
  label,
  value,
  defaultValue = '',
  onChange,
  placeholder = 'Select date',
  disabled = false,
  required = false,
  min,
  max,
  className = '',
  triggerClassName = '',
  name,
  id,
  error,
}: DatePickerProps) {
  const generatedId = useId();
  const pickerId = id ?? generatedId;
  const pickerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState<string>(defaultValue);

  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;

  // Parse YYYY-MM-DD safely
  const parseDate = (val?: string) => {
    if (!val) return new Date();
    const parts = val.split('-').map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    const d = new Date(val);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  const [viewDate, setViewDate] = useState<Date>(() => parseDate(currentValue));

  useEffect(() => {
    if (currentValue) {
      setViewDate(parseDate(currentValue));
    }
  }, [currentValue]);

  // Outside click to close
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [open]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay(); // 0 is Sunday

  const formatDateStr = (day: number) => {
    const m = String(month + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
  };

  const handleSelectDate = (day: number) => {
    if (disabled) return;
    const dateStr = formatDateStr(day);
    if (min && dateStr < min) return;
    if (max && dateStr > max) return;
    if (!isControlled) {
      setInternalValue(dateStr);
    }
    onChange?.(dateStr);
    setOpen(false);
  };

  const prevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewDate(new Date(year, month - 1, 1));
  };

  const nextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewDate(new Date(year, month + 1, 1));
  };

  const monthName = viewDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div ref={pickerRef} className={`relative ${className}`}>
      {label && (
        <label htmlFor={pickerId} className="mb-1.5 block text-sm font-medium text-slate-700">
          {label}
          {required && <span className="ml-1 text-[#8B2424]">*</span>}
        </label>
      )}

      {name && <input type="hidden" name={name} value={currentValue} />}

      {/* Date Trigger Button */}
      <button
        id={pickerId}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        className={`flex w-full cursor-pointer items-center justify-between rounded-lg border bg-white px-3 py-2 text-left text-sm text-gray-900 outline-none transition ${
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100'
            : open
              ? 'border-[#8B2424] ring-2 ring-[#F9DADA]'
              : 'border-gray-300 hover:border-[#8B2424] focus:border-[#8B2424] focus:ring-2 focus:ring-[#F9DADA]'
        } ${disabled ? 'cursor-not-allowed opacity-60 bg-gray-50' : ''} ${triggerClassName}`}
      >
        <span className={currentValue ? 'text-gray-900' : 'text-gray-400'}>
          {currentValue || placeholder}
        </span>
        <span className="text-[#8B2424] select-none text-sm ml-2">📅</span>
      </button>

      {/* Calendar Popup (Matches Image 2) */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-[260px] rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
          {/* Header */}
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={prevMonth}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-sm font-semibold text-[#8B2424] transition hover:bg-[#F9DADA]"
            >
              ‹
            </button>
            <span className="text-sm font-bold text-gray-900">
              {monthName}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-sm font-semibold text-[#8B2424] transition hover:bg-[#F9DADA]"
            >
              ›
            </button>
          </div>

          {/* Weekday Labels */}
          <div className="mb-1.5 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-gray-500">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => (
              <span key={`empty-${i}`} className="h-8 w-8" />
            ))}

            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
              const dateStr = formatDateStr(day);
              const isSelected = currentValue === dateStr;
              const isToday =
                new Date().toISOString().split('T')[0] === dateStr;
              const isDisabled = Boolean(
                (min && dateStr < min) || (max && dateStr > max),
              );

              return (
                <button
                  key={day}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => handleSelectDate(day)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium transition cursor-pointer mx-auto ${
                    isDisabled
                      ? 'cursor-not-allowed text-gray-300'
                      : isSelected
                        ? 'bg-[#8B2424] text-[#F9DADA] font-bold shadow-xs'
                        : isToday
                          ? 'border border-[#8B2424]/40 font-semibold text-[#8B2424] hover:bg-[#F9DADA]'
                          : 'text-gray-700 hover:bg-[#F9DADA] hover:text-[#8B2424]'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export default DatePicker;
