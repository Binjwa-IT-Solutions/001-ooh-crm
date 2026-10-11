import { z } from "zod";

export const createProofSchema =
  z.object({
    lat: z.coerce
      .number()
      .min(-90)
      .max(90)
      .optional()
      .default(22.7196),

    lng: z.coerce
      .number()
      .min(-180)
      .max(180)
      .optional()
      .default(75.8577),

    gpsAccuracy: z.coerce
      .number()
      .positive()
      .optional()
      .default(15),

    capturedAt: z
      .string()
      .optional()
      .default(() => new Date().toISOString()),

    deviceInfo:
      z.string().optional(),

    locationName:
      z.string().optional(),

    campaignId:
      z.string().optional(),

    vendorId:
      z.string().optional(),
  });

export const generateProofLinkSchema =
  z.object({
    campaignId:
      z.string().optional(),

    vendorId:
      z.string().optional(),
  });

export const proofQuerySchema =
  z.object({
    taskId:
      z.string().optional(),

    campaignId:
      z.string().optional(),

    vendorId:
      z.string().optional(),

    atrId:
      z.string().optional(),

    status:
      z.enum([
        "Pending",
        "Approved",
        "Complete",
        "Rejected",
      ]).optional(),

    uploadedBy:
      z.string().optional(),
  });

export const reviewProofSchema =
  z
    .object({
      status: z.enum([
        "Approved",
        "Complete",
        "Rejected",
      ]),

      rejectionReason:
        z.string().optional(),
    })
    .superRefine(
      (data, ctx) => {
        if (
          data.status ===
            "Rejected" &&
          (!data.rejectionReason ||
            data.rejectionReason.trim()
              .length < 10)
        ) {
          ctx.addIssue({
            code: "custom",
            path: [
              "rejectionReason",
            ],
            message:
              "Rejection reason must be at least 10 characters",
          });
        }
      }
    );