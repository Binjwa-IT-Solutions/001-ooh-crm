import mongoose, {
  Document,
  Schema,
} from "mongoose";

export type ProofStatus =
  | "Pending"
  | "Approved"
  | "Complete"
  | "Rejected";

export interface IProof extends Document {
  taskId?: mongoose.Types.ObjectId;
  campaignId?: mongoose.Types.ObjectId;
  vendorId?: mongoose.Types.ObjectId;
  atrId?: mongoose.Types.ObjectId;

  originalImageKey?: string;
  locationName?: string;

  gps?: {
    lat: number;
    lng: number;
  };

  gpsAccuracy?: number;

  capturedAt?: Date;

  uploadedBy?: mongoose.Types.ObjectId;

  deviceInfo?: string;

  status?: ProofStatus;

  watermarkedImageKey?: string;
  watermarkedAt?: Date;

  rejectionReason?: string;

  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;

  proofLinkToken?: string;
  proofLinkUses?: number;
  proofLinkMaxUses?: number;
  proofLinkActive?: boolean;
  proofLinkCreatedBy?: mongoose.Types.ObjectId;
}

const proofSchema =
  new Schema<IProof>(
    {
      taskId: {
        type: Schema.Types.ObjectId,
        index: true,
      },

      campaignId: {
        type: Schema.Types.ObjectId,
        ref: "Campaign",
        index: true,
      },

      vendorId: {
        type: Schema.Types.ObjectId,
        ref: "Vendor",
        index: true,
      },

      atrId: {
        type: Schema.Types.ObjectId,
        index: true,
      },

      originalImageKey: {
        type: String,
      },

      locationName: {
        type: String,
      },

      gps: {
        lat: Number,
        lng: Number,
      },

      gpsAccuracy: Number,

      capturedAt: Date,

      uploadedBy: {
        type: Schema.Types.ObjectId,
      },

      deviceInfo: String,

      status: {
        type: String,
        enum: [
          "Pending",
          "Approved",
          "Complete",
          "Rejected",
        ],
        default: "Pending",
        index: true,
      },

      watermarkedImageKey: String,

      watermarkedAt: Date,

      rejectionReason: String,

      reviewedBy: {
        type: Schema.Types.ObjectId,
      },

      reviewedAt: Date,

      proofLinkToken: {
        type: String,
        unique: true,
        sparse: true,
        index: true,
      },

      proofLinkUses: {
        type: Number,
        default: 0,
      },

      proofLinkMaxUses: {
        type: Number,
        default: 2,
      },

      proofLinkActive: {
        type: Boolean,
        default: true,
        index: true,
      },

      proofLinkCreatedBy: {
        type: Schema.Types.ObjectId,
      },
    },
    {
      timestamps: true,
    }
  );

export const Proof =
  mongoose.model<IProof>(
    "Proof",
    proofSchema
  );