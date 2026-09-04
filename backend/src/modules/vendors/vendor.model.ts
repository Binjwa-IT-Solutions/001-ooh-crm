import mongoose, { Schema } from "mongoose";
import { basePlugin, type BaseDocument } from "../../core/db/basePlugin.js";

export type VendorStatus =
  | "Active"
  | "Inactive";

export interface IVendor extends BaseDocument {
  name: string;
  state: string;
  city: string;
  siteOwnerName?: string;
  contactPerson?: string;
  mobile?: string;
  email?: string;
  address?: string;
  panNumber?: string;
  msmeNumber?: string;
  gstNumber?: string;
  paymentTerms?: string;
  bankAccountNumber?: string;
  ifsc?: string;
  status: VendorStatus;
}

const vendorSchema = new Schema<IVendor>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    state: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    city: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    siteOwnerName: {
      type: String,
      trim: true,
    },

    contactPerson: {
      type: String,
      trim: true,
    },

    mobile: {
      type: String,
      trim: true,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
    },

    address: {
      type: String,
      trim: true,
    },

    panNumber: {
      type: String,
      trim: true,
      uppercase: true,
    },

    msmeNumber: {
      type: String,
      trim: true,
      uppercase: true,
    },

    gstNumber: {
      type: String,
      trim: true,
      uppercase: true,
    },

    paymentTerms: {
      type: String,
      trim: true,
    },

    bankAccountNumber: {
      type: String,
      trim: true,
    },

    ifsc: {
      type: String,
      trim: true,
      uppercase: true,
    },

    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
      index: true,
    },
  }
);

vendorSchema.plugin(basePlugin);

vendorSchema.index({
  state: 1,
  city: 1,
});

export const Vendor =
  mongoose.model<IVendor>(
    "Vendor",
    vendorSchema,
  );