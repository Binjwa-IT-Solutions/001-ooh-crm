"use client";

import { useEffect, useState } from "react";
import { getVendorFilters } from "../api";

interface Props {
  search: string;
  status: string;
  state: string;
  city: string;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onStateChange: (value: string) => void;
  onCityChange: (value: string) => void;
}

export default function VendorFilters({
  search,
  status,
  state,
  city,
  onSearchChange,
  onStatusChange,
  onStateChange,
  onCityChange,
}: Props) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [stateOpen, setStateOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);

  const [states, setStates] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);

  const statusOptions = ["Active", "Inactive"];

  /* LOAD STATES / CITIES */
  useEffect(() => {
    getVendorFilters(state)
      .then((response) => {
        const stateData = response.data?.states || [];

        const uniqueStates = Array.from(
          new Set(
            stateData
              .map((item) => item.state)
              .filter(Boolean),
          ),
        );

        setStates(uniqueStates);

        const selectedStateCities = state
          ? stateData.find(
              (item) => item.state === state,
            )?.cities || []
          : response.data?.cities || [];

        const uniqueCities = Array.from(
          new Set(
            selectedStateCities.filter(Boolean),
          ),
        );

        setCities(uniqueCities);
      })
      .catch(() => {
        setStates([]);
        setCities([]);
      });
  }, [state]);

  /* CLEAR CITY WHEN STATE CHANGES */
  function handleStateChange(value: string) {
    onStateChange(value);
    onCityChange("");
    setCityOpen(false);
  }

  return (
    <div className="rounded-2xl border border-[#E8E8EC] bg-white p-5 shadow-sm">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">

        {/* SEARCH */}
        <div className="lg:col-span-2">
          <label className="mb-2 block text-sm font-bold text-[#1F2937]">
            Search Vendor
          </label>

          <input
            type="text"
            value={search}
            onChange={(e) =>
              onSearchChange(e.target.value)
            }
            placeholder="Search vendor, city, contact or GST..."
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-900 placeholder:text-gray-500 outline-none transition focus:border-[#8B2424] focus:ring-2 focus:ring-[#F9DADA]"
          />
        </div>

        {/* STATE */}
        <Dropdown
          label="State"
          value={state}
          placeholder="All States"
          options={states}
          open={stateOpen}
          setOpen={setStateOpen}
          onChange={handleStateChange}
        />

        {/* CITY */}
        <Dropdown
          label="City"
          value={city}
          placeholder="All Cities"
          options={cities}
          open={cityOpen}
          setOpen={setCityOpen}
          onChange={onCityChange}
        />

        {/* STATUS */}
        <Dropdown
          label="Status"
          value={status}
          placeholder="All Status"
          options={statusOptions}
          open={statusOpen}
          setOpen={setStatusOpen}
          onChange={onStatusChange}
        />
      </div>
    </div>
  );
}


/* =========================
   DROPDOWN
========================= */

function Dropdown({
  label,
  value,
  placeholder,
  options,
  open,
  setOpen,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: string[];
  open: boolean;
  setOpen: (value: boolean) => void;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <label className="mb-2 block text-sm font-bold text-[#1F2937]">
        {label}
      </label>

      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-gray-300 bg-white px-4 py-3 text-left text-sm font-medium text-gray-900 outline-none transition hover:border-[#8B2424] focus:border-[#8B2424] focus:ring-2 focus:ring-[#F9DADA]"
      >
        <span>
          {value || placeholder}
        </span>

        <span
          className={`text-gray-500 transition ${
            open ? "rotate-180" : ""
          }`}
        >
          ▾
        </span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1 max-h-60 overflow-y-auto rounded-xl border border-[#E8E8EC] bg-white shadow-lg">

          {/* ALL */}
          <button
            type="button"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className="block w-full cursor-pointer px-4 py-3 text-left text-sm font-medium text-gray-900 transition hover:bg-[#F9DADA] hover:text-[#8B2424]"
          >
            {placeholder}
          </button>

          {/* OPTIONS */}
          {options.map((option, index) => (
            <button
              key={`${label}-${option}-${index}`}
              type="button"
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
              className="block w-full cursor-pointer px-4 py-3 text-left text-sm font-medium text-gray-900 transition hover:bg-[#F9DADA] hover:text-[#8B2424]"
            >
              {option}
            </button>
          ))}

          {/* EMPTY */}
          {!options.length && (
            <p className="px-4 py-3 text-sm text-gray-500">
              No options available
            </p>
          )}
        </div>
      )}
    </div>
  );
}