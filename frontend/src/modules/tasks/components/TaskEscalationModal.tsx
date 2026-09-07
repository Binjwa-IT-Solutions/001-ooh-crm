"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Clock,
  ArrowUpRight,
  Users,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Info,
  X,
  RefreshCw,
  Bell,
  AlertCircle,
  Calendar,
} from "lucide-react";

import type { Task } from "../types";
import type { Escalation, EscalationLevel } from "@/modules/escalations/types";
import { useTaskEscalations } from "@/modules/escalations/hooks/useEscalations";
import {
  formatDate,
  formatDateTime,
  getLevelBorderClass,
  getLevelClass,
  getLevelDescription,
  getLevelLabel,
  getOverdueDuration,
  getExpectedEscalationLevel,
} from "@/modules/escalations/format";
import { getTaskName, formatTaskDate, getTaskStatus } from "../format";
import EscalationDetail from "@/modules/escalations/components/EscalationDetail";

interface Props {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function TaskEscalationModal({
  task,
  isOpen,
  onClose,
}: Props) {
  const [selectedEscalation, setSelectedEscalation] = useState<Escalation | null>(null);

  const taskId = task?._id || null;
  const { escalations, loading, error } = useTaskEscalations(isOpen && taskId ? taskId : null);

  if (!isOpen || !task) return null;

  const currentStatus = getTaskStatus(task);
  const overdueInfo = getOverdueDuration(task.deadline);
  const expectedLevel = getExpectedEscalationLevel(task.deadline, task.status);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs overflow-y-auto"
      onMouseDown={onClose}
    >
      <div
        className="my-8 w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl border border-gray-100 transition-all max-h-[90vh] flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#8B2424] to-[#A8333B] text-white shadow-sm ring-2 ring-[#F9DADA]">
              <ArrowUpRight className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#8B2424]">
                  SLA Escalation Engine
                </span>
                <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-medium text-gray-700">
                  {task.type}
                </span>
              </div>
              <h2 className="mt-0.5 text-lg font-bold text-gray-900 line-clamp-1">
                {task.title}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Task Summary Info */}
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-gray-200 bg-gray-50/70 p-4 sm:grid-cols-4">
            <div>
              <p className="text-xs font-medium uppercase text-gray-400">Campaign</p>
              <p className="mt-1 truncate text-sm font-semibold text-gray-900">
                {getTaskName(task.campaignId)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-gray-400">Site</p>
              <p className="mt-1 truncate text-sm font-semibold text-gray-900">
                {getTaskName(task.siteId)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-gray-400">Deadline</p>
              <p
                className={`mt-1 truncate text-sm font-semibold ${
                  currentStatus === "Overdue" ? "text-red-700" : "text-gray-900"
                }`}
              >
                {formatTaskDate(task.deadline)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-gray-400">Status</p>
              <span
                className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  currentStatus === "Completed"
                    ? "bg-green-100 text-green-700"
                    : currentStatus === "Overdue"
                      ? "bg-red-100 text-red-700"
                      : "bg-[#F9DADA] text-[#8B2424]"
                }`}
              >
                {currentStatus === "InProgress" ? "In Progress" : currentStatus}
              </span>
            </div>
          </div>

          {/* Current Live Overdue Diagnosis */}
          <div
            className={`rounded-xl border p-4 ${
              currentStatus === "Completed"
                ? "border-green-200 bg-green-50/70"
                : overdueInfo.isOverdue
                  ? "border-red-200 bg-red-50/70"
                  : "border-blue-200 bg-blue-50/70"
            }`}
          >
            <div className="flex items-start gap-3">
              {currentStatus === "Completed" ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
              ) : overdueInfo.isOverdue ? (
                <Clock className="h-5 w-5 text-[#8B2424] shrink-0 mt-0.5" />
              ) : (
                <Clock className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              )}

              <div className="flex-1 min-w-0">
                <h4
                  className={`text-sm font-bold ${
                    currentStatus === "Completed"
                      ? "text-green-900"
                      : overdueInfo.isOverdue
                        ? "text-red-900"
                        : "text-blue-900"
                  }`}
                >
                  {currentStatus === "Completed"
                    ? "Task Completed"
                    : overdueInfo.isOverdue
                      ? `Task Overdue (${overdueInfo.formattedText})`
                      : "Task On Schedule"}
                </h4>

                <p
                  className={`mt-0.5 text-xs ${
                    currentStatus === "Completed"
                      ? "text-green-700"
                      : overdueInfo.isOverdue
                        ? "text-red-700"
                        : "text-blue-700"
                  }`}
                >
                  {currentStatus === "Completed"
                    ? "This task is completed. Escalation alerts are closed."
                    : overdueInfo.isOverdue
                      ? expectedLevel
                        ? `Threshold reached: ${getLevelLabel(expectedLevel)}. Escalation notifications routed.`
                        : "Overdue by under 2 hours. L1 reminder triggers at 2 hours overdue."
                      : `Deadline is in ${overdueInfo.formattedText}. Escalations trigger automatically if deadline is breached.`}
                </p>
              </div>

              {expectedLevel && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold shadow-xs shrink-0 ${getLevelClass(
                    expectedLevel
                  )}`}
                >
                  <ArrowUpRight className="h-3 w-3" />
                  {expectedLevel} Active
                </span>
              )}
            </div>
          </div>

          {/* Escalation SLA Matrix */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <ArrowUpRight className="h-4 w-4 text-[#8B2424]" />
                Escalation Thresholds & Rules
              </h3>
              <span className="text-xs text-gray-500">Automated SLAs</span>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <ThresholdCard
                level="L1"
                threshold="> 2 Hours Overdue"
                recipient="Assignee"
                description="Reminder notification sent directly to assigned user"
                active={overdueInfo.isOverdue && overdueInfo.totalHours >= 2}
              />
              <ThresholdCard
                level="L2"
                threshold="> 6 Hours Overdue"
                recipient="Manager"
                description="Alert sent to reporting manager for intervention"
                active={overdueInfo.isOverdue && overdueInfo.totalHours >= 6}
              />
              <ThresholdCard
                level="L3"
                threshold="> 24 Hours Overdue"
                recipient="Senior Leadership"
                description="High priority escalation to department leadership"
                active={overdueInfo.isOverdue && overdueInfo.totalHours >= 24}
              />
            </div>
          </div>

          {/* Escalation History Log */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <Bell className="h-4 w-4 text-[#8B2424]" />
                Triggered Escalation History
              </h3>
              <span className="text-xs font-medium text-gray-500">
                {escalations.length} {escalations.length === 1 ? "Event" : "Events"}
              </span>
            </div>

            {loading ? (
              <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-6 text-center">
                <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-[#8B2424]" />
                <p className="mt-2 text-xs text-gray-500">Checking escalation logs...</p>
              </div>
            ) : error ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
                {error}
              </div>
            ) : escalations.length > 0 ? (
              <div className="space-y-2.5">
                {escalations.map((esc) => (
                  <div
                    key={esc._id}
                    className={`flex items-center justify-between rounded-xl border border-gray-200 border-l-4 bg-white p-3.5 shadow-xs transition hover:shadow-sm ${getLevelBorderClass(
                      esc.level
                    )}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold shrink-0 ${getLevelClass(
                          esc.level
                        )}`}
                      >
                        <ArrowUpRight className="h-3 w-3" />
                        {esc.level}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-900">
                          {getLevelDescription(esc.level)}
                        </p>
                        <p className="text-[11px] text-gray-500 flex items-center gap-2 mt-0.5">
                          <span>{formatDateTime(esc.triggeredAt)}</span>
                          <span>•</span>
                          <span>{esc.notifiedUserIds?.length || 0} notified</span>
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedEscalation(esc)}
                      className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:border-[#8B2424] hover:bg-[#FFF7F7] hover:text-[#8B2424] transition shrink-0 ml-2 cursor-pointer"
                    >
                      Details
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-6 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <p className="mt-2 text-sm font-semibold text-gray-800">
                  No escalation events recorded
                </p>
                <p className="mt-0.5 text-xs text-gray-500 max-w-sm mx-auto">
                  {overdueInfo.isOverdue
                    ? "This task is overdue and will be processed during the next background escalation cycle."
                    : "Task is healthy and currently within its SLA deadline window."}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-6 py-4">
          <Link
            href="/escalations"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8B2424] hover:text-[#A8333B] transition"
          >
            All System Escalations
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-gray-800 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-900 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* Escalation Detail Modal */}
      {selectedEscalation && (
        <EscalationDetail
          escalation={selectedEscalation}
          onClose={() => setSelectedEscalation(null)}
        />
      )}
    </div>
  );
}

function ThresholdCard({
  level,
  threshold,
  recipient,
  description,
  active,
}: {
  level: EscalationLevel;
  threshold: string;
  recipient: string;
  description: string;
  active: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3.5 transition ${
        active
          ? "border-[#8B2424] bg-[#FFF7F7] ring-1 ring-[#8B2424]"
          : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${getLevelClass(
            level
          )}`}
        >
          {level}
        </span>
        {active ? (
          <span className="text-[11px] font-bold text-[#8B2424] flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#8B2424] animate-ping" />
            Triggered
          </span>
        ) : (
          <span className="text-[11px] font-medium text-gray-400">Pending</span>
        )}
      </div>

      <p className="mt-2 text-xs font-bold text-gray-900">{threshold}</p>
      <p className="mt-0.5 text-[11px] font-medium text-[#8B2424]">To: {recipient}</p>
      <p className="mt-1 text-[11px] text-gray-500 leading-tight">{description}</p>
    </div>
  );
}

