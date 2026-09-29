"use client";

import { useMemo, useState } from "react";

import VendorFilters from "@/modules/vendors/components/VendorFilters";
import VendorTable from "@/modules/vendors/components/VendorTable";
import VendorForm from "@/modules/vendors/components/VendorForm";
import VendorDetails from "@/modules/vendors/components/VendorDetails";
import VendorSitesModal from "@/modules/vendors/components/VendorSitesModal";

import { useVendors } from "@/modules/vendors/hooks/useVendors";

import type {
  Vendor,
  VendorFormData,
  VendorSite,
} from "@/modules/vendors/types";

export default function VendorsPage() {
  const {
    vendors,
    loading,
    saving,
    error,
    addVendor,
    editVendor,
    deactivate,
    getSites,
  } = useVendors();

  /* =========================
     FILTER STATE
  ========================= */

  const [search, setSearch] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [status, setStatus] = useState("");
  const [registrationStatus, setRegistrationStatus] =
    useState("");

  /* =========================
     MODAL STATE
  ========================= */

  const [formOpen, setFormOpen] = useState(false);

  const [editingVendor, setEditingVendor] =
    useState<Vendor | null>(null);

  const [detailsVendor, setDetailsVendor] =
    useState<Vendor | null>(null);

  const [sitesVendor, setSitesVendor] =
    useState<Vendor | null>(null);

  const [sites, setSites] =
    useState<VendorSite[]>([]);

  const [sitesLoading, setSitesLoading] =
    useState(false);

  /* =========================
     STATE OPTIONS

     Duplicate state names removed.
     Comparison is case-insensitive.
  ========================= */

  const stateOptions = useMemo(() => {
    const uniqueStates =
      new Map<string, string>();

    vendors.forEach((vendor) => {
      const stateName =
        vendor.state?.trim();

      if (!stateName) return;

      const key =
        stateName.toLowerCase();

      if (!uniqueStates.has(key)) {
        uniqueStates.set(
          key,
          stateName
        );
      }
    });

    return Array.from(
      uniqueStates.values()
    ).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [vendors]);

  /* =========================
     CITY OPTIONS

     Only selected state's cities.
     Duplicate city names removed.
  ========================= */

  const cityOptions = useMemo(() => {
    if (!state) {
      return [];
    }

    const selectedState =
      state.trim().toLowerCase();

    const uniqueCities =
      new Map<string, string>();

    vendors
      .filter((vendor) => {
        const vendorState =
          vendor.state
            ?.trim()
            .toLowerCase();

        return (
          vendorState ===
          selectedState
        );
      })
      .forEach((vendor) => {
        /* =====================
           MAIN CITY
        ===================== */

        const mainCity =
          vendor.city?.trim();

        if (mainCity) {
          const key =
            mainCity.toLowerCase();

          if (
            !uniqueCities.has(key)
          ) {
            uniqueCities.set(
              key,
              mainCity
            );
          }
        }

        /* =====================
           CITIES SERVED
        ===================== */

        if (
          Array.isArray(
            vendor.citiesServed
          )
        ) {
          vendor.citiesServed.forEach(
            (item) => {
              const cityName =
                item.trim();

              if (!cityName) return;

              const key =
                cityName.toLowerCase();

              if (
                !uniqueCities.has(
                  key
                )
              ) {
                uniqueCities.set(
                  key,
                  cityName
                );
              }
            }
          );
        }
      });

    return Array.from(
      uniqueCities.values()
    ).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [vendors, state]);

  /* =========================
     FILTERED VENDORS
  ========================= */

  const filteredVendors =
    useMemo(() => {
      const searchValue =
        search
          .trim()
          .toLowerCase();

      const selectedState =
        state
          .trim()
          .toLowerCase();

      const selectedCity =
        city
          .trim()
          .toLowerCase();

      return vendors.filter(
        (vendor) => {
          /* =====================
             SEARCH
          ===================== */

          const matchesSearch =
            !searchValue ||
            vendor.name
              ?.toLowerCase()
              .includes(
                searchValue
              ) ||
            vendor.state
              ?.toLowerCase()
              .includes(
                searchValue
              ) ||
            vendor.city
              ?.toLowerCase()
              .includes(
                searchValue
              ) ||
            vendor.citiesServed?.some(
              (item) =>
                item
                  .toLowerCase()
                  .includes(
                    searchValue
                  )
            ) ||
            vendor.contactPerson
              ?.toLowerCase()
              .includes(
                searchValue
              ) ||
            vendor.panNumber
              ?.toLowerCase()
              .includes(
                searchValue
              ) ||
            vendor.gstNumber
              ?.toLowerCase()
              .includes(
                searchValue
              ) ||
            vendor.msmeNumber
              ?.toLowerCase()
              .includes(
                searchValue
              );

          /* =====================
             STATUS
          ===================== */

          const matchesStatus =
            !status ||
            vendor.status ===
              status;

          /* =====================
             STATE
          ===================== */

          const matchesState =
            !selectedState ||
            vendor.state
              ?.trim()
              .toLowerCase() ===
              selectedState;

          /* =====================
             CITY
          ===================== */

          const matchesCity =
            !selectedCity ||
            vendor.city
              ?.trim()
              .toLowerCase() ===
              selectedCity ||
            vendor.citiesServed?.some(
              (item) =>
                item
                  .trim()
                  .toLowerCase() ===
                selectedCity
            );

          /* =====================
             REGISTRATION
          ===================== */

          const matchesRegistration =
            !registrationStatus ||
            vendor.registrationStatus ===
              registrationStatus;

          return (
            matchesSearch &&
            matchesStatus &&
            matchesState &&
            matchesCity &&
            matchesRegistration
          );
        }
      );
    }, [
      vendors,
      search,
      state,
      city,
      status,
      registrationStatus,
    ]);

  /* =========================
     ADD VENDOR
  ========================= */

  function openAdd() {
    setEditingVendor(null);
    setFormOpen(true);
  }

  /* =========================
     EDIT VENDOR
  ========================= */

  function openEdit(
    vendor: Vendor
  ) {
    setEditingVendor(vendor);
    setFormOpen(true);
  }

  /* =========================
     SUBMIT VENDOR
  ========================= */

  async function handleSubmit(
    data: VendorFormData
  ) {
    if (editingVendor) {
      return editVendor(
        editingVendor._id,
        data
      );
    }

    return addVendor(data);
  }

  /* =========================
     RATING
  ========================= */

  async function handleRatingChange(
    vendor: Vendor,
    rating: number
  ) {
    await editVendor(
      vendor._id,
      {
        vendorRating: rating,
      }
    );
  }

  /* =========================
     VIEW SITES
  ========================= */

  async function openSites(
    vendor: Vendor
  ) {
    setSitesVendor(vendor);
    setSites([]);
    setSitesLoading(true);

    const result =
      await getSites(
        vendor._id
      );

    setSites(result);
    setSitesLoading(false);
  }

  /* =========================
     DEACTIVATE
  ========================= */

  async function handleDeactivate(
    vendor: Vendor
  ) {
    const confirmed =
      window.confirm(
        `Are you sure you want to deactivate ${vendor.name}?`
      );

    if (!confirmed) {
      return;
    }

    await deactivate(
      vendor._id
    );
  }

  /* =========================
     CLEAR FILTERS
  ========================= */

  function clearFilters() {
    setSearch("");
    setState("");
    setCity("");
    setStatus("");
    setRegistrationStatus("");
  }

  /* =========================
     RENDER
  ========================= */

  return (
    <main className="min-h-screen bg-white p-4 md:p-6">
      <div className="mx-auto max-w-7xl">

        {/* =====================
            HEADER
        ===================== */}

        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[#1F2937]">
              Vendors
            </h1>

            <p className="mt-1 text-sm text-[#667085]">
              Manage vendors and linked sites
            </p>
          </div>

          <button
            type="button"
            onClick={openAdd}
            className="rounded-xl bg-[#8B2424] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#A8383B] focus:outline-none focus:ring-2 focus:ring-[#F9DADA] focus:ring-offset-2"
          >
            + Add Vendor
          </button>
        </div>

        {/* =====================
            SUMMARY
        ===================== */}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <Summary
            title="Total Vendors"
            value={
              vendors.length
            }
          />

          <Summary
            title="Active"
            value={
              vendors.filter(
                (vendor) =>
                  vendor.status ===
                  "Active"
              ).length
            }
          />

          <Summary
            title="Inactive"
            value={
              vendors.filter(
                (vendor) =>
                  vendor.status ===
                  "Inactive"
              ).length
            }
          />

          <Summary
            title="Blacklist"
            value={
              vendors.filter(
                (vendor) =>
                  vendor.status ===
                  "Blacklist"
              ).length
            }
          />

        </div>

        {/* =====================
            FILTERS
        ===================== */}

        <VendorFilters
          search={search}
          state={state}
          city={city}
          status={status}
          registrationStatus={
            registrationStatus
          }
          states={stateOptions}
          cities={cityOptions}
          onSearchChange={
            setSearch
          }

          onStateChange={(value) => {
            setState(value);

            // State change par
            // city reset hogi.
            setCity("");
          }}

          onCityChange={
            setCity
          }

          onStatusChange={
            setStatus
          }

          onRegistrationStatusChange={
            setRegistrationStatus
          }
        />

        {/* =====================
            CLEAR FILTERS
        ===================== */}

        {(search ||
          state ||
          city ||
          status ||
          registrationStatus) && (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={
                clearFilters
              }
              className="rounded-lg px-4 py-2 text-sm font-semibold text-[#8B2424] transition hover:bg-[#F9DADA]"
            >
              Clear Filters
            </button>
          </div>
        )}

        {/* =====================
            ERROR
        ===================== */}

        {error && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-700">
              {error}
            </p>
          </div>
        )}

        {/* =====================
            TABLE
        ===================== */}

        <div className="mt-6">

          {loading ? (
            <div className="rounded-2xl border border-[#E8E8EC] bg-white p-16 text-center shadow-sm">

              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#F9DADA] border-t-[#8B2424]" />

              <p className="mt-4 text-sm text-[#667085]">
                Loading vendors...
              </p>

            </div>
          ) : (
            <VendorTable
              vendors={
                filteredVendors
              }
              loading={loading}
              onView={
                setDetailsVendor
              }
              onEdit={
                openEdit
              }
              onSites={
                openSites
              }
              onDeactivate={
                handleDeactivate
              }
              onRatingChange={
                handleRatingChange
              }
            />
          )}

        </div>
      </div>

      {/* =====================
          VENDOR FORM
      ===================== */}

      {formOpen && (
        <VendorForm
          vendor={
            editingVendor
          }
          saving={saving}
          onClose={() =>
            setFormOpen(false)
          }
          onSubmit={async (
            data
          ) => {
            const success =
              await handleSubmit(
                data
              );

            if (success) {
              setFormOpen(false);
            }

            return success;
          }}
        />
      )}

      {/* =====================
          VENDOR DETAILS
      ===================== */}

      {detailsVendor && (
        <VendorDetails
          vendor={
            detailsVendor
          }
          onClose={() =>
            setDetailsVendor(
              null
            )
          }
          onEdit={() => {
            setEditingVendor(
              detailsVendor
            );

            setDetailsVendor(
              null
            );

            setFormOpen(true);
          }}
        />
      )}

      {/* =====================
          VENDOR SITES
      ===================== */}

      {sitesVendor && (
        <VendorSitesModal
          vendor={
            sitesVendor
          }
          sites={sites}
          loading={
            sitesLoading
          }
          onClose={() => {
            setSitesVendor(
              null
            );

            setSites([]);
          }}
        />
      )}

    </main>
  );
}

/* =========================
   SUMMARY CARD
========================= */

function Summary({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-[#E8E8EC] bg-white p-5 shadow-sm transition hover:border-[#F0C7C7] hover:shadow-md">

      <p className="text-sm font-medium text-[#667085]">
        {title}
      </p>

      <p className="mt-2 text-3xl font-bold text-[#1F2937]">
        {value}
      </p>

    </div>
  );
}