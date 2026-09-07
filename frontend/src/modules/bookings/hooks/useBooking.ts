"use client";

import {
  useCallback,
  useState,
} from "react";

import {
  getAvailableSites,
  createBooking,
  releaseCampaignBookings,
  getBookingHistory,
} from "../api";

import type {
  AvailableSite,
  Booking,
  BookingPayload,
} from "../types";

export function useBooking() {
  const [sites, setSites] =
    useState<AvailableSite[]>([]);

  const [bookings, setBookings] =
    useState<Booking[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [bookingLoading, setBookingLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  /* ------------------------------------------------------------------------ */
  /* Search Availability                                                      */
  /* ------------------------------------------------------------------------ */

  const searchAvailability =
    useCallback(
      async (
        city: string,
        from: string,
        to: string,
      ) => {
        try {
          setLoading(true);
          setError("");

          const result =
            await getAvailableSites(
              city,
              from,
              to,
            );

          setSites(result);

          return result;
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Failed to check availability";

          setError(message);

          throw error;
        } finally {
          setLoading(false);
        }
      },
      [],
    );

  /* ------------------------------------------------------------------------ */
  /* Create Booking                                                           */
  /* ------------------------------------------------------------------------ */

  const bookSite =
    useCallback(
      async (
        data: BookingPayload,
      ) => {
        try {
          setBookingLoading(true);
          setError("");

          const result =
            await createBooking(data);

          return result;
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Booking failed";

          setError(message);

          throw error;
        } finally {
          setBookingLoading(false);
        }
      },
      [],
    );

  /* ------------------------------------------------------------------------ */
  /* Load Booking History                                                    */
  /* ------------------------------------------------------------------------ */

  const loadBookingHistory =
    useCallback(async () => {
      try {
        setLoading(true);
        setError("");

        const result =
          await getBookingHistory();

        setBookings(result);

        return result;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to load booking history";

        setError(message);

        throw error;
      } finally {
        setLoading(false);
      }
    }, []);

  /* ------------------------------------------------------------------------ */
  /* Release Bookings                                                         */
  /* ------------------------------------------------------------------------ */

  const releaseBookings =
    useCallback(
      async (
        campaignId: string,
      ) => {
        try {
          setLoading(true);
          setError("");

          return await releaseCampaignBookings(
            campaignId,
          );
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Failed to release bookings";

          setError(message);

          throw error;
        } finally {
          setLoading(false);
        }
      },
      [],
    );

  return {
    sites,
    bookings,
    loading,
    bookingLoading,
    error,

    searchAvailability,
    bookSite,
    loadBookingHistory,
    releaseBookings,

    setError,
  };
}