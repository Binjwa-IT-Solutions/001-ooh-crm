/**
 * Business date and time formatting utilities for HR & Attendance.
 * Strictly adheres to Asia/Kolkata timezone to prevent 1-day timezone shifting.
 */

export function toBusinessDateString(date: Date | string | number): string {
  if (!date) return '';
  if (typeof date === 'string') {
    const trimmed = date.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
  }
  const d = typeof date === 'object' ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

export function formatBusinessDateDMY(date?: Date | string | null): string {
  if (!date) return '-';
  const bStr = toBusinessDateString(date);
  if (!bStr || !/^\d{4}-\d{2}-\d{2}$/.test(bStr)) return '-';
  const [y, m, d] = bStr.split('-');
  return `${d}-${m}-${y}`;
}

export function formatBusinessDateDisplay(date?: Date | string | null): string {
  if (!date) return '-';
  const bStr = toBusinessDateString(date);
  if (!bStr || !/^\d{4}-\d{2}-\d{2}$/.test(bStr)) return '-';
  const [y, m, d] = bStr.split('-');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIndex = parseInt(m, 10) - 1;
  return `${d} ${monthNames[monthIndex] || m} ${y}`;
}

export function formatBusinessTime(val?: string | Date | null): string {
  if (!val) return '-';
  try {
    const d = typeof val === 'string' ? new Date(val) : val;
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleTimeString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '-';
  }
}

export function formatDurationHM(hours?: number | null): string {
  if (hours === undefined || hours === null || hours <= 0) return '0h';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatHoursToHM(hours?: number | null): string {
  if (hours === undefined || hours === null || hours === 0) {
    return '-';
  }
  
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  
  return `${h}h ${m}m`;
}

