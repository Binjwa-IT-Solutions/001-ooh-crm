
import mongoose, {
  Document,
  Schema,
} from "mongoose";

export enum MediaType {
  BILLBOARD = "Billboard",
  HOARDING = "Hoarding",
  TRANSIT = "Transit",
  METRO = "Metro",
  AIRPORT = "Airport",
  MALL = "Mall",
  DIGITAL = "Digital",
  OTHER = "Other",
}

export enum AvailabilityStatus {
  PLAN_RECEIVED = "Plan Received",
  ON_BOARDING = "On Boarding",
  MEDIA_BOOKING = "Media Booking",
  NEGOTIATION = "Negotiation",
  AVAILABLE = "Available",
  REQUEST_SEND = "Request Send",
  REQUEST = "Request",
  SEND = "Send",
  BOOKED = "Booked",
}

export enum ATRStatus {
  DRAFT = "Draft",
  PENDING = "Pending",
  APPROVED = "Approved",
  REJECTED = "Rejected",
  ON_CALL = "On Call",
  ON_MAIL = "On Mail",
  WHATSAPP = "WhatsApp",
  MANUAL = "Manual",
}

export interface ISite extends Document {
  atrNo: string;

  clientName: string;

  salesPersonName: string;
  salesPersonContact?: string;

  state: string;
  city: string;
  location: string;

  mediaType: MediaType;

  quantity: number;

  startDate: Date;
  endDate: Date;
  duration: number;

  vendorName: string;
  vendorContact?: string;

  availability: AvailabilityStatus | string;
  status: ATRStatus | string;

  createdAt: Date;
  updatedAt: Date;

  deletedAt: Date | null;
}

const siteSchema =
  new Schema<ISite>(
    {
      atrNo: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true,
      },

      clientName: {
        type: String,
        required: true,
        trim: true,
      },

      salesPersonName: {
        type: String,
        required: true,
        trim: true,
      },

      salesPersonContact: {
        type: String,
        required: false,
        trim: true,
        default: "",
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

      location: {
        type: String,
        required: true,
        trim: true,
      },

      mediaType: {
        type: String,
        enum: Object.values(MediaType),
        required: true,
      },

      quantity: {
        type: Number,
        required: true,
        min: 0,
      },

      startDate: {
        type: Date,
        required: true,
      },

      endDate: {
        type: Date,
        required: true,
      },

      duration: {
        type: Number,
        required: true,
        min: 1,
      },

      vendorName: {
        type: String,
        required: true,
        trim: true,
      },

      vendorContact: {
        type: String,
        required: false,
        trim: true,
        default: "",
      },

      availability: {
        type: String,
        default: AvailabilityStatus.AVAILABLE,
      },

      status: {
        type: String,
        default: ATRStatus.ON_CALL,
      },

      deletedAt: {
        type: Date,
        default: null,
      },
    },
    {
      timestamps: true,
    }
  );

export const Site =
  mongoose.model<ISite>(
    "Site",
    siteSchema
  );

// Backward compatibility
export const MediaPlanStatus =
  ATRStatus;

