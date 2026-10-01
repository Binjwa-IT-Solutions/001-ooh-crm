"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useSites } from "@/modules/sites/hooks/useSites";

import type {
  Site,
  MediaType,
  ATRStatus,
  AvailabilityStatus,
} from "@/modules/sites/types";

import SiteFilters from "./SiteFilters";
import SiteForm from "./SiteForm";
import SiteTable from "./SiteTable";

const ITEMS_PER_PAGE = 10;

export default function SitesPage() {
  const {
    sites,
    loading,
    error,
    addSite,
    editSite,
  } = useSites();

  /* =========================
     FILTER STATES
     ========================= */

  const [search, setSearch] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [vendorName, setVendorName] =
    useState("");

  const [mediaType, setMediaType] =
    useState<MediaType | "">("");

  const [availability, setAvailability] =
    useState<AvailabilityStatus | "">("");

  const [status, setStatus] =
    useState<ATRStatus | "">("");

  /* =========================
     FORM
     ========================= */

  const [showForm, setShowForm] =
    useState(false);

  const [selectedSite, setSelectedSite] =
    useState<Site | null>(null);

  const [currentPage, setCurrentPage] =
    useState(1);

  /* =========================
     STATE OPTIONS
     ========================= */

  const stateOptions = useMemo(() => {
    const values = sites
      .map((site) =>
        site.state?.trim()
      )
      .filter(
        (value): value is string =>
          Boolean(value)
      );

    return Array.from(
      new Set(values)
    ).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [sites]);

  /* =========================
     CITY OPTIONS
     ========================= */

  const cityOptions = useMemo(() => {
    const values = sites
      .filter(
        (site) =>
          !state ||
          site.state?.trim() === state
      )
      .map((site) =>
        site.city?.trim()
      )
      .filter(
        (value): value is string =>
          Boolean(value)
      );

    return Array.from(
      new Set(values)
    ).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [sites, state]);

  /* =========================
     VENDOR OPTIONS
     ========================= */

  const vendorOptions = useMemo(() => {
    const values = sites
      .map((site) =>
        site.vendorName?.trim()
      )
      .filter(
        (value): value is string =>
          Boolean(value)
      );

    return Array.from(
      new Set(values)
    ).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [sites]);

  /* =========================
     FILTERED SITES
     ========================= */

  const filteredSites = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    return sites.filter((site) => {
      const matchesSearch =
        !query ||
        [
          site.clientName,
          site.salesPersonName,
          site.salesPersonContact,
          site.state,
          site.city,
          site.location,
          site.vendorName,
          site.mediaType,
          site.atrNo,
          site.status,
          site.availability,
        ].some((value) =>
          String(value ?? "")
            .toLowerCase()
            .includes(query)
        );

      const matchesState =
        !state ||
        site.state?.trim() === state;

      const matchesCity =
        !city ||
        site.city?.trim() === city;

      const matchesVendor =
        !vendorName ||
        site.vendorName
          ?.toLowerCase()
          .includes(
            vendorName.toLowerCase()
          );

      const matchesMediaType =
        !mediaType ||
        site.mediaType === mediaType;

      const matchesStatus =
        !status ||
        site.status === status;

      const matchesAvailability =
        !availability ||
        site.availability === availability;

      return (
        matchesSearch &&
        matchesState &&
        matchesCity &&
        matchesVendor &&
        matchesMediaType &&
        matchesStatus &&
        matchesAvailability
      );
    });
  }, [
    sites,
    search,
    state,
    city,
    vendorName,
    mediaType,
    status,
    availability,
  ]);

  /* =========================
     PAGINATION
     ========================= */

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredSites.length /
        ITEMS_PER_PAGE
    )
  );

  const visibleSites = useMemo(() => {
    const start =
      (currentPage - 1) *
      ITEMS_PER_PAGE;

    return filteredSites.slice(
      start,
      start + ITEMS_PER_PAGE
    );
  }, [
    filteredSites,
    currentPage,
  ]);

  /* =========================
     RESET PAGE
     ========================= */

  useEffect(() => {
    setCurrentPage(1);
  }, [
    search,
    state,
    city,
    vendorName,
    mediaType,
    status,
    availability,
  ]);

  /* =========================
     VALID CITY
     ========================= */

  useEffect(() => {
    if (
      city &&
      !cityOptions.includes(city)
    ) {
      setCity("");
    }
  }, [city, cityOptions]);

  /* =========================
     KEEP PAGE VALID
     ========================= */

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [
    currentPage,
    totalPages,
  ]);

  /* =========================
     FORM SUBMIT
     ========================= */

  const handleSubmit = async (
    data: Parameters<
      typeof addSite
    >[0]
  ) => {
    if (selectedSite) {
      await editSite(
        selectedSite._id,
        data
      );
    } else {
      await addSite(data);
    }

    setShowForm(false);
    setSelectedSite(null);
  };

  /* =========================
     SUMMARY
     ========================= */

  const approvedCount =
    sites.filter(
      (site) =>
        site.status === "Approved"
    ).length;

  const availableCount =
    sites.filter(
      (site) =>
        site.availability ===
        "Available"
    ).length;

  const bookedCount =
    sites.filter(
      (site) =>
        site.availability === "Booked"
    ).length;

  /* =========================
     CLEAR FILTERS
     ========================= */

  const clearFilters = () => {
    setSearch("");
    setState("");
    setCity("");
    setVendorName("");
    setMediaType("");
    setStatus("");
    setAvailability("");
  };

  const hasFilters =
    Boolean(search) ||
    Boolean(state) ||
    Boolean(city) ||
    Boolean(vendorName) ||
    Boolean(mediaType) ||
    Boolean(status) ||
    Boolean(availability);

  return (
    <div className="min-h-screen bg-white">

      {/* HEADER */}

      <div className="border-b border-[#E8E8EC] bg-white px-6 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

          <div>
            <div className="flex items-center gap-2 text-xs text-[#667085]">
              <span>Media Buying</span>
              <span>/</span>

              <span className="text-[#A8383B]">
                ATR Plan
              </span>
            </div>

            <h1 className="mt-2 text-xl font-semibold text-[#1F2937]">
              ATR Plan
            </h1>

            <p className="mt-1 text-sm text-[#667085]">
              Manage available ATR plans
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setSelectedSite(null);
              setShowForm(true);
            }}
            className="rounded-lg bg-[#8B2424] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#741D1D]"
          >
            + Add ATR
          </button>
        </div>
      </div>

      {/* SUMMARY */}

      <div className="grid grid-cols-1 gap-4 px-6 py-5 sm:grid-cols-2 lg:grid-cols-4">

        <SummaryCard
          label="Total ATR"
          value={sites.length}
          helper="Registered ATR plans"
        />

        <SummaryCard
          label="Approved"
          value={approvedCount}
          helper="Currently approved"
        />

        <SummaryCard
          label="Available"
          value={availableCount}
          helper="Available"
        />

        <SummaryCard
          label="Booked"
          value={bookedCount}
          helper="Currently booked"
        />
      </div>

      {/* FILTERS */}

      <section className="mx-6 rounded-xl border border-[#E8E8EC] bg-white">

        <div className="border-b border-[#E8E8EC] px-5 py-4">
          <h2 className="text-sm font-semibold text-[#1F2937]">
            ATR Filters
          </h2>

          <p className="mt-1 text-xs text-[#667085]">
            Filter by state, city, vendor,
            type, availability and status
          </p>
        </div>

        <div className="p-4">
          <SiteFilters
            search={search}
            state={state}
            city={city}
            vendorName={vendorName}
            mediaType={mediaType}
            availability={availability}
            status={status}
            stateOptions={stateOptions}
            cityOptions={cityOptions}
            vendorOptions={vendorOptions}
            onSearchChange={setSearch}
            onStateChange={setState}
            onCityChange={setCity}
            onVendorChange={setVendorName}
            onMediaTypeChange={
              setMediaType
            }
            onAvailabilityChange={
              setAvailability
            }
            onStatusChange={setStatus}
          />

          {hasFilters && (
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={clearFilters}
                className="text-sm font-medium text-[#8B2424] hover:underline"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </section>

      {/* TABLE */}

      <section className="mx-6 mt-5 rounded-xl border border-[#E8E8EC] bg-white">

        <div className="border-b border-[#E8E8EC] px-5 py-4">
          <h2 className="text-sm font-semibold text-[#1F2937]">
            ATR Plans
          </h2>

          <p className="mt-1 text-xs text-[#667085]">
            {filteredSites.length} ATR
            {filteredSites.length === 1
              ? ""
              : "s"} found
          </p>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-[#667085]">
            Loading ATR plans...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-red-600">
            {error}
          </div>
        ) : (
          <>
            <SiteTable
              sites={visibleSites}
              onEdit={(site) => {
                setSelectedSite(site);
                setShowForm(true);
              }}
            />

            {/* PAGINATION */}

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-[#E8E8EC] px-5 py-4">

                <button
                  type="button"
                  disabled={
                    currentPage === 1
                  }
                  onClick={() =>
                    setCurrentPage(
                      (page) =>
                        Math.max(
                          1,
                          page - 1
                        )
                    )
                  }
                  className="rounded-lg border border-[#E8E8EC] px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>

                <span className="text-sm text-[#667085]">
                  Page {currentPage} of{" "}
                  {totalPages}
                </span>

                <button
                  type="button"
                  disabled={
                    currentPage ===
                    totalPages
                  }
                  onClick={() =>
                    setCurrentPage(
                      (page) =>
                        Math.min(
                          totalPages,
                          page + 1
                        )
                    )
                  }
                  className="rounded-lg border border-[#E8E8EC] px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* FORM */}

      {showForm && (
        <SiteForm
          site={selectedSite}
          onClose={() => {
            setShowForm(false);
            setSelectedSite(null);
          }}
          onSuccess={() => {
            setShowForm(false);
            setSelectedSite(null);
          }}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: number;
  helper: string;
}) {
  return (
    <div className="rounded-xl border border-[#E8E8EC] bg-white p-5">
      <p className="text-xs font-medium text-[#667085]">
        {label}
      </p>

      <p className="mt-2 text-2xl font-semibold text-[#1F2937]">
        {value}
      </p>

      <p className="mt-1 text-xs text-[#98A2B3]">
        {helper}
      </p>
    </div>
  );
}