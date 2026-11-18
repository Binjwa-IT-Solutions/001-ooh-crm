"use client";

import { useState } from "react";

interface Props {
  search: string;
  status: string;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
}

export default function PurchaseOrderFilters({
  search,
  status,
  onSearchChange,
  onStatusChange,
}: Props) {
  const [open, setOpen] = useState(false);

  const options = [
    "Draft",
    "Issued",
    "Accepted",
    "Cancelled",
  ];

  return (
    <div className="rounded-2xl border border-[#E8E8EC] bg-white p-5 shadow-sm">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

        {/* SEARCH */}

        <div>
          <label className="mb-2 block text-sm font-bold text-[#1F2937]">
            Search Purchase Order
          </label>

          <input
            type="text"
            value={search}
            onChange={(e) =>
              onSearchChange(e.target.value)
            }
            placeholder="Search PO, vendor or campaign..."
            className="
              w-full
              rounded-xl
              border border-gray-300
              bg-white
              px-4 py-3
              text-sm
              text-[#1F2937]
              outline-none
              transition
              focus:border-[#A8333B]
              focus:ring-2
              focus:ring-[#F9DADA]
            "
          />
        </div>

        {/* STATUS */}

        <div className="relative">
          <label className="mb-1.5 block text-sm font-medium text-gray-900">
            Status
          </label>

          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-left text-sm text-gray-900 outline-none transition hover:border-[#8B2424] focus:border-[#8B2424] focus:ring-2 focus:ring-[#F9DADA]"
          >
            <span>
              {status || "All Statuses"}
            </span>

            <span className="text-gray-500">▾</span>
          </button>

          {open && (
            <div className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
              <button
                type="button"
                onClick={() => {
                  onStatusChange("");
                  setOpen(false);
                }}
                className={`block w-full cursor-pointer px-4 py-2.5 text-left text-sm transition hover:bg-[#F9DADA] hover:text-[#8B2424] ${
                  !status
                    ? "bg-[#FFF5F5] font-semibold text-[#8B2424]"
                    : "text-gray-900"
                }`}
              >
                All Statuses
              </button>

              {options.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    onStatusChange(option);
                    setOpen(false);
                  }}
                  className={`block w-full cursor-pointer px-4 py-2.5 text-left text-sm transition hover:bg-[#F9DADA] hover:text-[#8B2424] ${
                    status === option
                      ? "bg-[#FFF5F5] font-semibold text-[#8B2424]"
                      : "text-gray-900"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}