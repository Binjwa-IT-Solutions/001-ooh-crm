import { api } from "@/shared/api/client";

import type {
  AvailableSite,
  Booking,
  BookingPayload,
} from "./types";

/* -------------------------------------------------------------------------- */
/* Available Sites                                                            */
/* -------------------------------------------------------------------------- */

export async function getAvailableSites(
  city: string,
  from: string,
  to: string,
): Promise<AvailableSite[]> {
  const params =
    new URLSearchParams({
      city,
      from,
      to,
    });

  const response =
    await api.get<{
      data: AvailableSite[];
    }>(
      `/api/bookings/sites/available?${params.toString()}`,
    );

  return response.data || [];
}

/* -------------------------------------------------------------------------- */
/* Site Availability                                                          */
/* -------------------------------------------------------------------------- */

export async function getSiteAvailability(
  siteId: string,
  from: string,
  to: string,
): Promise<Booking[]> {
  const params =
    new URLSearchParams({
      from,
      to,
    });

  const response =
    await api.get<{
      data: Booking[];
    }>(
      `/api/bookings/sites/${siteId}/availability?${params.toString()}`,
    );

  return response.data || [];
}

/* -------------------------------------------------------------------------- */
/* Create Booking                                                             */
/* -------------------------------------------------------------------------- */

export async function createBooking(
  data: BookingPayload,
): Promise<Booking[]> {
  const response =
    await api.post<{
      data: Booking[];
    }>(
      "/api/bookings",
      data,
    );

  return response.data || [];
}

/* -------------------------------------------------------------------------- */
/* Booking History                                                            */
/* -------------------------------------------------------------------------- */

export async function getBookingHistory(): Promise<
  Booking[]
> {
  const response =
    await api.get<{
      data: Booking[];
    }>("/api/bookings");

  return response.data || [];
}

/* -------------------------------------------------------------------------- */
/* Release Campaign Bookings                                                  */
/* -------------------------------------------------------------------------- */

export async function releaseCampaignBookings(
  campaignId: string,
) {
  const response =
    await api.delete<{
      data: {
        released: number;
      };
    }>(
      `/api/bookings/campaign/${campaignId}`,
    );

  return response.data;
}