"use client";

import {
  useMemo,
  useState,
} from "react";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";

import {
  countByLevel,
  getLevelLabel,
  sortEscalations,
} from "../format";

import type {
  Escalation,
  EscalationLevel,
} from "../types";

import { useEscalations } from "../hooks/useEscalations";

import EscalationCard from "./EscalationCard";
import EscalationDetail from "./EscalationDetail";

type LevelFilter =
  | "ALL"
  | EscalationLevel;

export default function EscalationsPage() {
  const {
    escalations,
    loading,
    error,
    reload,
  } = useEscalations();

  const [
    level,
    setLevel,
  ] = useState<LevelFilter>("ALL");

  const [
    selected,
    setSelected,
  ] = useState<Escalation | null>(
    null,
  );

  const counts = useMemo(
    () => countByLevel(escalations),
    [escalations],
  );

  const filtered = useMemo(() => {
    const sorted =
      sortEscalations(escalations);

    if (level === "ALL") {
      return sorted;
    }

    return sorted.filter(
      (item) => item.level === level,
    );
  }, [escalations, level]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#8B2424] to-[#A8333B] text-white shadow-md ring-4 ring-[#F9DADA]">
              <ArrowUpRight className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#8B2424]">
                  SLA Operations
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                  Automated Engine
                </span>
              </div>
              <h1 className="mt-1 text-2xl font-bold text-gray-900">
                Task Escalations
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                Monitor automatically routed task SLA elevations and resolution history.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={reload}
            disabled={loading}
            className="w-fit rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-[#8B2424] hover:bg-[#FFF7F7] hover:text-[#8B2424] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#F9DADA]"
          >
            {loading
              ? "Refreshing..."
              : "Refresh"}
          </button>
        </div>
      </section>

      {/* Summary */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Total Escalations"
          value={escalations.length}
          active={level === "ALL"}
          onClick={() =>
            setLevel("ALL")
          }
        />

        <SummaryCard
          title="L1 Reminders"
          value={counts.L1}
          active={level === "L1"}
          onClick={() => setLevel("L1")}
        />

        <SummaryCard
          title="L2 Manager Alerts"
          value={counts.L2}
          active={level === "L2"}
          onClick={() => setLevel("L2")}
        />

        <SummaryCard
          title="L3 Senior Escalations"
          value={counts.L3}
          active={level === "L3"}
          onClick={() => setLevel("L3")}
        />
      </section>

      {/* Filter */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Escalation History
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              {filtered.length}{" "}
              {filtered.length === 1
                ? "record"
                : "records"}{" "}
              shown
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <FilterButton
              active={level === "ALL"}
              onClick={() =>
                setLevel("ALL")
              }
            >
              All
            </FilterButton>

            <FilterButton
              active={level === "L1"}
              onClick={() =>
                setLevel("L1")
              }
            >
              L1
            </FilterButton>

            <FilterButton
              active={level === "L2"}
              onClick={() =>
                setLevel("L2")
              }
            >
              L2
            </FilterButton>

            <FilterButton
              active={level === "L3"}
              onClick={() =>
                setLevel("L3")
              }
            >
              L3
            </FilterButton>
          </div>
        </div>
      </section>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-800">
            Unable to load escalations
          </p>

          <p className="mt-1 text-sm text-red-700">
            {error}
          </p>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <Loading />
      ) : filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map(
            (escalation) => (
              <EscalationCard
                key={escalation._id}
                escalation={escalation}
                onOpen={setSelected}
              />
            ),
          )}
        </div>
      ) : (
        <EmptyState
          level={level}
        />
      )}

      {selected && (
        <EscalationDetail
          escalation={selected}
          onClose={() =>
            setSelected(null)
          }
        />
      )}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  active,
  onClick,
}: {
  title: string;
  value: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border bg-white p-5 text-left shadow-sm transition ${
        active
          ? "border-[#8B2424] ring-2 ring-[#F9DADA]"
          : "border-gray-200 hover:border-[#8B2424]/40 hover:shadow-md"
      }`}
    >
      <p className="text-sm font-medium text-gray-500">
        {title}
      </p>

      <p className="mt-2 text-3xl font-bold text-gray-900">
        {value}
      </p>

      <p className="mt-2 text-xs font-semibold text-[#8B2424]">
        View records →
      </p>
    </button>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#F9DADA] ${
        active
          ? "bg-[#8B2424] text-white"
          : "border border-gray-300 bg-white text-gray-600 hover:border-[#8B2424] hover:bg-[#FFF7F7] hover:text-[#8B2424]"
      }`}
    >
      {children}
    </button>
  );
}

function Loading() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((item) => (
        <div
          key={item}
          className="animate-pulse rounded-xl border border-gray-200 bg-white p-5"
        >
          <div className="h-5 w-32 rounded bg-gray-200" />

          <div className="mt-4 h-4 w-56 rounded bg-gray-100" />

          <div className="mt-4 h-10 rounded bg-gray-100" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  level,
}: {
  level: LevelFilter;
}) {
  const title =
    level === "ALL"
      ? "All tasks on schedule"
      : `No ${getLevelLabel(
          level,
        )} records`;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-4 ring-emerald-100/60">
        <CheckCircle2 className="h-6 w-6" />
      </div>

      <h3 className="mt-4 text-base font-semibold text-gray-900">
        {title}
      </h3>

      <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
        {level === "ALL"
          ? "No active escalations. Automated routing triggers if tasks breach their SLA deadline windows."
          : `There are currently no tasks in the ${getLevelLabel(level)} tier.`}
      </p>
    </div>
  );
}