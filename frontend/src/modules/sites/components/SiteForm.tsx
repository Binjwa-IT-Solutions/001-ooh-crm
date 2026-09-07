"use client";

import { useEffect, useRef, useState } from "react";

import type {
  CreateSiteData,
  Site,
  SiteType,
  SiteStatus,
} from "../types";

interface Props {
  site?: Site | null;
  onClose: () => void;
  onSuccess: () => void;
  onSubmit: (data: CreateSiteData) => Promise<void>;
}

export default function SiteForm({
  site,
  onClose,
  onSuccess,
  onSubmit,
}: Props) {
  const [city, setCity] = useState("");
  const [type, setType] = useState<SiteType>("Airport");
  const [address, setAddress] = useState("");

  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [cost, setCost] = useState("");

  const [vendorId, setVendorId] = useState("");
  const [photos, setPhotos] = useState("");

  const [status, setStatus] =
    useState<SiteStatus>("Active");

  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  const [error, setError] = useState("");
  const [gpsError, setGpsError] = useState("");

  const [typeOpen, setTypeOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  const typeRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  /* -----------------------------------------
     Load existing site
  ----------------------------------------- */
  useEffect(() => {
    if (!site) return;

    setCity(site.city);
    setType(site.type);
    setAddress(site.address || "");

    setLat(String(site.gps?.lat ?? ""));
    setLng(String(site.gps?.lng ?? ""));

    setStartDate(
      site.startDate
        ? String(site.startDate).slice(0, 10)
        : ""
    );

    setEndDate(
      site.endDate
        ? String(site.endDate).slice(0, 10)
        : ""
    );

    setWidth(String(site.sizeWidth ?? ""));
    setHeight(String(site.sizeHeight ?? ""));
    setCost(String(site.baseCostPerDay ?? ""));

    setVendorId(site.vendorId || "");

    setPhotos(
      site.photos?.join(", ") || ""
    );

    setStatus(site.status);
  }, [site]);

  /* -----------------------------------------
     Close dropdown on outside click
  ----------------------------------------- */
  useEffect(() => {
    const close = (e: MouseEvent) => {
      const target = e.target as Node;

      if (
        typeRef.current &&
        !typeRef.current.contains(target)
      ) {
        setTypeOpen(false);
      }

      if (
        statusRef.current &&
        !statusRef.current.contains(target)
      ) {
        setStatusOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      close
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        close
      );
    };
  }, []);

  /* -----------------------------------------
     Get GPS
  ----------------------------------------- */
  const handleGetGPS = () => {
    setGpsError("");

    if (!navigator.geolocation) {
      setGpsError(
        "GPS is not supported."
      );
      return;
    }

    setGpsLoading(true);

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const {
          latitude,
          longitude,
        } = coords;

        if (
          latitude < 6 ||
          latitude > 37.5 ||
          longitude < 68 ||
          longitude > 97.5
        ) {
          setGpsError(
            "Location must be within India."
          );
        } else {
          setLat(latitude.toString());
          setLng(longitude.toString());
        }

        setGpsLoading(false);
      },
      () => {
        setGpsError(
          "Location permission denied or unavailable."
        );

        setGpsLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  /* -----------------------------------------
     Submit
  ----------------------------------------- */
  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setError("");

    /* City */
    if (!city.trim()) {
      return setError(
        "City is required."
      );
    }

    /* Address */
    if (!address.trim()) {
      return setError(
        "Address is required."
      );
    }

    /* GPS */
    if (!lat || !lng) {
      return setError(
        "Please select location using GPS."
      );
    }

    /* Dates */
    if (!startDate) {
      return setError(
        "Start date is required."
      );
    }

    if (!endDate) {
      return setError(
        "End date is required."
      );
    }

    if (
      new Date(startDate) >
      new Date(endDate)
    ) {
      return setError(
        "End date cannot be before start date."
      );
    }

    /* Size */
    if (!width || !height) {
      return setError(
        "Width and height are required."
      );
    }

    /* Cost */
    if (!cost) {
      return setError(
        "Base cost per day is required."
      );
    }

    const latitude = Number(lat);
    const longitude = Number(lng);

    const siteWidth = Number(width);
    const siteHeight = Number(height);

    const dailyCost = Number(cost);

    /* GPS validation */
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < 6 ||
      latitude > 37.5 ||
      longitude < 68 ||
      longitude > 97.5
    ) {
      return setError(
        "GPS coordinates must fall within India."
      );
    }

    /* Size validation */
    if (
      !Number.isFinite(siteWidth) ||
      siteWidth <= 0 ||
      !Number.isFinite(siteHeight) ||
      siteHeight <= 0
    ) {
      return setError(
        "Width and height must be greater than 0."
      );
    }

    /* Cost validation */
    if (
      !Number.isInteger(dailyCost) ||
      dailyCost < 0
    ) {
      return setError(
        "Base cost per day must be a nonnegative whole number."
      );
    }

    try {
      setLoading(true);

      const data: CreateSiteData = {
        city: city.trim(),

        type,

        address: address.trim(),

        gps: {
          lat: latitude,
          lng: longitude,
        },

        startDate,

        endDate,

        sizeWidth: siteWidth,

        sizeHeight: siteHeight,

        baseCostPerDay: dailyCost,

        vendorId: vendorId.trim()
          ? vendorId.trim()
          : null,

        status,

        photos: photos
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean),
      };

      await onSubmit(data);

      onSuccess();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save site."
      );
    } finally {
      setLoading(false);
    }
  }

  /* -----------------------------------------
     Options
  ----------------------------------------- */
  const typeOptions: SiteType[] = [
    "Airport",
    "Highway",
    "Mall",
    "Metro",
    "Market",
    "Other",
  ];

  const statusOptions: SiteStatus[] = [
    "Active",
    "Maintenance",
    "Inactive",
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {site
                ? "Edit Site"
                : "Add Site"}
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              {site
                ? "Update site information"
                : "Add a new advertising site"}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-2xl text-gray-500 hover:bg-[#F9DADA] hover:text-[#8B2424]"
          >
            ×
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="overflow-y-auto"
        >
          <div className="space-y-5 p-6">

            {/* Error */}
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </div>
            )}

            {/* City / Type / Status */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

              {/* City */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-900">
                  City{" "}
                  <span className="text-red-500">
                    *
                  </span>
                </label>

                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) =>
                    setCity(e.target.value)
                  }
                  placeholder="Enter city"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition hover:border-[#8B2424] focus:border-[#8B2424] focus:ring-2 focus:ring-[#F9DADA]"
                />
              </div>

              {/* Type */}
              <div
                ref={typeRef}
                className="relative"
              >
                <label className="mb-1.5 block text-sm font-semibold text-gray-900">
                  Type{" "}
                  <span className="text-red-500">
                    *
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setTypeOpen(!typeOpen);
                    setStatusOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-lg border border-gray-300 px-4 py-2.5 text-left hover:border-[#8B2424] focus:ring-2 focus:ring-[#F9DADA]"
                >
                  {type}

                  <span className="text-[#8B2424]">
                    ▾
                  </span>
                </button>

                {typeOpen && (
                  <div className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-lg border bg-white shadow-lg">
                    {typeOptions.map(
                      (option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => {
                            setType(option);
                            setTypeOpen(false);
                          }}
                          className={`block w-full px-4 py-2.5 text-left hover:bg-[#F9DADA] hover:text-[#8B2424] ${
                            type === option
                              ? "bg-[#F9DADA] text-[#8B2424]"
                              : ""
                          }`}
                        >
                          {option}
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>

              {/* Status */}
              <div
                ref={statusRef}
                className="relative"
              >
                <label className="mb-1.5 block text-sm font-semibold text-gray-900">
                  Status{" "}
                  <span className="text-red-500">
                    *
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setStatusOpen(
                      !statusOpen
                    );
                    setTypeOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-lg border border-gray-300 px-4 py-2.5 text-left hover:border-[#8B2424] focus:ring-2 focus:ring-[#F9DADA]"
                >
                  {status}

                  <span className="text-[#8B2424]">
                    ▾
                  </span>
                </button>

                {statusOpen && (
                  <div className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-lg border bg-white shadow-lg">
                    {statusOptions.map(
                      (option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => {
                            setStatus(option);
                            setStatusOpen(false);
                          }}
                          className={`block w-full px-4 py-2.5 text-left hover:bg-[#F9DADA] hover:text-[#8B2424] ${
                            status === option
                              ? "bg-[#F9DADA] text-[#8B2424]"
                              : ""
                          }`}
                        >
                          {option}
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-900">
                Address{" "}
                <span className="text-red-500">
                  *
                </span>
              </label>

              <input
                type="text"
                required
                value={address}
                onChange={(e) =>
                  setAddress(e.target.value)
                }
                placeholder="Enter full address"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition hover:border-[#8B2424] focus:border-[#8B2424] focus:ring-2 focus:ring-[#F9DADA]"
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

              {/* Start Date */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-900">
                  Start Date{" "}
                  <span className="text-red-500">
                    *
                  </span>
                </label>

                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) =>
                    setStartDate(
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition hover:border-[#8B2424] focus:border-[#8B2424] focus:ring-2 focus:ring-[#F9DADA]"
                />
              </div>

              {/* End Date */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-900">
                  End Date{" "}
                  <span className="text-red-500">
                    *
                  </span>
                </label>

                <input
                  type="date"
                  required
                  min={
                    startDate ||
                    undefined
                  }
                  value={endDate}
                  onChange={(e) =>
                    setEndDate(
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition hover:border-[#8B2424] focus:border-[#8B2424] focus:ring-2 focus:ring-[#F9DADA]"
                />
              </div>
            </div>

            {/* GPS */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-900">
                GPS Location{" "}
                <span className="text-red-500">
                  *
                </span>
              </label>

              <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-300 bg-gray-50 p-3">

                <div>
                  {lat && lng ? (
                    <p className="text-xs text-gray-600">
                      Lat:{" "}
                      {Number(lat).toFixed(6)}
                      {" • "}
                      Lng:{" "}
                      {Number(lng).toFixed(6)}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500">
                      Select location using GPS
                    </p>
                  )}

                  {gpsError && (
                    <p className="mt-1 text-xs text-red-600">
                      {gpsError}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleGetGPS}
                  disabled={gpsLoading}
                  className="shrink-0 rounded-lg bg-[#8B2424] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#F9DADA] hover:text-[#8B2424] disabled:opacity-60"
                >
                  {gpsLoading
                    ? "Detecting..."
                    : lat && lng
                      ? "Update Location"
                      : "Use Current Location"}
                </button>
              </div>
            </div>

            {/* Size / Cost */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

              {/* Width */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-900">
                  Width{" "}
                  <span className="text-red-500">
                    *
                  </span>
                </label>

                <input
                  type="number"
                  min="0"
                  required
                  value={width}
                  onChange={(e) =>
                    setWidth(e.target.value)
                  }
                  placeholder="Enter width"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition hover:border-[#8B2424] focus:border-[#8B2424] focus:ring-2 focus:ring-[#F9DADA]"
                />
              </div>

              {/* Height */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-900">
                  Height{" "}
                  <span className="text-red-500">
                    *
                  </span>
                </label>

                <input
                  type="number"
                  min="0"
                  required
                  value={height}
                  onChange={(e) =>
                    setHeight(e.target.value)
                  }
                  placeholder="Enter height"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition hover:border-[#8B2424] focus:border-[#8B2424] focus:ring-2 focus:ring-[#F9DADA]"
                />
              </div>

              {/* Cost */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-900">
                  Base Cost / Day{" "}
                  <span className="text-red-500">
                    *
                  </span>
                </label>

                <input
                  type="number"
                  min="0"
                  required
                  value={cost}
                  onChange={(e) =>
                    setCost(e.target.value)
                  }
                  placeholder="Enter cost in paise"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition hover:border-[#8B2424] focus:border-[#8B2424] focus:ring-2 focus:ring-[#F9DADA]"
                />
              </div>
            </div>

            {/* Vendor */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-900">
                Vendor ID
              </label>

              <input
                type="text"
                value={vendorId}
                onChange={(e) =>
                  setVendorId(e.target.value)
                }
                placeholder="Enter vendor ID (optional)"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition hover:border-[#8B2424] focus:border-[#8B2424] focus:ring-2 focus:ring-[#F9DADA]"
              />
            </div>

            {/* Photos */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-900">
                Photos (URLs)
              </label>

              <input
                type="text"
                value={photos}
                onChange={(e) =>
                  setPhotos(e.target.value)
                }
                placeholder="Enter photo URLs separated by comma"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition hover:border-[#8B2424] focus:border-[#8B2424] focus:ring-2 focus:ring-[#F9DADA]"
              />

              <p className="mt-1.5 text-xs text-gray-500">
                Example:
                https://example.com/site.jpg
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">

            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg border border-[#8B2424] bg-[#F9DADA] px-5 py-2.5 font-semibold text-[#8B2424] hover:bg-[#8B2424] hover:text-[#F9DADA] disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-[#8B2424] px-6 py-2.5 font-semibold text-[#F9DADA] hover:bg-[#A8383B] disabled:opacity-50"
            >
              {loading
                ? "Saving..."
                : site
                  ? "Update Site"
                  : "Save Site"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}