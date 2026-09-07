"use client";

import { useEffect, useRef, useState } from "react";
import { getCampaignManagers } from "../api";
import type { ManagerOption } from "../types";

interface Props {
  filters: {
    search?: string;
    status?: string;
    city?: string;
    manager?: string;
    startDate?: string;
    endDate?: string;
  };
  onChange: (filters: Props["filters"]) => void;
  onReset: () => void;
}

const statusOptions = [
  "Draft",
  "Approved",
  "InProgress",
  "Completed",
  "Cancelled",
];

export default function CampaignFilters({
  filters,
  onChange,
  onReset,
}: Props) {
  const [statusOpen, setStatusOpen] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);

  const [managerOpen, setManagerOpen] = useState(false);
  const managerRef = useRef<HTMLDivElement>(null);
  const [managers, setManagers] = useState<ManagerOption[]>([]);

  useEffect(() => {
    let mounted = true;
    getCampaignManagers()
      .then((res) => {
        if (mounted && res.data) {
          setManagers(res.data);
        }
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        statusRef.current &&
        !statusRef.current.contains(event.target as Node)
      ) {
        setStatusOpen(false);
      }
      if (
        managerRef.current &&
        !managerRef.current.contains(event.target as Node)
      ) {
        setManagerOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  const selectedManager = managers.find((m) => m._id === filters.manager);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            Campaign Filters & Search
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Search by name, code, lead, manager, city or filter by status and date range.
          </p>
        </div>

        <button
          type="button"
          onClick={onReset}
          className="rounded-lg px-3 py-2 text-sm font-medium text-[#8B2424] transition hover:bg-[#F9DADA]"
        >
          Reset All
        </button>
      </div>

      {/* SEARCH BAR */}
      <div className="mb-4">
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </span>

          <input
            type="text"
            value={filters.search ?? ""}
            onChange={(event) =>
              onChange({
                ...filters,
                search: event.target.value,
              })
            }
            placeholder="Search campaigns by name, code, lead / client, manager, city..."
            className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-10 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition hover:border-[#8B2424] focus:border-[#8B2424] focus:ring-2 focus:ring-[#F9DADA]"
          />

          {filters.search && (
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...filters,
                  search: "",
                })
              }
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-sm text-gray-400 hover:text-gray-600"
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Filters Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        {/* Status */}
        <div ref={statusRef} className="relative">
          <label className="mb-1.5 block text-sm font-medium text-gray-900">
            Status
          </label>

          <button
            type="button"
            onClick={() => setStatusOpen(!statusOpen)}
            className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-left text-gray-900 outline-none transition hover:border-[#8B2424] focus:border-[#8B2424] focus:ring-2 focus:ring-[#F9DADA]"
          >
            <span>
              {filters.status
                ? filters.status === "InProgress"
                  ? "In Progress"
                  : filters.status
                : "All Statuses"}
            </span>

            <span className="text-gray-500">▾</span>
          </button>

          {statusOpen && (
            <div className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
              <button
                type="button"
                onClick={() => {
                  onChange({
                    ...filters,
                    status: "",
                  });
                  setStatusOpen(false);
                }}
                className="block w-full cursor-pointer px-4 py-2.5 text-left text-gray-900 transition hover:bg-[#F9DADA] hover:text-[#8B2424]"
              >
                All Statuses
              </button>

              {statusOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    onChange({
                      ...filters,
                      status: option,
                    });
                    setStatusOpen(false);
                  }}
                  className="block w-full cursor-pointer px-4 py-2.5 text-left text-gray-900 transition hover:bg-[#F9DADA] hover:text-[#8B2424]"
                >
                  {option === "InProgress" ? "In Progress" : option}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Manager Filter */}
        <div ref={managerRef} className="relative">
          <label className="mb-1.5 block text-sm font-medium text-gray-900">
            Manager
          </label>

          <button
            type="button"
            onClick={() => setManagerOpen(!managerOpen)}
            className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-left text-gray-900 outline-none transition hover:border-[#8B2424] focus:border-[#8B2424] focus:ring-2 focus:ring-[#F9DADA]"
          >
            <span className="truncate">
              {selectedManager ? selectedManager.name : filters.manager || "All Managers"}
            </span>

            <span className="text-gray-500">▾</span>
          </button>

          {managerOpen && (
            <div className="absolute left-0 right-0 z-20 mt-1 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
              <button
                type="button"
                onClick={() => {
                  onChange({
                    ...filters,
                    manager: "",
                  });
                  setManagerOpen(false);
                }}
                className="block w-full cursor-pointer px-4 py-2.5 text-left text-gray-900 transition hover:bg-[#F9DADA] hover:text-[#8B2424]"
              >
                All Managers
              </button>

              {managers.map((m) => (
                <button
                  key={m._id}
                  type="button"
                  onClick={() => {
                    onChange({
                      ...filters,
                      manager: m._id,
                    });
                    setManagerOpen(false);
                  }}
                  className={`block w-full cursor-pointer px-4 py-2.5 text-left text-sm transition hover:bg-[#F9DADA] hover:text-[#8B2424] ${
                    filters.manager === m._id
                      ? "bg-[#FFF5F5] font-semibold text-[#8B2424]"
                      : "text-gray-900"
                  }`}
                >
                  {m.name} {m.role ? `(${m.role})` : ""}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* City */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-900">
            City
          </label>

          <input
            type="text"
            value={filters.city ?? ""}
            onChange={(event) =>
              onChange({
                ...filters,
                city: event.target.value,
              })
            }
            placeholder="Enter city"
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder:text-gray-500 outline-none transition hover:border-[#8B2424] focus:border-[#8B2424] focus:ring-2 focus:ring-[#F9DADA]"
          />
        </div>

        {/* Start Date */}
        <CustomDatePicker
          label="Start Date"
          value={filters.startDate ?? ""}
          onChange={(value) =>
            onChange({
              ...filters,
              startDate: value,
            })
          }
        />

        {/* End Date */}
        <CustomDatePicker
          label="End Date"
          value={filters.endDate ?? ""}
          onChange={(value) =>
            onChange({
              ...filters,
              endDate: value,
            })
          }
        />
      </div>
    </div>
  );
}

/* =========================
   Custom Date Picker
========================= */

function CustomDatePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const [date, setDate] = useState(
    value ? new Date(`${value}T00:00:00`) : new Date(),
  );

  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) {
      setDate(new Date(`${value}T00:00:00`));
    }
  }, [value]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  const year = date.getFullYear();
  const month = date.getMonth();

  const daysInMonth = new Date(
    year,
    month + 1,
    0,
  ).getDate();

  const firstDay = new Date(
    year,
    month,
    1,
  ).getDay();

  const formatDate = (day: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const selectDate = (day: number) => {
    const newDate = new Date(year, month, day);

    setDate(newDate);
    onChange(formatDate(day));
    setOpen(false);
  };

  return (
    <div ref={pickerRef} className="relative">
      <label className="mb-1.5 block text-sm font-medium text-gray-900">
        {label}
      </label>

      {/* Date Button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-left text-gray-900 outline-none transition hover:border-[#8B2424] focus:border-[#8B2424] focus:ring-2 focus:ring-[#F9DADA]"
      >
        <span className={value ? "text-gray-900" : "text-gray-500"}>
          {value || "Select date"}
        </span>

        <span className="text-[#8B2424]">📅</span>
      </button>

      {/* Calendar */}
      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-[240px] rounded-xl border border-gray-200 bg-white p-2.5 shadow-xl">
          {/* Month Navigation */}
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() =>
                setDate(new Date(year, month - 1, 1))
              }
              className="rounded-lg px-2 py-1 text-sm text-[#8B2424] transition hover:bg-[#F9DADA]"
            >
              ‹
            </button>

            <span className="text-xs font-bold text-gray-900">
              {date.toLocaleString("en-IN", {
                month: "long",
                year: "numeric",
              })}
            </span>

            <button
              type="button"
              onClick={() =>
                setDate(new Date(year, month + 1, 1))
              }
              className="rounded-lg px-2 py-1 text-sm text-[#8B2424] transition hover:bg-[#F9DADA]"
            >
              ›
            </button>
          </div>

          {/* Week Days */}
          <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold text-gray-500">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(
              (day) => (
                <span key={day}>{day}</span>
              ),
            )}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: firstDay }).map((_, index) => (
              <span key={`empty-${index}`} className="h-7" />
            ))}

            {Array.from(
              { length: daysInMonth },
              (_, index) => index + 1,
            ).map((day) => {
              const selected = value === formatDate(day);

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDate(day)}
                  className={`h-7 rounded-md text-xs font-medium transition ${
                    selected
                      ? "bg-[#8B2424] text-[#F9DADA]"
                      : "text-gray-700 hover:bg-[#F9DADA] hover:text-[#8B2424]"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}