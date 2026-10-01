"use client";

interface VendorFiltersProps {
  search: string;
  state: string;
  city: string;
  status: string;
  registrationStatus: string;

  states: string[];
  cities: string[];

  onSearchChange: (value: string) => void;
  onStateChange: (value: string) => void;
  onCityChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onRegistrationStatusChange: (value: string) => void;
}

export default function VendorFilters({
  search,
  state,
  city,
  status,
  registrationStatus,
  states,
  cities,
  onSearchChange,
  onStateChange,
  onCityChange,
  onStatusChange,
  onRegistrationStatusChange,
}: VendorFiltersProps) {
  return (
    <div className="rounded-2xl border border-[#E8E8EC] bg-white p-5 shadow-sm">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">

        {/* Search */}
        <div>
          <label className="mb-2 block text-sm font-semibold text-[#101828]">
            Search Vendor
          </label>

          <input
            type="text"
            value={search}
            onChange={(e) =>
              onSearchChange(e.target.value)
            }
            placeholder="Search vendor, city, contact or GST..."
            className="h-[51px] w-full rounded-xl border border-[#D0D5DD] bg-white px-4 text-sm text-[#344054] outline-none placeholder:text-[#667085] focus:border-[#8B2424] focus:ring-2 focus:ring-[#F9DADA]"
          />
        </div>

        {/* State */}
        <div>
          <label className="mb-2 block text-sm font-semibold text-[#101828]">
            State
          </label>

          <select
            value={state}
            onChange={(e) =>
              onStateChange(e.target.value)
            }
            className="h-[51px] w-full rounded-xl border border-[#D0D5DD] bg-white px-4 text-sm text-[#101828] outline-none focus:border-[#8B2424] focus:ring-2 focus:ring-[#F9DADA]"
          >
            <option value="">All States</option>

            {states.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        {/* City */}
        <div>
          <label className="mb-2 block text-sm font-semibold text-[#101828]">
            City
          </label>

          <select
            value={city}
            onChange={(e) =>
              onCityChange(e.target.value)
            }
            className="h-[51px] w-full rounded-xl border border-[#D0D5DD] bg-white px-4 text-sm text-[#101828] outline-none focus:border-[#8B2424] focus:ring-2 focus:ring-[#F9DADA]"
          >
            <option value="">Select State First</option>

            {cities.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
/* =========================
   DROPDOWN

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
      <label className="mb-1.5 block text-sm font-medium text-gray-900">
        {label}
      </label>

      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-left text-sm text-gray-900 outline-none transition hover:border-[#8B2424] focus:border-[#8B2424] focus:ring-2 focus:ring-[#F9DADA]"
      >
        <span className="truncate mr-2">
          {value || placeholder}
        </span>

        <span className="text-gray-500 shrink-0 select-none">
          ▾
        </span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1 max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">

          {/* ALL */}
          <button
            type="button"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className={`block w-full cursor-pointer px-4 py-2.5 text-left text-sm transition hover:bg-[#F9DADA] hover:text-[#8B2424] ${
              !value
                ? "bg-[#FFF5F5] font-semibold text-[#8B2424]"
                : "text-gray-900"
            }`}
          >
            {placeholder}
          </button>

          {/* OPTIONS */}
          {options.map((option, index) => {
            const isSelected = value === option;
            return (
              <button
                key={`${label}-${option}-${index}`}
                type="button"
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
                className={`block w-full cursor-pointer px-4 py-2.5 text-left text-sm transition hover:bg-[#F9DADA] hover:text-[#8B2424] ${
                  isSelected
                    ? "bg-[#FFF5F5] font-semibold text-[#8B2424]"
                    : "text-gray-900"
                }`}
              >
                {option}
              </button>
            );
          })}

          {/* EMPTY */}
          {!options.length && (
            <p className="px-4 py-2.5 text-sm text-gray-500">
              No options available
            </p>
          )}
        </div>

        {/* Status */}
        <div>
          <label className="mb-2 block text-sm font-semibold text-[#101828]">
            Status
          </label>

          <select
            value={status}
            onChange={(e) =>
              onStatusChange(e.target.value)
            }
            className="h-[51px] w-full rounded-xl border border-[#D0D5DD] bg-white px-4 text-sm text-[#101828] outline-none focus:border-[#8B2424] focus:ring-2 focus:ring-[#F9DADA]"
          >
            <option value="">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Blacklist">Blacklist</option>
          </select>
        </div>

        {/* Registration */}
        <div>
          <label className="mb-2 block text-sm font-semibold text-[#101828]">
            Registration
          </label>

          <select
            value={registrationStatus}
            onChange={(e) =>
              onRegistrationStatusChange(
                e.target.value
              )
            }
            className="h-[51px] w-full rounded-xl border border-[#D0D5DD] bg-white px-4 text-sm text-[#101828] outline-none focus:border-[#8B2424] focus:ring-2 focus:ring-[#F9DADA]"
          >
            <option value="">
              All Registration
            </option>
            <option value="Registered">
              Registered
            </option>
            <option value="Unregistered">
              Unregistered
            </option>
            <option value="Pending">
              Pending
            </option>
          </select>
        </div>

      </div>
    </div>
  );
}