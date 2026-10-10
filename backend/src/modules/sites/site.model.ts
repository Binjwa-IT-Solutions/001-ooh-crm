
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
  AVAILABLE = "Available",
  BOOKED = "Booked",
}

export enum ATRStatus {
  DRAFT = "Draft",
  PENDING = "Pending",
  APPROVED = "Approved",
  REJECTED = "Rejected",
}

export interface ISite extends Document {
  atrNo: string;

  clientName: string;

  salesPersonName: string;
  salesPersonContact: string;

  state: string;
  city: string;
  location: string;

  mediaType: MediaType;

  quantity: number;

  startDate: Date;
  endDate: Date;
  duration: number;

  vendorName: string;

  availability: AvailabilityStatus;
  status: ATRStatus;

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
        min: 1,
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

      availability: {
        type: String,
        enum: Object.values(
          AvailabilityStatus
        ),
        default:
          AvailabilityStatus.AVAILABLE,
      },

      status: {
        type: String,
        enum: Object.values(ATRStatus),
        default: ATRStatus.DRAFT,
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

