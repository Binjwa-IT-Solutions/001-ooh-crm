import { ArrowUpRight, Clock } from "lucide-react";
import type { Task } from "../types";
import { getExpectedEscalationLevel, getLevelClass } from "@/modules/escalations/format";

import {
  formatTaskDate,
  formatTaskStatus,
  getTaskName,
  getTaskStatus,
} from "../format";

interface Props {
  task: Task;
  onAction: () => void;
  onOpenEscalation?: (task: Task) => void;
}

export default function TaskCard({
  task,
  onAction,
  onOpenEscalation,
}: Props) {
  const status = getTaskStatus(task);
  const expectedLevel = getExpectedEscalationLevel(task.deadline, task.status);

  return (
    <div className="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-[#A8333B] hover:shadow-md">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-gray-900">
              {task.title}
            </h3>

            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
              {task.type}
            </span>

            {expectedLevel && status !== "Completed" && (
              <button
                type="button"
                onClick={() => onOpenEscalation?.(task)}
                title="View SLA escalation tier"
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold transition hover:opacity-90 cursor-pointer ${getLevelClass(
                  expectedLevel
                )}`}
              >
                <ArrowUpRight className="h-3 w-3" />
                SLA {expectedLevel}
              </button>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Info
              label="Campaign"
              value={getTaskName(task.campaignId)}
            />

            <Info
              label="Site"
              value={getTaskName(task.siteId)}
            />

            <Info
              label="Deadline"
              value={formatTaskDate(
                task.deadline,
              )}
              danger={status === "Overdue"}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4 lg:flex-col lg:items-end lg:border-0 lg:pt-0">
          <div className="flex items-center gap-2">
            <StatusBadge status={status} />
          </div>

          <div className="flex items-center gap-2">
            {onOpenEscalation && (
              <button
                type="button"
                onClick={() => onOpenEscalation(task)}
                title="View escalation status and SLA history"
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:border-[#8B2424] hover:bg-[#FFF7F7] hover:text-[#8B2424] focus:outline-none focus:ring-2 focus:ring-[#F9DADA] cursor-pointer"
              >
                <ArrowUpRight className="h-3.5 w-3.5 text-[#8B2424]" />
                Escalation
              </button>
            )}

            {status !== "Completed" && (
              <button
                type="button"
                onClick={onAction}
                className="rounded-lg bg-[#8B2424] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#A8333B] focus:outline-none focus:ring-2 focus:ring-[#F9DADA] focus:ring-offset-1 cursor-pointer"
              >
                {status === "Pending"
                  ? "Start Task"
                  : "Complete Task"}
              </button>
            )}

            {status === "Completed" && (
              <span className="text-xs font-semibold text-green-700 bg-green-50 px-2.5 py-1.5 rounded-lg">
                Completed
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
        {label}
      </p>

      <p
        className={`mt-1 truncate text-sm font-semibold ${
          danger
            ? "text-[#A8333B]"
            : "text-gray-800"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const label =
    status === "InProgress"
      ? "In Progress"
      : status;

  const className =
    status === "Completed"
      ? "bg-green-100 text-green-700"
      : status === "Overdue"
        ? "bg-[#F9DADA] text-[#A8333B]"
        : status === "InProgress"
          ? "bg-[#F9DADA] text-[#8B2424]"
          : "bg-gray-100 text-gray-700";

  return (
    <span
      className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${className}`}
    >
      {label}
    </span>
  );
}