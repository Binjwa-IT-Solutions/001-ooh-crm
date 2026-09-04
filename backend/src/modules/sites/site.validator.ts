import { z } from "zod";

import {
  SiteStatus,
  SiteType,
} from "./site.model.js";

/* ----------------------------------
   GPS VALIDATOR
----------------------------------- */

const gpsSchema = z.object({
  lat: z
    .number({
      message: "Latitude must be a number",
    })
    .min(-90, "Invalid latitude")
    .max(90, "Invalid latitude"),

  lng: z
    .number({
      message: "Longitude must be a number",
    })
    .min(-180, "Invalid longitude")
    .max(180, "Invalid longitude"),
});

/* ----------------------------------
   DATE VALIDATOR
----------------------------------- */

const dateSchema = z.coerce.date({
  message: "Valid date is required",
});

/* ----------------------------------
   CREATE SITE
----------------------------------- */

export const createSiteSchema = z.object({
  city: z
    .string()
    .trim()
    .min(2, "City is required"),

  type: z.nativeEnum(SiteType),

  address: z
    .string()
    .trim()
    .optional(),

  /*
   * GPS comes from browser/device location.
   *
   * Example:
   * {
   *   lat: 22.7196,
   *   lng: 75.8577
   * }
   */
  gps: gpsSchema,

  /*
   * Availability window.
   *
   * Frontend can send:
   * "2026-09-01" to "2026-12-31"
   */
  startDate: dateSchema,
  endDate: dateSchema,

  sizeWidth: z
    .number()
    .positive("Width must be greater than 0"),

  sizeHeight: z
    .number()
    .positive("Height must be greater than 0"),

  baseCostPerDay: z
    .number()
    .int("Cost must be an integer")
    .nonnegative("Cost cannot be negative"),

  vendorId: z
    .string()
    .nullable()
    .optional(),

  status: z
    .nativeEnum(SiteStatus)
    .optional(),

  photos: z
    .array(z.string())
    .optional(),
});

/* ----------------------------------
   UPDATE SITE
----------------------------------- */

export const updateSiteSchema =
  createSiteSchema.partial();

/* ----------------------------------
   SITE QUERY
----------------------------------- */

export const siteQuerySchema = z.object({
  city: z
    .string()
    .optional(),

  type: z
    .nativeEnum(SiteType)
    .optional(),

  status: z
    .nativeEnum(SiteStatus)
    .optional(),

  search: z
    .string()
    .optional(),
});

/* ----------------------------------
   TYPES
----------------------------------- */

export type CreateSiteInput =
  z.infer<typeof createSiteSchema>;

export type UpdateSiteInput =
  z.infer<typeof updateSiteSchema>;