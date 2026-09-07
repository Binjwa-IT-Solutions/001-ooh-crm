import type {
  Escalation,
  EscalationLevel,
} from "./types";

export function getLevelLabel(
  level: EscalationLevel,
): string {
  switch (level) {
    case "L1":
      return "L1 Reminder";

    case "L2":
      return "L2 Manager Alert";

    case "L3":
      return "L3 Senior Escalation";

    default:
      return level;
  }
}

export function getLevelDescription(
  level: EscalationLevel,
): string {
  switch (level) {
    case "L1":
      return "Reminder sent to assignee";

    case "L2":
      return "Alert sent to reporting manager";

    case "L3":
      return "Senior escalation triggered";

    default:
      return "Escalation triggered";
  }
}

export function getLevelClass(
  level: EscalationLevel,
): string {
  switch (level) {
    case "L1":
      return "bg-slate-100 text-slate-700 border border-slate-200/80";

    case "L2":
      return "bg-amber-50 text-amber-800 border border-amber-200/80";

    case "L3":
      return "bg-rose-50 text-rose-800 border border-rose-200/80";

    default:
      return "bg-gray-100 text-gray-700 border border-gray-200";
  }
}

export function getLevelBorderClass(
  level: EscalationLevel,
): string {
  switch (level) {
    case "L1":
      return "border-l-slate-400";

    case "L2":
      return "border-l-amber-500";

    case "L3":
      return "border-l-rose-500";

    default:
      return "border-l-gray-300";
  }
}

export function formatDate(
  value: string,
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  );
}

export function formatDateTime(
  value: string,
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  );
}

export function sortEscalations(
  escalations: Escalation[],
): Escalation[] {
  return [...escalations].sort(
    (a, b) =>
      new Date(
        b.triggeredAt,
      ).getTime() -
      new Date(
        a.triggeredAt,
      ).getTime(),
  );
}

export function countByLevel(
  escalations: Escalation[],
) {
  return {
    L1: escalations.filter(
      (item) => item.level === "L1",
    ).length,

    L2: escalations.filter(
      (item) => item.level === "L2",
    ).length,

    L3: escalations.filter(
      (item) => item.level === "L3",
    ).length,
  };
}

export function getOverdueDuration(deadline: string) {
  const deadlineDate = new Date(deadline);
  const now = new Date();

  if (Number.isNaN(deadlineDate.getTime())) {
    return {
      isOverdue: false,
      hours: 0,
      minutes: 0,
      totalHours: 0,
      formattedText: "—",
    };
  }

  const diffMs = now.getTime() - deadlineDate.getTime();
  const isOverdue = diffMs > 0;

  if (!isOverdue) {
    const remainingMs = Math.abs(diffMs);
    const totalRemainingMinutes = Math.floor(remainingMs / (1000 * 60));
    const hours = Math.floor(totalRemainingMinutes / 60);
    const minutes = totalRemainingMinutes % 60;

    return {
      isOverdue: false,
      hours,
      minutes,
      totalHours: remainingMs / (1000 * 60 * 60),
      formattedText:
        hours > 24
          ? `${Math.floor(hours / 24)}d left`
          : hours > 0
            ? `${hours}h ${minutes}m left`
            : `${minutes}m left`,
    };
  }

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const totalHours = diffMs / (1000 * 60 * 60);

  return {
    isOverdue: true,
    hours,
    minutes,
    totalHours,
    formattedText:
      hours > 24
        ? `${Math.floor(hours / 24)}d ${hours % 24}h overdue`
        : hours > 0
          ? `${hours}h ${minutes}m overdue`
          : `${minutes}m overdue`,
  };
}

export function getExpectedEscalationLevel(
  deadline: string,
  status: string,
): EscalationLevel | null {
  if (status === "Completed") return null;

  const { isOverdue, totalHours } = getOverdueDuration(deadline);
  if (!isOverdue) return null;

  if (totalHours >= 24) return "L3";
  if (totalHours >= 6) return "L2";
  if (totalHours >= 2) return "L1";

  return null;
}