import mongoose, { Schema } from "mongoose";

import {
  basePlugin,
  type BaseDocument,
} from "../../core/db/basePlugin.js";

export type VendorStatus =
  | "Active"
  | "Inactive"
  | "Blacklist";

export type RegistrationStatus =
  | "Registered"
  | "Unregistered"
  | "Pending";

export type VendorType =
  | "Individual"
  | "Partnership"
  | "Company"
  | "MSME"
  | "Others";

export interface IVendor extends BaseDocument {
  name: string;

  vendorType: VendorType;

  registrationStatus: RegistrationStatus;

  gstNumber?: string;
  panNumber?: string;

  msmeRegistered: boolean;
  msmeNumber?: string;
  udyamRegistration?: string;

  bankDetails: {
    accountHolder?: string;
    bankName?: string;
    accountNumber?: string;
    ifsc?: string;
    branch?: string;
  };

  paymentTerms?: string;
  state?: string;

  citiesServed: string[];

  primaryContact: {
    name: string;
    email?: string;
    phone?: string;
  };

  secondaryContacts: {
    name: string;
    email?: string;
    phone?: string;
  }[];

  vendorRating?: number;

  documents: {
    type: string;
    name: string;
    url?: string;
    fileKey?: string;
  }[];

  status: VendorStatus;
}

const contactSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
    },

    phone: {
      type: String,
      trim: true,
    },
  },
  { _id: false },
);

const bankSchema = new Schema(
  {
    accountHolder: String,
    bankName: String,
    accountNumber: String,

    ifsc: {
      type: String,
      uppercase: true,
    },

    branch: String,
  },
  { _id: false },
);

const documentSchema = new Schema({
  type: {
    type: String,
    enum: [
      "GST Certificate",
      "Bank Proof",
      "Business License",
      "MSME Certificate",
      "PAN",
      "UDYAM Registration",
      "Company Documentation",
      "Other",
    ],
    required: true,
  },

  name: {
    type: String,
    required: true,
  },

  url: String,
  fileKey: String,
});

const vendorSchema = new Schema<IVendor>({
  name: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },

  vendorType: {
    type: String,
    enum: [
      "Individual",
      "Partnership",
      "Company",
      "MSME",
      "Others",
    ],
    required: true,
  },

  registrationStatus: {
    type: String,
    enum: [
      "Registered",
      "Unregistered",
      "Pending",
    ],
    default: "Pending",
    index: true,
  },

  gstNumber: {
    type: String,
    uppercase: true,
    trim: true,
  },

  panNumber: {
    type: String,
    uppercase: true,
    trim: true,
  },

  msmeRegistered: {
    type: Boolean,
    default: false,
  },

  msmeNumber: {
    type: String,
    uppercase: true,
    trim: true,
  },

  udyamRegistration: {
    type: String,
    uppercase: true,
    trim: true,
  },

  bankDetails: {
    type: bankSchema,
    default: {},
  },

  paymentTerms: {
    type: String,
    trim: true,
  },

  state: {
    type: String,
    trim: true,
    index: true,
  },

  citiesServed: {
    type: [String],
    default: [],
  },

  primaryContact: {
    type: contactSchema,
    required: true,
  },

  secondaryContacts: {
    type: [contactSchema],
    default: [],
  },

  vendorRating: {
    type: Number,
    min: 1,
    max: 5,
  },

  documents: {
    type: [documentSchema],
    default: [],
  },

  status: {
    type: String,
    enum: [
      "Active",
      "Inactive",
      "Blacklist",
    ],
    default: "Active",
    index: true,
  },
});

vendorSchema.plugin(basePlugin);

vendorSchema.index({
  name: "text",
  gstNumber: "text",
  panNumber: "text",
  state: "text",
});

vendorSchema.index({
  citiesServed: 1,
});

export const Vendor = mongoose.model<IVendor>(
  "Vendor",
  vendorSchema,
);