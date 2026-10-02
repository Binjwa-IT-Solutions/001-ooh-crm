"use client";

import type { ProofFilters as Filters } from "../types";

interface Props {
  filters: Filters;
  onChange: (
    key: keyof Filters,
    value: string
  ) => void;
  onClear: () => void;
}

export default function ProofFilters({
  filters,
  onChange,
  onClear,
}: Props) {
  return (
    <div className="rounded-xl border border-[#F9DADA] bg-white p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">

        <input
          value={filters.uploadedBy}
          onChange={(e) =>
            onChange(
              "uploadedBy",
              e.target.value
            )
          }
          placeholder="Search agent"
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#A8333B]"
        />

        <select
          value={filters.status}
          onChange={(e) =>
            onChange(
              "status",
              e.target.value
            )
          }
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#A8333B]"
        >
          <option value="">
            All Status
          </option>

          <option value="Pending">
            Pending
          </option>

          <option value="Approved">
            Approved
          </option>

          <option value="Rejected">
            Rejected
          </option>
        </select>

        <button
          type="button"
          onClick={onClear}
          className="rounded-lg border border-[#A8333B] px-4 py-2 text-sm font-medium text-[#8B2424] hover:bg-[#F9DADA]"
        >
          Clear Filters
        </button>
      </div>
    </div>
  );
}