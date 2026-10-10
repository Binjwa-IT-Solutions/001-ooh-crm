"use client";

import type {
  AvailabilityStatus,
  MediaPlanStatus,
  MediaType,
} from "../types";

interface Props {
  search: string;
  state: string;
  city: string;
  vendorName: string;

  mediaType: MediaType | "";
  availability: AvailabilityStatus | "";
  status: MediaPlanStatus | "";

  stateOptions?: string[];
  cityOptions?: string[];
  vendorOptions?: string[];

  onSearchChange: (value: string) => void;
  onStateChange: (value: string) => void;
  onCityChange: (value: string) => void;
  onVendorChange: (value: string) => void;

  onMediaTypeChange: (value: MediaType | "") => void;
  onAvailabilityChange: (
    value: AvailabilityStatus | ""
  ) => void;
  onStatusChange: (
    value: MediaPlanStatus | ""
  ) => void;
}

const MEDIA_TYPES: MediaType[] = [
  "Billboard",
  "Hoarding",
  "Transit",
  "Metro",
  "Airport",
  "Mall",
  "Digital",
  "Other",
];

const AVAILABILITY: AvailabilityStatus[] = [
  "Available",
  "Booked",
];

const STATUSES: MediaPlanStatus[] = [
  "Draft",
  "Pending",
  "Approved",
  "Rejected",
];

const inputClass =
  "w-full rounded-lg border border-[#E8E8EC] bg-white px-3 py-2.5 text-sm text-[#1F2937] outline-none transition placeholder:text-[#98A2B3] focus:border-[#A8383B]";

export default function SiteFilters({
  search,
  state,
  city,
  vendorName,
  mediaType,
  availability,
  status,
  stateOptions = [],
  cityOptions = [],
  vendorOptions = [],
  onSearchChange,
  onStateChange,
  onCityChange,
  onVendorChange,
  onMediaTypeChange,
  onAvailabilityChange,
  onStatusChange,
}: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
      {/* SEARCH */}
      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Media Plan, client, location..."
        className={inputClass}
      />

      {/* STATE */}
      <select
        value={state}
        onChange={(e) => {
          const value = e.target.value;

          onStateChange(value);
          onCityChange("");
        }}
        className={`${inputClass} cursor-pointer`}
      >
        <option value="">All States</option>

        {stateOptions.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>

      {/* CITY */}
      <select
        value={city}
        onChange={(e) =>
          onCityChange(e.target.value)
        }
        disabled={!state}
        className={`${inputClass} cursor-pointer disabled:cursor-not-allowed disabled:bg-[#F9FAFB]`}
      >
        <option value="">
          {state
            ? "All Cities"
            : "Select State First"}
        </option>

        {cityOptions.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>

      {/* VENDOR */}
      <input
        type="text"
        list="vendor-options"
        value={vendorName}
        onChange={(e) =>
          onVendorChange(e.target.value)
        }
        placeholder="Vendor"
        className={inputClass}
      />

      <datalist id="vendor-options">
        {vendorOptions.map((vendor) => (
          <option
            key={vendor}
            value={vendor}
          />
        ))}
      </datalist>

      {/* MEDIA TYPE */}
      <select
        value={mediaType}
        onChange={(e) =>
          onMediaTypeChange(
            e.target.value as MediaType | ""
          )
        }
        className={`${inputClass} cursor-pointer`}
      >
        <option value="">Media Type</option>

        {MEDIA_TYPES.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>

      {/* AVAILABILITY */}
      <select
        value={availability}
        onChange={(e) =>
          onAvailabilityChange(
            e.target.value as
              | AvailabilityStatus
              | ""
          )
        }
        className={`${inputClass} cursor-pointer`}
      >
        <option value="">Availability</option>

        {AVAILABILITY.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>

      {/* STATUS */}
      <select
        value={status}
        onChange={(e) =>
          onStatusChange(
            e.target.value as
              | MediaPlanStatus
              | ""
          )
        }
        className={`${inputClass} cursor-pointer`}
      >
        <option value="">Status</option>

        {STATUSES.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </div>
  );
}