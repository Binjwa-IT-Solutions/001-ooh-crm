"use client";

import { useEffect, useMemo, useState } from "react";

import { useSites } from "@/modules/sites/hooks/useSites";
import type {
  Site,
  SiteType,
  SiteStatus,
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

  // ---------------------------------
  // FILTER STATE
  // ---------------------------------

  const [city, setCity] = useState("");

  const [type, setType] =
    useState<SiteType | "">("");

  const [status, setStatus] =
    useState<SiteStatus | "">("");

  // ---------------------------------
  // FORM STATE
  // ---------------------------------

  const [showForm, setShowForm] =
    useState(false);

  const [selectedSite, setSelectedSite] =
    useState<Site | null>(null);

  // ---------------------------------
  // PAGINATION
  // ---------------------------------

  const [currentPage, setCurrentPage] =
    useState(1);

  // ---------------------------------
  // FILTER SITES
  // ---------------------------------

  const filteredSites = useMemo(() => {
    return sites.filter((site) => {
      const matchesCity = city
        ? site.city
            .toLowerCase()
            .includes(city.toLowerCase())
        : true;

      const matchesType = type
        ? site.type === type
        : true;

      const matchesStatus = status
        ? site.status === status
        : true;

      return (
        matchesCity &&
        matchesType &&
        matchesStatus
      );
    });
  }, [sites, city, type, status]);

  // ---------------------------------
  // TOTAL PAGES
  // ---------------------------------

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredSites.length /
        ITEMS_PER_PAGE
    )
  );

  // ---------------------------------
  // PAGINATED SITES
  // ---------------------------------

  const paginatedSites = useMemo(() => {
    const startIndex =
      (currentPage - 1) *
      ITEMS_PER_PAGE;

    const endIndex =
      startIndex + ITEMS_PER_PAGE;

    return filteredSites.slice(
      startIndex,
      endIndex
    );
  }, [
    filteredSites,
    currentPage,
  ]);

  // ---------------------------------
  // RESET PAGE WHEN FILTER CHANGES
  // ---------------------------------

  useEffect(() => {
    setCurrentPage(1);
  }, [city, type, status]);

  // ---------------------------------
  // HANDLE INVALID PAGE
  // ---------------------------------

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [
    currentPage,
    totalPages,
  ]);

  // ---------------------------------
  // SUMMARY
  // ---------------------------------

  const totalSites = sites.length;

  const activeSites = sites.filter(
    (site) =>
      site.status === "Active"
  ).length;

  const maintenanceSites =
    sites.filter(
      (site) =>
        site.status === "Maintenance"
    ).length;

  const inactiveSites = sites.filter(
    (site) =>
      site.status === "Inactive"
  ).length;

  // ---------------------------------
  // ADD SITE
  // ---------------------------------

  const handleAddSite = () => {
    setSelectedSite(null);
    setShowForm(true);
  };

  // ---------------------------------
  // EDIT SITE
  // ---------------------------------

  const handleEditSite = (
    site: Site
  ) => {
    setSelectedSite(site);
    setShowForm(true);
  };

  // ---------------------------------
  // CLOSE FORM
  // ---------------------------------

  const handleCloseForm = () => {
    setShowForm(false);
    setSelectedSite(null);
  };

  // ---------------------------------
  // SUBMIT
  // ---------------------------------

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
  };

  // ---------------------------------
  // SUCCESS
  // ---------------------------------

  const handleSuccess = () => {
    setShowForm(false);
    setSelectedSite(null);
  };

  // ---------------------------------
  // PAGE NUMBERS
  // ---------------------------------

  const pageNumbers = Array.from(
    {
      length: totalPages,
    },
    (_, index) => index + 1
  );

  // ---------------------------------
  // DISPLAY RANGE
  // ---------------------------------

  const startItem =
    filteredSites.length === 0
      ? 0
      : (currentPage - 1) *
          ITEMS_PER_PAGE +
        1;

  const endItem = Math.min(
    currentPage * ITEMS_PER_PAGE,
    filteredSites.length
  );

  // ---------------------------------
  // UI
  // ---------------------------------

  return (
    <div className="min-h-screen bg-[#F7F8FA] p-6">

      {/* ================= HEADER ================= */}

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#1F2937]">
            Selected Media Registry
          </h1>

          <p className="mt-1 text-sm text-[#667085]">
            Manage and monitor your media sites
          </p>
        </div>

        <button
          type="button"
          onClick={handleAddSite}
          className="rounded-lg bg-[#8B2424] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#F9DADA] hover:text-[#8B2424]"
        >
          + Add Site
        </button>
      </div>

      {/* ================= SUMMARY CARDS ================= */}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

        {/* TOTAL */}

        <div className="rounded-xl border border-[#E8E8EC] bg-white p-4">
          <p className="text-xs font-medium text-[#667085]">
            Total Sites
          </p>

          <p className="mt-2 text-2xl font-semibold text-[#1F2937]">
            {totalSites}
          </p>
        </div>

        {/* ACTIVE */}

        <div className="rounded-xl border border-[#E8E8EC] bg-white p-4">
          <p className="text-xs font-medium text-[#667085]">
            Active
          </p>

          <p className="mt-2 text-2xl font-semibold text-[#1F2937]">
            {activeSites}
          </p>
        </div>

        {/* MAINTENANCE */}

        <div className="rounded-xl border border-[#E8E8EC] bg-white p-4">
          <p className="text-xs font-medium text-[#667085]">
            Maintenance
          </p>

          <p className="mt-2 text-2xl font-semibold text-[#1F2937]">
            {maintenanceSites}
          </p>
        </div>

        {/* INACTIVE */}

        <div className="rounded-xl border border-[#E8E8EC] bg-white p-4">
          <p className="text-xs font-medium text-[#667085]">
            Inactive
          </p>

          <p className="mt-2 text-2xl font-semibold text-[#1F2937]">
            {inactiveSites}
          </p>
        </div>
      </div>

      {/* ================= FILTERS ================= */}

      <div className="mb-5">
        <SiteFilters
          city={city}
          type={type}
          status={status}
          onCityChange={setCity}
          onTypeChange={setType}
          onStatusChange={setStatus}
        />
      </div>

      {/* ================= ERROR ================= */}

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ================= RESULTS HEADER ================= */}

      <div className="mb-3 flex items-center justify-between">

        <div>
          <h2 className="text-sm font-semibold text-[#1F2937]">
            Sites
          </h2>

          <p className="mt-0.5 text-xs text-[#667085]">
            Showing {startItem} - {endItem}{" "}
            of {filteredSites.length} sites
          </p>
        </div>

        <p className="text-xs text-[#667085]">
          Page {currentPage} of{" "}
          {totalPages}
        </p>
      </div>

      {/* ================= TABLE ================= */}

      <div className="rounded-xl border border-[#E8E8EC] bg-white">

        {loading ? (
          <div className="flex min-h-[250px] items-center justify-center">
            <p className="text-sm text-[#667085]">
              Loading sites...
            </p>
          </div>
        ) : paginatedSites.length ===
          0 ? (
          <div className="flex min-h-[250px] items-center justify-center">
            <div className="text-center">

              <p className="text-sm font-medium text-[#1F2937]">
                No sites found
              </p>

              <p className="mt-1 text-xs text-[#667085]">
                Try changing your filters
                or add a new site.
              </p>

            </div>
          </div>
        ) : (
          <SiteTable
            sites={paginatedSites}
            onEdit={handleEditSite}
          />
        )}

      </div>

      {/* ================= PAGINATION ================= */}

      {!loading &&
        filteredSites.length > 0 &&
        totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-[#E8E8EC] bg-white px-4 py-3">

            {/* SHOWING */}

            <p className="text-xs text-[#667085]">
              Showing {startItem} -{" "}
              {endItem} of{" "}
              {filteredSites.length}
            </p>

            {/* CONTROLS */}

            <div className="flex items-center gap-1">

              {/* PREVIOUS */}

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
                className="rounded-lg border border-[#E8E8EC] px-3 py-1.5 text-xs font-medium text-[#667085] transition hover:bg-[#F9DADA] hover:text-[#8B2424] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>

              {/* PAGE NUMBERS */}

              {pageNumbers.map(
                (page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() =>
                      setCurrentPage(
                        page
                      )
                    }
                    className={`min-w-[32px] rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                      currentPage === page
                        ? "bg-[#8B2424] text-white"
                        : "border border-[#E8E8EC] text-[#667085] hover:bg-[#F9DADA] hover:text-[#8B2424]"
                    }`}
                  >
                    {page}
                  </button>
                )
              )}

              {/* NEXT */}

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
                className="rounded-lg border border-[#E8E8EC] px-3 py-1.5 text-xs font-medium text-[#667085] transition hover:bg-[#F9DADA] hover:text-[#8B2424] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>

            </div>
          </div>
        )}

      {/* ================= FORM ================= */}

      {showForm && (
        <SiteForm
          site={selectedSite}
          onClose={handleCloseForm}
          onSuccess={handleSuccess}
          onSubmit={handleSubmit}
        />
      )}

    </div>
  );
}