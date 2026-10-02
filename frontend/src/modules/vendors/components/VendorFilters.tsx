'use client';

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
          <label className="mb-2 block text-sm font-semibold text-[#101828]">Search Vendor</label>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search vendor, city, contact or GST..."
            className="h-[51px] w-full rounded-xl border border-[#D0D5DD] bg-white px-4 text-sm text-[#344054] outline-none placeholder:text-[#667085] focus:border-[#8B2424] focus:ring-2 focus:ring-[#F9DADA]"
          />
        </div>

        {/* State */}
        <div>
          <label className="mb-2 block text-sm font-semibold text-[#101828]">State</label>
          <select
            value={state}
            onChange={(e) => onStateChange(e.target.value)}
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
          <label className="mb-2 block text-sm font-semibold text-[#101828]">City</label>
          <select
            value={city}
            onChange={(e) => onCityChange(e.target.value)}
            className="h-[51px] w-full rounded-xl border border-[#D0D5DD] bg-white px-4 text-sm text-[#101828] outline-none focus:border-[#8B2424] focus:ring-2 focus:ring-[#F9DADA]"
          >
            <option value="">Select State First</option>
            {cities.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div>
          <label className="mb-2 block text-sm font-semibold text-[#101828]">Status</label>
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
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
          <label className="mb-2 block text-sm font-semibold text-[#101828]">Registration</label>
          <select
            value={registrationStatus}
            onChange={(e) => onRegistrationStatusChange(e.target.value)}
            className="h-[51px] w-full rounded-xl border border-[#D0D5DD] bg-white px-4 text-sm text-[#101828] outline-none focus:border-[#8B2424] focus:ring-2 focus:ring-[#F9DADA]"
          >
            <option value="">All Registration</option>
            <option value="Registered">Registered</option>
            <option value="Unregistered">Unregistered</option>
            <option value="Pending">Pending</option>
          </select>
        </div>
      </div>
    </div>
  );
}
