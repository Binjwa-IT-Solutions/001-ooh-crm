import type { ProofStatus } from "../types";

interface Props {
  status: ProofStatus;
}

export default function ProofStatusBadge({
  status,
}: Props) {
  const styles: Record<ProofStatus, string> = {
    Pending:
      "bg-amber-100 text-amber-800 border border-amber-200",
    Approved:
      "bg-blue-100 text-blue-800 border border-blue-200",
    Complete:
      "bg-emerald-100 text-emerald-800 border border-emerald-200",
    Rejected:
      "bg-rose-100 text-rose-800 border border-rose-200",
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${styles[status]}`}
    >
      {status}
    </span>
  );
}