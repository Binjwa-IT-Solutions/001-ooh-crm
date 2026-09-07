import { Router } from "express";

import {
  requireAuth,
} from "../../core/auth/auth-middleware.js";

import {
  requirePermission,
} from "../../core/rbac/index.js";

import {
  createBooking,
  siteAvailability,
  availableSites,
  releaseCampaignBookings,
  bookingHistory,
} from "./booking.controller.js";

const router = Router();

router.use(requireAuth);

/* -------------------------------------------------------------------------- */
/* Booking History                                                            */
/* -------------------------------------------------------------------------- */

router.get(
  "/",
  requirePermission("sites.view"),
  bookingHistory,
);

/* -------------------------------------------------------------------------- */
/* Site Availability                                                          */
/* -------------------------------------------------------------------------- */

router.get(
  "/sites/available",
  requirePermission("sites.view"),
  availableSites,
);

router.get(
  "/sites/:id/availability",
  requirePermission("sites.view"),
  siteAvailability,
);

/* -------------------------------------------------------------------------- */
/* Create Booking                                                             */
/* -------------------------------------------------------------------------- */

router.post(
  "/",
  requirePermission("bookings.manage"),
  createBooking,
);

/* -------------------------------------------------------------------------- */
/* Release Campaign Bookings                                                  */
/* -------------------------------------------------------------------------- */

router.delete(
  "/campaign/:campaignId",
  requirePermission("bookings.manage"),
  releaseCampaignBookings,
);

export default router;