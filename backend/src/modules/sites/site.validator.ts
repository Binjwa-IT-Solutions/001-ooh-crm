
import { z } from "zod";

const mediaTypes = [
  "Billboard",
  "Hoarding",
  "Transit",
  "Metro",
  "Airport",
  "Mall",
  "Digital",
  "Other",
] as const;

const availabilityTypes = [
  "Available",
  "Booked",
] as const;

const statusTypes = [
  "Draft",
  "Pending",
  "Approved",
  "Rejected",
] as const;

/* ----------------------------------
   CREATE
----------------------------------- */

export const createSiteSchema =
  z.object({
    atrNo: z.string().optional(),

    clientName:
      z.string().min(1),

    salesPersonName:
      z.string().min(1),

    salesPersonContact:
      z.string().min(1),

    state:
      z.string().min(1),

    city:
      z.string().min(1),

    location:
      z.string().min(1),

    mediaType:
      z.enum(mediaTypes),

    quantity:
      z.coerce.number().min(1),

    startDate:
      z.string().min(1),

    endDate:
      z.string().min(1),

    duration:
      z.coerce.number().optional(),

    vendorName:
      z.string().min(1),

    availability:
      z.enum(
        availabilityTypes
      ).optional(),

    status:
      z.enum(
        statusTypes
      ).optional(),
  });

/* ----------------------------------
   UPDATE
----------------------------------- */

export const updateSiteSchema =
  z
    .object({
      atrNo:
        z.string().optional(),

      clientName:
        z.string().min(1).optional(),

      salesPersonName:
        z.string().min(1).optional(),

      salesPersonContact:
        z.string().min(1).optional(),

      state:
        z.string().min(1).optional(),

      city:
        z.string().min(1).optional(),

      location:
        z.string().min(1).optional(),

      mediaType:
        z.enum(mediaTypes).optional(),

      quantity:
        z.coerce.number().min(1).optional(),

      startDate:
        z.string().optional(),

      endDate:
        z.string().optional(),

      duration:
        z.coerce.number().optional(),

      vendorName:
        z.string().min(1).optional(),

      availability:
        z.enum(
          availabilityTypes
        ).optional(),

      status:
        z.enum(
          statusTypes
        ).optional(),
    })
    .refine(
      (data) => {
        if (
          data.startDate &&
          data.endDate
        ) {
          return (
            new Date(
              data.endDate
            ) >=
            new Date(
              data.startDate
            )
          );
        }

        return true;
      },
      {
        message:
          "End date must be on or after start date",
      }
    );

/* ----------------------------------
   QUERY
----------------------------------- */

export const siteQuerySchema =
  z.object({
    search:
      z.string().optional(),

    state:
      z.string().optional(),

    city:
      z.string().optional(),

    vendorName:
      z.string().optional(),

    salesPersonName:
      z.string().optional(),

    mediaType:
      z.enum(
        mediaTypes
      ).optional(),

    availability:
      z.enum(
        availabilityTypes
      ).optional(),

    status:
      z.enum(
        statusTypes
      ).optional(),
  });

/* ----------------------------------
   TYPES
----------------------------------- */

export type CreateSiteInput =
  z.infer<
    typeof createSiteSchema
  >;

export type UpdateSiteInput =
  z.infer<
    typeof updateSiteSchema
  >;

export type SiteQueryInput =
  z.infer<
    typeof siteQuerySchema
  >;

