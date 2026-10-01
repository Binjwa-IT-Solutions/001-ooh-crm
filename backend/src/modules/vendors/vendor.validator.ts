import { z } from "zod";

const gstRegex =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const panRegex =
  /^[A-Z]{5}[0-9]{4}[A-Z]$/;

const ifscRegex =
  /^[A-Z]{4}0[A-Z0-9]{6}$/;

const contactSchema = z.object({
  name: z.string().trim().min(1),

  email: z
    .string()
    .email()
    .optional()
    .or(z.literal("")),

  phone: z.string().optional(),
});

const bankSchema = z.object({
  accountHolder: z.string().optional(),

  bankName: z.string().optional(),

  accountNumber: z.string().optional(),

  ifsc: z
    .string()
    .toUpperCase()
    .refine(
      (v) => !v || ifscRegex.test(v),
      "Invalid IFSC code",
    )
    .optional(),

  branch: z.string().optional(),
});

const documentSchema = z.object({
  type: z.enum([
    "GST Certificate",
    "Bank Proof",
    "Business License",
    "MSME Certificate",
    "PAN",
    "UDYAM Registration",
    "Company Documentation",
    "Other",
  ]),

  name: z.string().min(1),

  url: z.string().optional(),

  fileKey: z.string().optional(),
});

export const createVendorSchema = z.object({
  name: z.string().trim().min(1),

  vendorType: z.enum([
    "Individual",
    "Partnership",
    "Company",
    "MSME",
    "Others",
  ]),

  registrationStatus: z
    .enum([
      "Registered",
      "Unregistered",
      "Pending",
    ])
    .default("Pending"),

  gstNumber: z
    .string()
    .toUpperCase()
    .refine(
      (v) => !v || gstRegex.test(v),
      "Invalid GST number",
    )
    .optional(),

  panNumber: z
    .string()
    .toUpperCase()
    .refine(
      (v) => !v || panRegex.test(v),
      "Invalid PAN number",
    )
    .optional(),

  msmeRegistered: z
    .boolean()
    .default(false),

  msmeNumber: z.string().optional(),

  udyamRegistration: z
    .string()
    .optional(),

  bankDetails: bankSchema.default({}),

  paymentTerms: z
    .string()
    .optional(),

  state: z
    .string()
    .optional(),

  citiesServed: z
    .union([
      z.array(z.string()),

      z
        .string()
        .transform((str) =>
          str.split(","),
        ),
    ])
    .transform((val) =>
      Array.from(
        new Set(
          (Array.isArray(val)
            ? val
            : [val]
          )
            .map((city) =>
              typeof city === "string"
                ? city.trim()
                : "",
            )
            .filter(Boolean),
        ),
      ),
    )
    .default([]),

  primaryContact: contactSchema,

  secondaryContacts: z
    .array(contactSchema)
    .default([]),

  vendorRating: z
    .number()
    .min(1)
    .max(5)
    .optional(),

  documents: z
    .array(documentSchema)
    .default([]),

  status: z
    .enum([
      "Active",
      "Inactive",
      "Blacklist",
    ])
    .default("Active"),
});

export const updateVendorSchema =
  createVendorSchema
    .partial()
    .refine(
      (data) =>
        Object.keys(data).length > 0,
      {
        message:
          "At least one field is required",
      },
    );

export type CreateVendorInput =
  z.infer<typeof createVendorSchema>;

export type UpdateVendorInput =
  z.infer<typeof updateVendorSchema>;