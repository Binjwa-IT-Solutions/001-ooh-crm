import {
  Model,
  Schema,
  Types,
  model,
} from "mongoose";

import {
  basePlugin,
  type BaseDocument,
} from "../../core/db/basePlugin.js";

/* ----------------------------------
   SITE TYPE
----------------------------------- */

export enum SiteType {
  AIRPORT = "Airport",
  HIGHWAY = "Highway",
  MALL = "Mall",
  METRO = "Metro",
  MARKET = "Market",
  OTHER = "Other",
}

/* ----------------------------------
   SITE STATUS
----------------------------------- */

export enum SiteStatus {
  ACTIVE = "Active",
  MAINTENANCE = "Maintenance",
  INACTIVE = "Inactive",
}

/* ----------------------------------
   GPS
----------------------------------- */

export interface IGps {
  lat: number;
  lng: number;
}

/* ----------------------------------
   SITE
----------------------------------- */

export interface ISite extends BaseDocument {
  code: string;
  city: string;
  type: SiteType;
  address?: string;

  /*
   * GPS coordinates selected from
   * browser/device location.
   */
  gps: IGps;

  /*
   * Availability window for this site.
   */
  startDate: Date;
  endDate: Date;

  sizeWidth: number;
  sizeHeight: number;

  // Amount stored in paise
  baseCostPerDay: number;

  vendorId?: Types.ObjectId | null;

  status: SiteStatus;

  photos: string[];
}

/* ----------------------------------
   GPS SCHEMA
----------------------------------- */

const gpsSchema = new Schema<IGps>(
  {
    lat: {
      type: Number,
      required: true,
      min: -90,
      max: 90,
    },

    lng: {
      type: Number,
      required: true,
      min: -180,
      max: 180,
    },
  },
  {
    _id: false,
  }
);

/* ----------------------------------
   SITE SCHEMA
----------------------------------- */

const siteSchema = new Schema<ISite>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      index: true,
      uppercase: true,
      trim: true,
    },

    city: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },

    type: {
      type: String,
      enum: Object.values(SiteType),
      required: true,
    },

    address: {
      type: String,
      trim: true,
    },

    /*
     * GPS is required.
     *
     * Frontend should obtain these values
     * using browser/device GPS.
     */
    gps: {
      type: gpsSchema,
      required: true,
    },

    /*
     * Availability window.
     */
    startDate: {
      type: Date,
      required: true,
      index: true,
    },

    endDate: {
      type: Date,
      required: true,
      index: true,
    },

    sizeWidth: {
      type: Number,
      required: true,
      min: 0,
    },

    sizeHeight: {
      type: Number,
      required: true,
      min: 0,
    },

    baseCostPerDay: {
      type: Number,
      required: true,
      min: 0,
    },

    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      default: null,
    },

    status: {
      type: String,
      enum: Object.values(SiteStatus),
      default: SiteStatus.ACTIVE,
      index: true,
    },

    photos: {
      type: [String],
      default: [],
    },
  }
);

siteSchema.plugin(basePlugin);

export const Site: Model<ISite> =
  model<ISite>("Site", siteSchema);