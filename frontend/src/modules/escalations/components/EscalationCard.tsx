"use client";

import type { Escalation } from "../types";

import {
  formatDateTime,
  getLevelClass,
  getLevelDescription,
  getLevelLabel,
  getLevelBorderClass,
} from "../format";

interface Props {
  escalation: Escalation;
  onOpen: (
    escalation: Escalation,
  ) => void;
}

export default function EscalationCard({
  escalation,
  onOpen,
}: Props) {
  return (
    <div
      className={`group rounded-xl border border-gray-200 border-l-4 bg-white p-5 shadow-sm transition-all hover:border-[#8B2424]/30 hover:shadow-md ${getLevelBorderClass(
        escalation.level,
      )}`}
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${getLevelClass(
                escalation.level,
              )}`}
            >
              {getLevelLabel(
                escalation.level,
              )}
            </span>

            <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600">
              Automatic
            </span>
          </div>

          <div className="mt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Task
            </p>

            <p className="mt-1 truncate text-base font-semibold text-gray-900">
              {typeof escalation.taskId === "object" && escalation.taskId !== null
                ? (escalation.taskId as any).title || (escalation.taskId as any)._id
                : escalation.taskId}
            </p>

            <p className="mt-1 text-sm text-gray-500">
              {getLevelDescription(
                escalation.level,
              )}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:min-w-[430px]">
          <Info
            label="Triggered"
            value={formatDateTime(
              escalation.triggeredAt,
            )}
          />

          <Info
            label="Notified"
            value={`${escalation.notifiedUserIds.length} ${
              escalation.notifiedUserIds.length ===
              1
                ? "user"
                : "users"
            }`}
          />

          <div className="col-span-2 flex items-end sm:col-span-1">
            <button
              type="button"
              onClick={() =>
                onOpen(escalation)
              }
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-[#8B2424] hover:bg-[#FFF7F7] hover:text-[#8B2424] focus:outline-none focus:ring-2 focus:ring-[#F9DADA]"
            >
              View Details
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs uppercase tracking-wide text-gray-400">
        {label}
      </p>

      <p className="mt-1 truncate text-sm font-semibold text-gray-800">
        {value}
      </p>
    </div>
  );
}