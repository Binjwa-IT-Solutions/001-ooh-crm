"use client";

import { ArrowUpRight } from "lucide-react";
import type { Escalation } from "../types";

import {
  formatDateTime,
  getLevelClass,
  getLevelDescription,
  getLevelLabel,
} from "../format";

interface Props {
  escalation: Escalation;
  onClose: () => void;
}

export default function EscalationDetail({
  escalation,
  onClose,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <div className="flex items-start justify-between border-b border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#8B2424] to-[#A8333B] text-white shadow-sm ring-2 ring-[#F9DADA]">
              <ArrowUpRight className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold tracking-wider text-[#8B2424] uppercase">
                ESCALATION DETAILS
              </p>

              <h2 className="mt-0.5 text-lg font-bold text-gray-900">
                {getLevelLabel(
                  escalation.level,
                )}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg px-3 py-1 text-2xl leading-none text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none"
          >
            ×
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div
            className={`rounded-xl p-4 ${getLevelClass(
              escalation.level,
            )}`}
          >
            <p className="text-sm font-bold flex items-center gap-1.5">
              <ArrowUpRight className="h-4 w-4" />
              {getLevelLabel(
                escalation.level,
              )}
            </p>

            <p className="mt-1 text-sm opacity-80">
              {getLevelDescription(
                escalation.level,
              )}
            </p>
          </div>

          <div className="space-y-4">
            <Row
              label="Task"
              value={
                typeof escalation.taskId === "object" && escalation.taskId !== null
                  ? (escalation.taskId as any).title || (escalation.taskId as any)._id
                  : escalation.taskId
              }
            />

            <Row
              label="Escalation Level"
              value={escalation.level}
            />

            <Row
              label="Triggered At"
              value={formatDateTime(
                escalation.triggeredAt,
              )}
            />

            <Row
              label="Users Notified"
              value={String(
                escalation.notifiedUserIds
                  .length,
              )}
            />
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Notification Recipients
            </p>

            <div className="mt-3 space-y-2">
              {escalation
                .notifiedUserIds
                .length > 0 ? (
                escalation.notifiedUserIds.map(
                  (userId) => (
                    <div
                      key={userId}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700"
                    >
                      {userId}
                    </div>
                  ),
                )
              ) : (
                <p className="text-sm text-gray-500">
                  No recipients recorded.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-gray-100 pb-3">
      <span className="text-sm text-gray-500">
        {label}
      </span>

      <span className="text-right text-sm font-semibold text-gray-900">
        {value}
      </span>
    </div>
  );
}