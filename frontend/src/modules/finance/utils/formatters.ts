/**
 * Converts integer paise into standard Indian Rupee representation.
 * Example: 5000000 paise -> "₹50,000"
 */
export function formatPaise(paise?: number | null, compact = false): string {
  if (paise === undefined || paise === null || isNaN(paise)) return '₹0';
  const rupees = paise / 100;

  if (compact) {
    const abs = Math.abs(rupees);
    const sign = rupees < 0 ? '-' : '';
    if (abs >= 10000000) {
      return `${sign}₹${(abs / 10000000).toFixed(2)}Cr`;
    }
    if (abs >= 100000) {
      return `${sign}₹${(abs / 100000).toFixed(2)}L`;
    }
    if (abs >= 1000) {
      return `${sign}₹${(abs / 1000).toFixed(1)}k`;
    }
    return `${sign}₹${Math.round(abs)}`;
  }

  const sign = rupees < 0 ? '-' : '';
  const abs = Math.abs(rupees);
  return `${sign}₹${abs.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

/**
 * Converts rupees amount to formatted currency string (with up to 2 decimal places if needed).
 */
export function formatCurrency(rupees?: number | null): string {
  if (rupees === undefined || rupees === null || isNaN(rupees)) return '₹0';
  const abs = Math.abs(rupees);
  const sign = rupees < 0 ? '-' : '';
  return `${sign}₹${abs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Formats a decimal percentage.
 */
export function formatPercent(value?: number | null): string {
  if (value === undefined || value === null || isNaN(value)) return '0%';
  return `${value.toFixed(1)}%`;
}

/**
 * Formats date into readable string.
 */
export function formatDate(isoString?: string | null): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return isoString;
  }
}
