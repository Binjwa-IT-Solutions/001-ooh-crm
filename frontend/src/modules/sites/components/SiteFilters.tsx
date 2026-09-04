"use client";

import { useState } from "react";

import type {
  SiteStatus,
  SiteType,
} from "../types";

interface SiteFiltersProps {
  city: string;
  type: SiteType | "";
  status: SiteStatus | "";
  onCityChange: (value: string) => void;
  onTypeChange: (value: SiteType | "") => void;
  onStatusChange: (value: SiteStatus | "") => void;
}

const TYPES: SiteType[] = [
  "Airport",
  "Highway",
  "Mall",
  "Metro",
  "Market",
  "Other",
];

const STATUSES: SiteStatus[] = [
  "Active",
  "Maintenance",
  "Inactive",
];

export default function SiteFilters({
  city,
  type,
  status,
  onCityChange,
  onTypeChange,
  onStatusChange,
}: SiteFiltersProps) {
  const [typeOpen, setTypeOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  return (
    <div className="rounded-xl border border-[#E8E8EC] bg-white p-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

        {/* City */}
        <div>
          <label className="mb-2 block text-sm font-medium text-[#1F2937]">
            City
          </label>

          <input
            type="text"
            value={city}
            onChange={(e) =>
              onCityChange(e.target.value)
            }
            placeholder="Search city..."
            className="w-full rounded-lg border border-[#E8E8EC] px-3 py-2.5 text-sm text-[#1F2937] outline-none placeholder:text-[#98A2B3] transition focus:border-[#A8383B] focus:ring-1 focus:ring-[#A8383B]"
          />
        </div>

        {/* Type */}
        <div className="relative">
          <label className="mb-2 block text-sm font-medium text-[#1F2937]">
            Type
          </label>

          <button
            type="button"
            onClick={() => {
              setTypeOpen(!typeOpen);
              setStatusOpen(false);
            }}
            className="flex w-full items-center justify-between rounded-lg border border-[#E8E8EC] bg-white px-3 py-2.5 text-sm text-[#1F2937] outline-none transition hover:border-[#A8383B] focus:border-[#A8383B]"
          >
            <span>{type || "All Types"}</span>

            <span className="text-[#667085]">
              {typeOpen ? "⌃" : "⌄"}
            </span>
          </button>

          {typeOpen && (
            <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-[#E8E8EC] bg-white shadow-lg">
              <button
                type="button"
                onClick={() => {
                  onTypeChange("");
                  setTypeOpen(false);
                }}
                className="w-full px-3 py-2.5 text-left text-sm text-[#1F2937] transition hover:bg-[#F9DADA] hover:text-[#A8383B]"
              >
                All Types
              </button>

              {TYPES.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    onTypeChange(item);
                    setTypeOpen(false);
                  }}
                  className="w-full px-3 py-2.5 text-left text-sm text-[#1F2937] transition hover:bg-[#F9DADA] hover:text-[#A8383B]"
                >
                  {item}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Status */}
        <div className="relative">
          <label className="mb-2 block text-sm font-medium text-[#1F2937]">
            Status
          </label>

          <button
            type="button"
            onClick={() => {
              setStatusOpen(!statusOpen);
              setTypeOpen(false);
            }}
            className="flex w-full items-center justify-between rounded-lg border border-[#E8E8EC] bg-white px-3 py-2.5 text-sm text-[#1F2937] outline-none transition hover:border-[#A8383B] focus:border-[#A8383B]"
          >
            <span>{status || "All Status"}</span>

            <span className="text-[#667085]">
              {statusOpen ? "⌃" : "⌄"}
            </span>
          </button>

          {statusOpen && (
            <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-[#E8E8EC] bg-white shadow-lg">
              <button
                type="button"
                onClick={() => {
                  onStatusChange("");
                  setStatusOpen(false);
                }}
                className="w-full px-3 py-2.5 text-left text-sm text-[#1F2937] transition hover:bg-[#F9DADA] hover:text-[#A8383B]"
              >
                All Status
              </button>

              {STATUSES.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    onStatusChange(item);
                    setStatusOpen(false);
                  }}
                  className="w-full px-3 py-2.5 text-left text-sm text-[#1F2937] transition hover:bg-[#F9DADA] hover:text-[#A8383B]"
                >
                  {item}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}