"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useBooking,
} from "@/modules/bookings/hooks/useBooking";

import type {
  AvailableSite,
} from "@/modules/bookings/types";

import AvailabilitySearch from "@/modules/bookings/components/AvailabilitySearch";

import AvailabilityTable from "@/modules/bookings/components/AvailabilityTable";

import BookingForm from "@/modules/bookings/components/BookingForm";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

interface BookingHistoryItem {
  _id?: string;

  siteId:
    | string
    | {
        _id?: string;
        code?: string;
        city?: string;
        type?: string;
        baseCostPerDay?: number;
      };

  date: string | Date;

  campaignId: string;

  quotationId?: string | null;
}

interface GroupedBooking
  extends BookingHistoryItem {
  fromDate: string | Date;
  toDate: string | Date;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function normalizeDate(
  date: string | Date,
): Date {
  const value = new Date(date);

  return new Date(
    Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate(),
    ),
  );
}

function getSiteId(
  booking: BookingHistoryItem,
): string {
  if (
    typeof booking.siteId === "object" &&
    booking.siteId !== null
  ) {
    return String(
      booking.siteId._id ?? "",
    );
  }

  return String(
    booking.siteId ?? "",
  );
}

function groupBookings(
  bookings: BookingHistoryItem[],
): GroupedBooking[] {
  if (!bookings.length) {
    return [];
  }

  /*
   * Sort by:
   * Site → Campaign → Quotation → Date
   *
   * This keeps consecutive dates of the same
   * booking together.
   */
  const sorted = [...bookings].sort(
    (a, b) => {
      const siteA = getSiteId(a);
      const siteB = getSiteId(b);

      if (siteA !== siteB) {
        return siteA.localeCompare(
          siteB,
        );
      }

      const campaignA =
        String(a.campaignId ?? "");

      const campaignB =
        String(b.campaignId ?? "");

      if (campaignA !== campaignB) {
        return campaignA.localeCompare(
          campaignB,
        );
      }

      const quotationA =
        String(a.quotationId ?? "");

      const quotationB =
        String(b.quotationId ?? "");

      if (quotationA !== quotationB) {
        return quotationA.localeCompare(
          quotationB,
        );
      }

      return (
        normalizeDate(a.date).getTime() -
        normalizeDate(b.date).getTime()
      );
    },
  );

  const grouped: GroupedBooking[] = [];

  for (const booking of sorted) {
    const last =
      grouped[grouped.length - 1];

    const sameSite =
      last &&
      getSiteId(booking) ===
        getSiteId(last);

    const sameCampaign =
      last &&
      String(booking.campaignId ?? "") ===
        String(last.campaignId ?? "");

    const sameQuotation =
      last &&
      String(booking.quotationId ?? "") ===
        String(last.quotationId ?? "");

    const currentDate =
      normalizeDate(booking.date);

    const lastDate = last
      ? normalizeDate(last.toDate)
      : null;

    const isNextDay =
      lastDate !== null &&
      currentDate.getTime() -
        lastDate.getTime() ===
        24 * 60 * 60 * 1000;

    if (
      last &&
      sameSite &&
      sameCampaign &&
      sameQuotation &&
      isNextDay
    ) {
      /*
       * Extend existing booking period.
       */
      last.toDate = booking.date;
    } else {
      /*
       * Start a new booking period.
       */
      grouped.push({
        ...booking,
        fromDate: booking.date,
        toDate: booking.date,
      });
    }
  }

  /*
   * Display oldest booking first.
   */
  return grouped.sort(
    (a, b) =>
      normalizeDate(
        a.fromDate,
      ).getTime() -
      normalizeDate(
        b.fromDate,
      ).getTime(),
  );
}

function formatBookingDate(
  date: string | Date,
): string {
  return new Date(
    date,
  ).toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    },
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function AvailabilityPage() {
  const {
    sites,
    bookings,
    loading,
    bookingLoading,
    error,
    setError,
    searchAvailability,
    bookSite,
    loadBookingHistory,
  } = useBooking();

  const [city, setCity] =
    useState("");

  const [from, setFrom] =
    useState("");

  const [to, setTo] =
    useState("");

  const [
    selectedSite,
    setSelectedSite,
  ] =
    useState<AvailableSite | null>(
      null,
    );

  const [success, setSuccess] =
    useState("");

  /* ------------------------------------------------------------------------ */
  /* Group Booking History                                                    */
  /* ------------------------------------------------------------------------ */

  const groupedBookings =
    useMemo(() => {
      return groupBookings(
        bookings as BookingHistoryItem[],
      );
    }, [bookings]);

  /* ------------------------------------------------------------------------ */
  /* Load Booking History                                                     */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    loadBookingHistory().catch(() => {
      // Error is already handled inside useBooking.
    });
  }, [loadBookingHistory]);

  /* ------------------------------------------------------------------------ */
  /* Search Availability                                                      */
  /* ------------------------------------------------------------------------ */

  async function handleSearch() {
    setSuccess("");
    setError("");

    if (!city.trim()) {
      setError(
        "City is required.",
      );
      return;
    }

    if (!from || !to) {
      setError(
        "Select both a start date and an end date.",
      );
      return;
    }

    if (from > to) {
      setError(
        "End date must be on or after the start date.",
      );
      return;
    }

    try {
      await searchAvailability(
        city.trim(),
        from,
        to,
      );
    } catch {
      // Error is already handled by the hook.
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Create Booking                                                           */
  /* ------------------------------------------------------------------------ */

  async function handleBooking(
    campaignId: string,
    quotationId?: string,
  ) {
    if (!selectedSite) {
      return;
    }

    try {
      setSuccess("");
      setError("");

      await bookSite({
        siteId: selectedSite._id,
        campaignId,
        quotationId,
        from,
        to,
      });

      setSelectedSite(null);

      setSuccess(
        "Site booked successfully.",
      );

      await searchAvailability(
        city.trim(),
        from,
        to,
      );

      await loadBookingHistory();
    } catch {
      // Error is already handled by useBooking.
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl p-6">

        {/* PAGE HEADER */}

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Site Availability
          </h1>

          <p className="mt-2 text-sm text-gray-600">
            Check available sites and create bookings.
          </p>
        </div>

        {/* SEARCH */}

        <div className="mb-6">
          <AvailabilitySearch
            city={city}
            from={from}
            to={to}
            onCityChange={setCity}
            onFromChange={setFrom}
            onToChange={setTo}
            onSearch={handleSearch}
            loading={loading}
          />
        </div>

        {/* ERROR */}

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-800">
              {error}
            </p>
          </div>
        )}

        {/* SUCCESS */}

        {success && (
          <div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-semibold text-green-800">
              {success}
            </p>
          </div>
        )}

        {/* AVAILABLE SITES */}

        <AvailabilityTable
          sites={sites}
          onBook={setSelectedSite}
        />

        {/* BOOKING HISTORY */}

        <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">

          {/* Header */}

          <div className="border-b border-gray-200 p-5">
            <div className="flex items-center justify-between gap-4">

              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Booking History
                </h2>

                <p className="mt-1 text-sm text-gray-600">
                  View all booked site periods.
                </p>
              </div>

              <div className="rounded-lg bg-[#F9DADA] px-4 py-2 text-sm font-bold text-[#8B2424]">
                {groupedBookings.length}{" "}
                {groupedBookings.length === 1
                  ? "Booking"
                  : "Bookings"}
              </div>

            </div>
          </div>

          {/* Table */}

          <div className="overflow-x-auto">

            <table className="min-w-full">

              <thead className="bg-gray-100">
                <tr>

                  <th className="px-5 py-4 text-left text-xs font-bold uppercase text-gray-700">
                    Site Code
                  </th>

                  <th className="px-5 py-4 text-left text-xs font-bold uppercase text-gray-700">
                    City
                  </th>

                  <th className="px-5 py-4 text-left text-xs font-bold uppercase text-gray-700">
                    Type
                  </th>

                  <th className="px-5 py-4 text-left text-xs font-bold uppercase text-gray-700">
                    Booking Period
                  </th>

                  <th className="px-5 py-4 text-left text-xs font-bold uppercase text-gray-700">
                    Campaign ID
                  </th>

                  <th className="px-5 py-4 text-left text-xs font-bold uppercase text-gray-700">
                    Quotation ID
                  </th>

                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200">

                {groupedBookings.map(
                  (booking, index) => {
                    const site =
                      booking.siteId;

                    const populatedSite =
                      site &&
                      typeof site ===
                        "object"
                        ? site
                        : null;

                    return (
                      <tr
                        key={`${getSiteId(
                          booking,
                        )}-${String(
                          booking.fromDate,
                        )}-${String(
                          booking.campaignId,
                        )}-${index}`}
                        className="transition hover:bg-gray-50"
                      >

                        {/* SITE CODE */}

                        <td className="px-5 py-4">
                          <p className="text-sm font-bold text-gray-900">
                            {populatedSite
                              ? populatedSite.code ||
                                "-"
                              : String(
                                  site || "-",
                                )}
                          </p>
                        </td>

                        {/* CITY */}

                        <td className="px-5 py-4 text-sm text-gray-700">
                          {populatedSite
                            ? populatedSite.city ||
                              "-"
                            : "-"}
                        </td>

                        {/* TYPE */}

                        <td className="px-5 py-4">

                          {populatedSite ? (
                            <span className="rounded-md bg-[#F9DADA] px-3 py-1 text-xs font-semibold text-[#8B2424]">
                              {populatedSite.type ||
                                "-"}
                            </span>
                          ) : (
                            "-"
                          )}

                        </td>

                        {/* BOOKING PERIOD */}

                        <td className="whitespace-nowrap px-5 py-4">
                          <span className="text-sm font-semibold text-gray-900">

                            {formatBookingDate(
                              booking.fromDate,
                            )}

                            {" – "}

                            {formatBookingDate(
                              booking.toDate,
                            )}

                          </span>
                        </td>

                        {/* CAMPAIGN */}

                        <td className="px-5 py-4 text-sm text-gray-700">
                          {booking.campaignId
                            ? String(
                                booking.campaignId,
                              )
                            : "-"}
                        </td>

                        {/* QUOTATION */}

                        <td className="px-5 py-4 text-sm text-gray-700">
                          {booking.quotationId
                            ? String(
                                booking.quotationId,
                              )
                            : "—"}
                        </td>

                      </tr>
                    );
                  },
                )}

                {/* EMPTY STATE */}

                {groupedBookings.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-16 text-center"
                    >
                      <p className="text-base font-semibold text-gray-900">
                        No bookings found
                      </p>

                      <p className="mt-2 text-sm text-gray-600">
                        Confirmed site bookings will appear here.
                      </p>
                    </td>
                  </tr>
                )}

              </tbody>

            </table>

          </div>
        </div>
      </div>

      {/* BOOKING MODAL */}

      {selectedSite && (
        <BookingForm
          site={selectedSite}
          from={from}
          to={to}
          loading={bookingLoading}
          onClose={() =>
            setSelectedSite(null)
          }
          onSubmit={handleBooking}
        />
      )}

    </main>
  );
}