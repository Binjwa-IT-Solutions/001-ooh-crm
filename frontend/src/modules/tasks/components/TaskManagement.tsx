"use client";

import { useMemo, useState } from "react";

import { useTask } from "../hooks/useTask";
import type { Task } from "../types";

import TaskCard from "./TaskCard";
import TaskFilters from "./TaskFilters";
import TaskEscalationModal from "./TaskEscalationModal";

export default function TaskManagement() {
  const {
    tasks,
    loading,
    updating,
    error,
    changeTask,
  } = useTask();

  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [selectedEscalationTask, setSelectedEscalationTask] = useState<Task | null>(null);

  const filteredTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          (!status ||
            getStatus(task) === status) &&
          (!type || task.type === type),
      ),
    [tasks, status, type],
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(
    tomorrow.getDate() + 1,
  );

  const completedTasks = filteredTasks.filter(
    (task) => task.status === "Completed",
  );

  const overdueTasks = filteredTasks.filter(
    (task) =>
      task.status !== "Completed" &&
      getStatus(task) === "Overdue",
  );

  const todayTasks = filteredTasks.filter((task) => {
    if (task.status === "Completed") return false;
    if (getStatus(task) === "Overdue") return false;
    const date = new Date(task.deadline);
    return date >= today && date < tomorrow;
  });

  const upcomingTasks = filteredTasks.filter((task) => {
    if (task.status === "Completed") return false;
    if (getStatus(task) === "Overdue") return false;
    const date = new Date(task.deadline);
    return date >= tomorrow;
  });

  async function handleAction(task: Task) {
    const current = getStatus(task);

    await changeTask(task._id, {
      status:
        current === "Pending"
          ? "InProgress"
          : "Completed",
    });
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#8B2424]" />

        <p className="mt-4 text-sm text-gray-500">
          Loading tasks...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            My Tasks
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Manage your assigned campaign work.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {status && (
            <button
              type="button"
              onClick={() => setStatus("")}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50"
            >
              Clear filter ({status})
            </button>
          )}

          <div className="rounded-lg bg-[#F9DADA] px-3 py-2 text-sm font-semibold text-[#8B2424]">
            {filteredTasks.length}{" "}
            {filteredTasks.length === 1
              ? "Task"
              : "Tasks"}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard
          title="Today"
          count={todayTasks.length}
          active={status === "InProgress"}
          onClick={() =>
            setStatus((prev) =>
              prev === "InProgress" ? "" : "InProgress",
            )
          }
        />

        <SummaryCard
          title="Overdue"
          count={overdueTasks.length}
          variant="danger"
          active={status === "Overdue"}
          onClick={() =>
            setStatus((prev) =>
              prev === "Overdue" ? "" : "Overdue",
            )
          }
        />

        <SummaryCard
          title="Upcoming"
          count={upcomingTasks.length}
          active={status === "Pending"}
          onClick={() =>
            setStatus((prev) =>
              prev === "Pending" ? "" : "Pending",
            )
          }
        />

        <SummaryCard
          title="Completed"
          count={completedTasks.length}
          variant="success"
          active={status === "Completed"}
          onClick={() =>
            setStatus((prev) =>
              prev === "Completed" ? "" : "Completed",
            )
          }
        />
      </div>

      {/* Filters */}
      <TaskFilters
        status={status}
        type={type}
        onStatusChange={setStatus}
        onTypeChange={setType}
      />

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {updating && (
        <div className="rounded-lg bg-[#F9DADA] px-4 py-2 text-sm font-medium text-[#8B2424]">
          Updating task...
        </div>
      )}

      {/* Today */}
      {(!status || status === "InProgress" || status === "Pending") && (
        <TaskSection
          title="Today"
          count={todayTasks.length}
          tasks={todayTasks}
          onAction={handleAction}
          onOpenEscalation={setSelectedEscalationTask}
        />
      )}

      {/* Overdue */}
      {(!status || status === "Overdue") && (
        <TaskSection
          title="Overdue"
          count={overdueTasks.length}
          tasks={overdueTasks}
          variant="danger"
          onAction={handleAction}
          onOpenEscalation={setSelectedEscalationTask}
        />
      )}

      {/* Upcoming */}
      {(!status || status === "Pending") && (
        <TaskSection
          title="Upcoming"
          count={upcomingTasks.length}
          tasks={upcomingTasks}
          onAction={handleAction}
          onOpenEscalation={setSelectedEscalationTask}
        />
      )}

      {/* Completed Tasks */}
      {(!status || status === "Completed") && (
        <TaskSection
          title="Completed Tasks"
          count={completedTasks.length}
          tasks={completedTasks}
          variant="success"
          onAction={handleAction}
          onOpenEscalation={setSelectedEscalationTask}
        />
      )}

      {!filteredTasks.length && (
        <EmptyState
          message={
            status === "Completed"
              ? "No completed tasks found"
              : undefined
          }
        />
      )}

      {/* Task Escalation Modal */}
      <TaskEscalationModal
        task={selectedEscalationTask}
        isOpen={Boolean(selectedEscalationTask)}
        onClose={() => setSelectedEscalationTask(null)}
      />
    </div>
  );
}

function getStatus(task: Task) {
  if (
    task.status !== "Completed" &&
    new Date(task.deadline) < new Date()
  ) {
    return "Overdue";
  }

  return task.status;
}

function SummaryCard({
  title,
  count,
  variant = "default",
  active = false,
  onClick,
}: {
  title: string;
  count: number;
  variant?: "default" | "danger" | "success";
  active?: boolean;
  onClick?: () => void;
}) {
  const numberClass =
    variant === "danger"
      ? "text-[#A8333B]"
      : variant === "success"
        ? "text-green-700"
        : "text-[#8B2424]";

  const iconBg =
    variant === "danger"
      ? "bg-[#F9DADA] text-[#A8333B]"
      : variant === "success"
        ? "bg-green-100 text-green-700"
        : "bg-[#F9DADA] text-[#8B2424]";

  return (
    <div
      onClick={onClick}
      className={`rounded-xl border bg-white p-5 shadow-sm transition ${
        onClick ? "cursor-pointer hover:shadow-md" : ""
      } ${
        active
          ? "border-[#8B2424] ring-2 ring-[#F9DADA]"
          : "border-gray-200"
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500">
          {title}
        </p>

        <div
          className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconBg}`}
        >
          ✓
        </div>
      </div>

      <p className={`mt-3 text-3xl font-bold ${numberClass}`}>
        {count}
      </p>
    </div>
  );
}

function TaskSection({
  title,
  count,
  tasks,
  variant = "default",
  onAction,
  onOpenEscalation,
}: {
  title: string;
  count: number;
  tasks: Task[];
  variant?: "default" | "danger" | "success";
  onAction: (task: Task) => void;
  onOpenEscalation: (task: Task) => void;
}) {
  if (!tasks.length) return null;

  const badgeClass =
    variant === "danger"
      ? "bg-[#F9DADA] text-[#A8333B]"
      : variant === "success"
        ? "bg-green-100 text-green-700"
        : "bg-[#F9DADA] text-[#8B2424]";

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-base font-bold text-gray-900">
          {title}
        </h2>

        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass}`}
        >
          {count}
        </span>
      </div>

      <div className="space-y-3">
        {tasks.map((task) => (
          <TaskCard
            key={task._id}
            task={task}
            onAction={() =>
              onAction(task)
            }
            onOpenEscalation={onOpenEscalation}
          />
        ))}
      </div>
    </section>
  );
}

function EmptyState({ message }: { message?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-6 py-16 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#F9DADA] text-xl font-bold text-[#8B2424]">
        ✓
      </div>

      <h3 className="mt-4 text-base font-semibold text-gray-900">
        {message || "No tasks found"}
      </h3>

      <p className="mt-1 text-sm text-gray-500">
        Your assigned tasks will appear here.
      </p>
    </div>
  );
}