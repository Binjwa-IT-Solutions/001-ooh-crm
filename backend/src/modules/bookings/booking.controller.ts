import {
  Request,
  Response,
} from "express";

import {
  createBookingSchema,
  availabilityQuerySchema,
} from "./booking.validator.js";

import * as bookingService
  from "./booking.service.js";

/* -------------------------------------------------------------------------- */
/* Create Booking                                                             */
/* -------------------------------------------------------------------------- */

export async function createBooking(
  req: Request,
  res: Response,
) {
  try {
    const data =
      createBookingSchema.parse(
        req.body,
      );

    const bookings =
      await bookingService.createBooking(
        data,
      );

    return res.status(201).json({
      success: true,
      message:
        "Site booked successfully",
      data: bookings,
    });
  } catch (error: any) {
    return res.status(409).json({
      success: false,
      message:
        error?.message ||
        "Booking failed",
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Site Availability                                                          */
/* -------------------------------------------------------------------------- */

export async function siteAvailability(
  req: Request,
  res: Response,
) {
  try {
    const query =
      availabilityQuerySchema.parse(
        req.query,
      );

    const bookings =
      await bookingService.getSiteAvailability(
        String(req.params.id),
        query.from,
        query.to,
      );

    return res.json({
      success: true,
      data: bookings,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message:
        error?.message ||
        "Failed to fetch site availability",
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Available Sites                                                            */
/* -------------------------------------------------------------------------- */

export async function availableSites(
  req: Request,
  res: Response,
) {
  try {
    const city =
      String(
        req.query.city || "",
      ).trim();

    if (!city) {
      return res.status(400).json({
        success: false,
        message: "City is required",
      });
    }

    const query =
      availabilityQuerySchema.parse(
        req.query,
      );

    const sites =
      await bookingService.getAvailableSites(
        city,
        query.from,
        query.to,
      );

    return res.json({
      success: true,
      data: sites,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message:
        error?.message ||
        "Failed to check availability",
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Booking History                                                            */
/* -------------------------------------------------------------------------- */

export async function bookingHistory(
  _req: Request,
  res: Response,
) {
  try {
    const bookings =
      await bookingService.getBookingHistory();

    return res.json({
      success: true,
      data: bookings,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message:
        error?.message ||
        "Failed to fetch booking history",
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Release Campaign Bookings                                                  */
/* -------------------------------------------------------------------------- */

export async function releaseCampaignBookings(
  req: Request,
  res: Response,
) {
  try {
    const result =
      await bookingService.releaseCampaignBookings(
        String(
          req.params.campaignId,
        ),
      );

    return res.json({
      success: true,
      message:
        "Campaign bookings released",
      data: result,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message:
        error?.message ||
        "Failed to release bookings",
    });
  }
}