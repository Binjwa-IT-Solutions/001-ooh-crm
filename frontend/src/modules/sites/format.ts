export function formatCost(
  paise?: number | null
): string {
  if (
    paise === undefined ||
    paise === null
  ) {
    return "—";
  }

  const rupees = paise / 100;

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(rupees);
}

export function formatDate(
  value?: string | Date | null
): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}