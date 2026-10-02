'use client';

import { useEffect, useState } from 'react';

import type {
  AvailabilityStatus,
  CreateSiteData,
  MediaPlanStatus,
  MediaType,
  Site,
} from '../types';
import { DatePicker } from '@/shared/ui';

interface SiteFormProps {
  site: Site | null;
  onClose: () => void;
  onSuccess: () => void;
  onSubmit: (data: CreateSiteData) => Promise<void>;
}

const MEDIA_TYPES: MediaType[] = [
  'Billboard',
  'Hoarding',
  'Transit',
  'Metro',
  'Airport',
  'Mall',
  'Digital',
  'Other',
];

const AVAILABILITY_OPTIONS: AvailabilityStatus[] = ['Available', 'Booked'];

const STATUS_OPTIONS: MediaPlanStatus[] = ['Draft', 'Pending', 'Approved', 'Rejected'];

const inputClass =
  'w-full rounded-lg border border-[#E8E8EC] bg-white px-3 py-2.5 text-sm text-[#1F2937] outline-none transition focus:border-[#8B2424] focus:ring-1 focus:ring-[#8B2424]';

const selectClass =
  'w-full rounded-lg border border-[#E8E8EC] bg-white px-3 py-2.5 text-sm text-[#1F2937] outline-none transition focus:border-[#8B2424] focus:ring-1 focus:ring-[#8B2424]';

function today() {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function toInputDate(value?: string) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function calculateDuration(start: string, end: string) {
  if (!start || !end) return 0;

  const startDate = new Date(start);
  const endDate = new Date(end);

  const diff = endDate.getTime() - startDate.getTime();

  if (diff < 0) return 0;

  return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
}

export default function SiteForm({ site, onClose, onSuccess, onSubmit }: SiteFormProps) {
  /* =========================
     FORM STATE
  ========================= */

  const [clientName, setClientName] = useState('');

  const [salesPersonName, setSalesPersonName] = useState('');

  const [salesPersonContact, setSalesPersonContact] = useState('');

  const [vendorName, setVendorName] = useState('');

  const [state, setState] = useState('');

  const [city, setCity] = useState('');

  const [location, setLocation] = useState('');

  const [mediaType, setMediaType] = useState<MediaType>('Billboard');

  const [typeOpen, setTypeOpen] = useState(false);

  const [statusOpen, setStatusOpen] = useState(false);

  const [quantity, setQuantity] = useState(1);

  const [startDate, setStartDate] = useState('');

  const [endDate, setEndDate] = useState('');

  const [duration, setDuration] = useState(0);

  const [availability, setAvailability] = useState<AvailabilityStatus>('Available');

  const [status, setStatus] = useState<MediaPlanStatus>('Draft');

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState('');

  /* =========================
     EDIT DATA
  ========================= */

  useEffect(() => {
    if (!site) {
      setClientName('');
      setSalesPersonName('');
      setSalesPersonContact('');
      setVendorName('');
      setState('');
      setCity('');
      setLocation('');
      setMediaType('Billboard');
      setQuantity(1);
      setStartDate(today());
      setEndDate(today());
      setDuration(1);
      setAvailability('Available');
      setStatus('Draft');
      setError('');

      return;
    }

    setClientName(site.clientName || '');

    setSalesPersonName(site.salesPersonName || '');

    setSalesPersonContact(site.salesPersonContact || '');

    setVendorName(site.vendorName || '');

    setState(site.state || '');

    setCity(site.city || '');

    setLocation(site.location || '');

    setMediaType(site.mediaType || 'Billboard');

    setQuantity(site.quantity || 1);

    const start = toInputDate(site.startDate);

    const end = toInputDate(site.endDate);

    setStartDate(start);
    setEndDate(end);

    setDuration(site.duration || calculateDuration(start, end));

    setAvailability(site.availability || 'Available');

    setStatus(site.status || 'Draft');

    setError('');
  }, [site]);

  /* =========================
     DATE CHANGE
  ========================= */

  function handleStartDateChange(value: string) {
    setStartDate(value);

    const calculated = calculateDuration(value, endDate);

    if (calculated > 0) {
      setDuration(calculated);
    }
  }

  function handleEndDateChange(value: string) {
    setEndDate(value);

    const calculated = calculateDuration(startDate, value);

    if (calculated > 0) {
      setDuration(calculated);
    }
  }

  /* =========================
     MOBILE
  ========================= */

  function handleMobileChange(value: string) {
    setSalesPersonContact(value.replace(/\D/g, '').slice(0, 10));
  }

  /* =========================
     SUBMIT
  ========================= */

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError('');

    if (!clientName.trim()) {
      setError('Client name is required.');
      return;
    }

    if (!salesPersonName.trim()) {
      setError('Sales person name is required.');
      return;
    }

    if (!/^[6-9]\d{9}$/.test(salesPersonContact)) {
      setError('Enter a valid 10 digit mobile number.');
      return;
    }

    if (!vendorName.trim()) {
      setError('Vendor name is required.');
      return;
    }

    if (!state.trim()) {
      setError('State is required.');
      return;
    }

    if (!city.trim()) {
      setError('City is required.');
      return;
    }

    if (!location.trim()) {
      setError('Location is required.');
      return;
    }

    if (quantity < 1) {
      setError('Quantity must be at least 1.');
      return;
    }

    if (!startDate || !endDate) {
      setError('Start date and end date are required.');
      return;
    }

    const calculatedDuration = calculateDuration(startDate, endDate);

    if (calculatedDuration <= 0) {
      setError('End date must be after or equal to start date.');
      return;
    }

    setLoading(true);

    try {
      const payload: CreateSiteData = {
        clientName: clientName.trim(),

        salesPersonName: salesPersonName.trim(),

        salesPersonContact: salesPersonContact.trim(),

        vendorName: vendorName.trim(),

        state: state.trim(),

        city: city.trim(),

        location: location.trim(),

        mediaType,

        quantity,

        startDate,

        endDate,

        duration: calculatedDuration,

        availability,

        status,
      };

      await onSubmit(payload);

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save ATR.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[95vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-xl">
        {/* =========================
            HEADER
        ========================= */}

        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#E8E8EC] bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-[#1F2937]">
              {site ? 'Edit ATR' : 'Add ATR'}
            </h2>

            <p className="mt-1 text-xs text-[#667085]">Manage ATR information and specifications</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="text-2xl leading-none text-[#667085] hover:text-[#8B2424]"
          >
            ×
          </button>
        </div>

        {/* =========================
            FORM
        ========================= */}

        <form onSubmit={handleSubmit} className="p-6">
          {/* =========================
              BASIC INFORMATION
          ========================= */}

          <div className="mb-6">
            <h3 className="mb-4 text-sm font-semibold text-[#1F2937]">Basic Information</h3>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {/* CLIENT */}

              <Field label="Client Name *">
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Enter client name"
                  className={inputClass}
                />
              </Field>

              {/* Type */}
              <div className="relative">
                <label className="mb-1.5 block text-sm font-semibold text-gray-900">
                  Type <span className="text-red-500">*</span>
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setTypeOpen(!typeOpen);
                    setStatusOpen(false);
                  }}
                  className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-left text-sm text-gray-900 outline-none transition hover:border-[#8B2424] focus:border-[#8B2424] focus:ring-2 focus:ring-[#F9DADA]"
                >
                  <span className="truncate mr-2">{mediaType}</span>

                  <span className="text-gray-500 shrink-0 select-none">▾</span>
                </button>

                {typeOpen && (
                  <div className="absolute left-0 right-0 z-30 mt-1 max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                    {MEDIA_TYPES.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => {
                          setMediaType(option);
                          setTypeOpen(false);
                        }}
                        className={`block w-full cursor-pointer px-4 py-2.5 text-left text-sm transition hover:bg-[#F9DADA] hover:text-[#8B2424] ${
                          mediaType === option
                            ? 'bg-[#FFF5F5] font-semibold text-[#8B2424]'
                            : 'text-gray-900'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Status */}
              <div className="relative">
                <label className="mb-1.5 block text-sm font-medium text-gray-900">
                  Status <span className="text-[#8B2424]">*</span>
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setStatusOpen(!statusOpen);
                    setTypeOpen(false);
                  }}
                  className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-left text-sm text-gray-900 outline-none transition hover:border-[#8B2424] focus:border-[#8B2424] focus:ring-2 focus:ring-[#F9DADA]"
                >
                  <span className="truncate mr-2">{status}</span>

                  <span className="text-gray-500 shrink-0 select-none">▾</span>
                </button>

                {statusOpen && (
                  <div className="absolute left-0 right-0 z-30 mt-1 max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                    {STATUS_OPTIONS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => {
                          setStatus(option);
                          setStatusOpen(false);
                        }}
                        className={`block w-full cursor-pointer px-4 py-2.5 text-left text-sm transition hover:bg-[#F9DADA] hover:text-[#8B2424] ${
                          status === option
                            ? 'bg-[#FFF5F5] font-semibold text-[#8B2424]'
                            : 'text-gray-900'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* SALES PERSON */}

              <Field label="Sales Person Name *">
                <input
                  type="text"
                  value={salesPersonName}
                  onChange={(e) => setSalesPersonName(e.target.value)}
                  placeholder="Enter sales person name"
                  className={inputClass}
                />
              </Field>

              {/* MOBILE */}

              <Field label="Mobile No *">
                <input
                  type="tel"
                  value={salesPersonContact}
                  onChange={(e) => handleMobileChange(e.target.value)}
                  placeholder="Enter mobile number"
                  inputMode="numeric"
                  maxLength={10}
                  className={inputClass}
                />
              </Field>

              {/* VENDOR */}

              <Field label="Vendor Name *">
                <input
                  type="text"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder="Enter vendor name"
                  className={inputClass}
                />
              </Field>

              {/* Start Date */}
              <div>
                <DatePicker
                  label="Start Date"
                  required
                  value={startDate}
                  onChange={setStartDate}
                  triggerClassName="px-4 py-2.5"
                />
              </div>

              {/* STATE */}

              <Field label="State *">
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="Enter state"
                  className={inputClass}
                />
              </Field>

              {/* CITY */}

              <Field label="City *">
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Enter city"
                  className={inputClass}
                />
              </Field>

              {/* End Date */}
              <div>
                <DatePicker
                  label="End Date"
                  required
                  min={startDate || undefined}
                  value={endDate}
                  onChange={setEndDate}
                  triggerClassName="px-4 py-2.5"
                />
              </div>
            </div>
          </div>

          {/* =========================
              LOCATION
          ========================= */}

          <div className="mb-6">
            <h3 className="mb-4 text-sm font-semibold text-[#1F2937]">Location</h3>

            <Field label="Location / Landmark *">
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Enter location or landmark"
                className={inputClass}
              />
            </Field>
          </div>

          {/* =========================
              MEDIA DETAILS
          ========================= */}

          <div className="mb-6">
            <h3 className="mb-4 text-sm font-semibold text-[#1F2937]">Media Details</h3>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {/* MEDIA TYPE */}

              <Field label="Media Type *">
                <select
                  value={mediaType}
                  onChange={(e) => setMediaType(e.target.value as MediaType)}
                  className={selectClass}
                >
                  {MEDIA_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </Field>

              {/* QUANTITY */}

              <Field label="Quantity *">
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className={inputClass}
                />
              </Field>
            </div>
          </div>

          {/* =========================
              DURATION
          ========================= */}

          <div className="mb-6">
            <h3 className="mb-4 text-sm font-semibold text-[#1F2937]">Duration</h3>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              {/* START */}

              <Field label="Start Date *">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className={inputClass}
                />
              </Field>

              {/* END */}

              <Field label="End Date *">
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  className={inputClass}
                />
              </Field>

              {/* DURATION */}

              <Field label="Duration (Days)">
                <input
                  type="number"
                  min={1}
                  value={duration}
                  readOnly
                  className={`${inputClass} bg-[#F9FAFB]`}
                />
              </Field>
            </div>
          </div>

          {/* =========================
              STATUS
          ========================= */}

          <div className="mb-6">
            <h3 className="mb-4 text-sm font-semibold text-[#1F2937]">Status</h3>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {/* AVAILABILITY */}

              <Field label="Availability *">
                <select
                  value={availability}
                  onChange={(e) => setAvailability(e.target.value as AvailabilityStatus)}
                  className={selectClass}
                >
                  {AVAILABILITY_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </Field>

              {/* ATR STATUS */}

              <Field label="ATR Status *">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as MediaPlanStatus)}
                  className={selectClass}
                >
                  {STATUS_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>

          {/* =========================
              ERROR
          ========================= */}

          {error && (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* =========================
              FOOTER
          ========================= */}

          <div className="flex justify-end gap-3 border-t border-[#E8E8EC] pt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg border border-[#E8E8EC] px-5 py-2.5 text-sm font-medium text-[#667085] hover:bg-[#F9FAFB] disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-[#8B2424] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#741D1D] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Saving...' : site ? 'Update ATR' : 'Create ATR'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* =========================
   FIELD
========================= */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label className="mb-1.5 block text-xs font-medium text-[#344054]">{label}</label>

      {children}
    </div>
  );
}
