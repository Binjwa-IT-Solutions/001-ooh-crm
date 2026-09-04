import { z } from "zod";

const gstRegex =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const ifscRegex =
  /^[A-Z]{4}0[A-Z0-9]{6}$/;

const panRegex =
  /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export const createVendorSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Vendor name is required"),

  state: z
    .string()
    .trim()
    .min(1, "State is required"),

  city: z
    .string()
    .trim()
    .min(1, "City is required"),

  siteOwnerName: z
    .string()
    .trim()
    .optional(),

  contactPerson: z
    .string()
    .trim()
    .optional(),

  mobile: z
    .string()
    .trim()
    .optional(),

  email: z
    .string()
    .trim()
    .email("Invalid email")
    .optional()
    .or(z.literal("")),

  address: z
    .string()
    .trim()
    .optional(),

  panNumber: z
    .string()
    .trim()
    .toUpperCase()
    .refine(
      (value) =>
        value === "" ||
        panRegex.test(value),
      "Invalid PAN number",
    )
    .optional(),

  msmeNumber: z
    .string()
    .trim()
    .optional(),

  gstNumber: z
    .string()
    .trim()
    .toUpperCase()
    .refine(
      (value) =>
        value === "" ||
        gstRegex.test(value),
      "Invalid GST number",
    )
    .optional(),

  paymentTerms: z
    .string()
    .trim()
    .optional(),

  bankAccountNumber: z
    .string()
    .trim()
    .optional(),

  ifsc: z
    .string()
    .trim()
    .toUpperCase()
    .refine(
      (value) =>
        value === "" ||
        ifscRegex.test(value),
      "Invalid IFSC code",
    )
    .optional(),

  status: z
    .enum(["Active", "Inactive"])
    .optional(),
});

export const updateVendorSchema =
  createVendorSchema
    .partial()
    .refine(
      (value) =>
        Object.keys(value).length > 0,
      {
        message:
          "At least one field is required",
      },
    );

export type CreateVendorInput =
  z.infer<typeof createVendorSchema>;

export type UpdateVendorInput =
  z.infer<typeof updateVendorSchema>;