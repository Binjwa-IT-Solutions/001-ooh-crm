"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  status: string;
  type: string;
  onStatusChange: (value: string) => void;
  onTypeChange: (value: string) => void;
}

const statusOptions = [
  { value: "", label: "All Statuses" },
  { value: "Pending", label: "Pending" },
  { value: "InProgress", label: "In Progress" },
  { value: "Completed", label: "Completed" },
  { value: "Overdue", label: "Overdue" },
];

const typeOptions = [
  { value: "", label: "All Task Types" },
  { value: "Printing", label: "Printing" },
  { value: "Installation", label: "Installation" },
  { value: "Verification", label: "Verification" },
  { value: "Removal", label: "Removal" },
  { value: "Custom", label: "Custom" },
];

export default function TaskFilters({
  status,
  type,
  onStatusChange,
  onTypeChange,
}: Props) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-gray-900">
          Task Filters
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          Filter tasks by status and task type.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Dropdown
          label="Status"
          value={status}
          options={statusOptions}
          onChange={onStatusChange}
        />

        <Dropdown
          label="Task Type"
          value={type}
          options={typeOptions}
          onChange={onTypeChange}
        />
      </div>
    </div>
  );
}

function Dropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: {
    value: string;
    label: string;
  }[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected =
    options.find((option) => option.value === value) ??
    options[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        ref.current &&
        !ref.current.contains(
          event.target as Node,
        )
      ) {
        setOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleClickOutside,
    );

    return () =>
      document.removeEventListener(
        "mousedown",
        handleClickOutside,
      );
  }, []);

  return (
    <div ref={ref} className="relative">
      <label className="mb-1.5 block text-sm font-medium text-gray-900">
        {label}
      </label>

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`flex w-full cursor-pointer items-center justify-between rounded-lg border bg-white px-4 py-2.5 text-left text-sm text-gray-900 outline-none transition ${
          open
            ? "border-[#8B2424] ring-2 ring-[#F9DADA]"
            : "border-gray-300 hover:border-[#8B2424]"
        }`}
      >
        <span className="truncate mr-2">{selected.label}</span>

        <span className="text-gray-500 shrink-0 select-none">▾</span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-40 mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          {options.map((option) => {
            const active = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`block w-full cursor-pointer px-4 py-2.5 text-left text-sm transition hover:bg-[#F9DADA] hover:text-[#8B2424] ${
                  active
                    ? "bg-[#FFF5F5] font-semibold text-[#8B2424]"
                    : "text-gray-900"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}