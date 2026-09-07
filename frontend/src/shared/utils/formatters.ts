export function formatHoursToHM(hours?: number | null): string {
  if (hours === undefined || hours === null || hours === 0) {
    return '-';
  }
  
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  
  return `${h}h ${m}m`;
}
