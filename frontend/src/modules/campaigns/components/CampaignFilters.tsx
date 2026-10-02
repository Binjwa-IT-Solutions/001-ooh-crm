"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getCampaignManagers } from "../api";
import type { ManagerOption } from "../types";

interface Props {
  filters: {
    search?: string;
    status?: string;
    manager?: string;
    state?: string;
    city?: string;
    startDate?: string;
    endDate?: string;
  };
  stateOptions?: string[];
  cityOptions?: string[];
  onChange: (filters: Props["filters"]) => void;
  onReset: () => void;
}

const STATUS_OPTIONS = [
  { label: "Draft", value: "Draft" },
  { label: "Campaign Live", value: "Campaign Live" },
  { label: "Campaign End", value: "Campaign End" },
  { label: "Campaign Rejected", value: "Rejected" },
];

export default function CampaignFilters({
  filters,
  stateOptions = [],
  cityOptions = [],
  onChange,
  onReset,
}: Props) {
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

  const selectedManager = managers.find((m) => m._id === filters.manager);

  const managerOptions = useMemo(() => {
    return managers.map((m) => ({
      label: m.name,
      value: m._id,
      sublabel: m.role ? `(${m.role})` : undefined,
    }));
  }, [managers]);

  const stateDropdownOptions = useMemo(() => {
    return stateOptions.map((s) => ({
      label: s,
      value: s,
    }));
  }, [stateOptions]);

  const cityDropdownOptions = useMemo(() => {
    return cityOptions.map((c) => ({
      label: c,
      value: c,
    }));
  }, [cityOptions]);

  const statusDropdownOptions = useMemo(() => {
    return STATUS_OPTIONS.map((st) => ({
      label: st.label,
      value: st.value,
    }));
  }, []);

  const statusDisplayValue = useMemo(() => {
    if (!filters.status) return "All Statuses";
    const found = STATUS_OPTIONS.find((s) => s.value === filters.status);
    return found ? found.label : filters.status;
  }, [filters.status]);

  const handleStateChange = (nextState: string) => {
    onChange({
      ...filters,
      state: nextState,
      city: "", // Reset city when state changes, matching ATR
    });
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            Campaign Filters & Search
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Search by name, code, lead, manager, state, city or filter by status.
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
            placeholder="Search campaigns by name, code, lead / client, manager, state, city..."
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

      {/* Filters Grid: Status, Manager, State, City */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. Status Filter */}
        <SearchableFilterDropdown
          label="Status"
          value={filters.status ?? ""}
          displayValue={statusDisplayValue}
          allOptionLabel="All Statuses"
          searchable={false}
          options={statusDropdownOptions}
          onChange={(val) =>
            onChange({
              ...filters,
              status: val,
            })
          }
        />

        {/* 2. Manager Filter */}
        <SearchableFilterDropdown
          label="Manager"
          value={filters.manager ?? ""}
          displayValue={selectedManager ? selectedManager.name : (filters.manager || "All Managers")}
          allOptionLabel="All Managers"
          searchPlaceholder="Search manager..."
          emptyMessage="No managers found"
          options={managerOptions}
          onChange={(val) =>
            onChange({
              ...filters,
              manager: val,
            })
          }
        />

        {/* 3. State Filter */}
        <SearchableFilterDropdown
          label="State"
          value={filters.state ?? ""}
          displayValue={filters.state || "All States"}
          allOptionLabel="All States"
          searchPlaceholder="Search state..."
          emptyMessage="No states found in campaigns"
          options={stateDropdownOptions}
          onChange={handleStateChange}
        />

        {/* 4. City Filter (Dependent on State!) */}
        <SearchableFilterDropdown
          label="City"
          value={filters.city ?? ""}
          displayValue={filters.city || "All Cities"}
          allOptionLabel="All Cities"
          disabled={!filters.state}
          disabledPlaceholder="Select State First"
          searchPlaceholder="Search city..."
          emptyMessage={
            filters.state
              ? "No cities found for selected state"
              : "Select State First"
          }
          options={cityDropdownOptions}
          onChange={(val) =>
            onChange({
              ...filters,
              city: val,
            })
          }
        />
      </div>
    </div>
  );
}

/* ========================================================================== */
/* Reusable Searchable Dropdown for Filters                                  */
/* ========================================================================== */

interface DropdownOption {
  label: string;
  value: string;
  sublabel?: string;
}

interface SearchableFilterDropdownProps {
  label: string;
  value: string;
  displayValue: string;
  allOptionLabel: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  disabledPlaceholder?: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
}

function SearchableFilterDropdown({
  label,
  value,
  displayValue,
  allOptionLabel,
  searchable = true,
  searchPlaceholder = "Search...",
  emptyMessage = "No options available",
  disabled = false,
  disabledPlaceholder = "Select option",
  options,
  onChange,
}: SearchableFilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
        setSearch("");
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setSearch("");
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (open && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [open]);

  // If disabled while open, close it
  useEffect(() => {
    if (disabled && open) {
      setOpen(false);
      setSearch("");
    }
  }, [disabled, open]);

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const term = search.toLowerCase().trim();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(term) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(term))
    );
  }, [options, search]);

  const hasSelectedValue = Boolean(value);

  return (
    <div ref={dropdownRef} className="relative">
      <label className="mb-1.5 block text-sm font-medium text-gray-900">
        {label}
      </label>

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setOpen((prev) => !prev);
            setSearch("");
          }
        }}
        className={`flex w-full items-center justify-between rounded-lg border px-4 py-2.5 text-left text-sm outline-none transition ${
          disabled
            ? "cursor-not-allowed border-gray-200 bg-[#F9FAFB] text-gray-400"
            : hasSelectedValue
              ? "cursor-pointer border-[#8B2424] bg-white font-medium text-gray-900 hover:border-[#8B2424] focus:border-[#8B2424] focus:ring-2 focus:ring-[#F9DADA]"
              : "cursor-pointer border-gray-300 bg-white text-gray-700 hover:border-[#8B2424] focus:border-[#8B2424] focus:ring-2 focus:ring-[#F9DADA]"
        }`}
      >
        <span className="truncate pr-2">
          {disabled ? disabledPlaceholder : displayValue}
        </span>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {!disabled && hasSelectedValue && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
                setOpen(false);
                setSearch("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  onChange("");
                  setOpen(false);
                  setSearch("");
                }
              }}
              className="flex h-4 w-4 items-center justify-center rounded-full text-xs text-gray-400 hover:bg-gray-200 hover:text-gray-700"
              title="Clear"
            >
              ✕
            </span>
          )}

          <span
            className={`text-xs transition-transform duration-200 ${
              disabled ? "text-gray-300" : "text-gray-500"
            } ${open ? "rotate-180" : ""}`}
          >
            ▾
          </span>
        </div>
      </button>

      {/* Dropdown Menu */}
      {!disabled && open && (
        <div className="absolute left-0 right-0 z-30 mt-1 max-h-64 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          {/* Search Input */}
          {searchable && (
            <div className="sticky top-0 z-10 border-b border-gray-100 bg-gray-50/90 p-2 backdrop-blur-sm">
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-xs text-gray-400">
                  🔍
                </span>

                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full rounded-md border border-gray-200 bg-white py-1.5 pl-8 pr-7 text-xs text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-[#8B2424] focus:ring-1 focus:ring-[#8B2424]"
                  onClick={(e) => e.stopPropagation()}
                />

                {search && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSearch("");
                      searchInputRef.current?.focus();
                    }}
                    className="absolute inset-y-0 right-0 flex items-center pr-2 text-xs text-gray-400 hover:text-gray-600"
                    title="Clear search text"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Options List */}
          <div className="max-h-52 overflow-y-auto divide-y divide-gray-50">
            {/* "All" Option */}
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
                setSearch("");
              }}
              className={`block w-full cursor-pointer px-4 py-2.5 text-left text-xs transition ${
                !hasSelectedValue
                  ? "bg-[#FFF5F5] font-semibold text-[#8B2424]"
                  : "text-gray-900 hover:bg-[#F9DADA] hover:text-[#8B2424]"
              }`}
            >
              {allOptionLabel}
            </button>

            {/* Filtered Options */}
            {filteredOptions.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={`block w-full cursor-pointer px-4 py-2.5 text-left text-xs transition ${
                    isSelected
                      ? "bg-[#FFF5F5] font-semibold text-[#8B2424]"
                      : "text-gray-900 hover:bg-[#F9DADA] hover:text-[#8B2424]"
                  }`}
                >
                  <span className="font-medium">{opt.label}</span>
                  {opt.sublabel && (
                    <span className="ml-1.5 text-gray-400 text-[11px]">
                      {opt.sublabel}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Empty States */}
            {options.length === 0 && (
              <div className="px-4 py-3 text-center text-xs text-gray-500">
                {emptyMessage}
              </div>
            )}

            {options.length > 0 && filteredOptions.length === 0 && (
              <div className="px-4 py-3 text-center text-xs text-gray-500">
                No matching options found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}