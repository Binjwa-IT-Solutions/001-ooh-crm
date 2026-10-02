import { Schema, model, Types } from "mongoose";
import { basePlugin, type BaseDocument } from "../../core/db/basePlugin.js";

export enum CampaignStatus {
  IN_PROGRESS = "In Progress",
  CAMPAIGN_LIVE = "Campaign Live",
  CAMPAIGN_END = "Campaign End",
  REJECTED = "Rejected",
  DRAFT = "Draft",
  APPROVED = "Approved",
  INPROGRESS = "InProgress",
  COMPLETED = "Completed",
  CANCELLED = "Cancelled",
}

export interface ICampaign extends BaseDocument {
  campaignCode: string;
  name: string;

  leadId: Types.ObjectId;
  quotationId?: Types.ObjectId;
  quotationNo?: string;
  quotationName?: string;
  piNo?: string;

  state?: string;
  city: string;

  startDate: Date;
  endDate: Date;

  siteIds: Types.ObjectId[];

  // All money is stored in paise.
  contractedValue: number;

  status: CampaignStatus;

  assignedManager?: Types.ObjectId;
}

const campaignSchema = new Schema<ICampaign>(
  {
    campaignCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    leadId: {
      type: Schema.Types.ObjectId,
      ref: "Lead",
      required: true,
      index: true,
    },

    quotationId: {
      type: Schema.Types.ObjectId,
      ref: "Quotation",
      required: false,
      sparse: true,
      index: true,
    },

    quotationNo: {
      type: String,
      trim: true,
      default: "",
    },

    quotationName: {
      type: String,
      trim: true,
      default: "",
    },

    piNo: {
      type: String,
      trim: true,
      default: "",
    },

    state: {
      type: String,
      trim: true,
      default: "",
    },
    city: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
      required: true,
    },

    siteIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Site",
      },
    ],

    contractedValue: {
      type: Number,
      required: true,
      min: 0,
    },

    status: {
      type: String,
      enum: Object.values(CampaignStatus),
      default: CampaignStatus.IN_PROGRESS,
      required: true,
      index: true,
    },

    assignedManager: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: undefined,
      index: true,
    },
  }
);

campaignSchema.plugin(basePlugin);

campaignSchema.index({
  status: 1,
  city: 1,
  startDate: 1,
  endDate: 1,
});

campaignSchema.pre("validate", function () {
  if (this.startDate && this.endDate) {
    if (this.endDate <= this.startDate) {
      throw new Error("endDate must be after startDate");
    }
  }
});

export const Campaign = model<ICampaign>(
  "Campaign",
  campaignSchema,
);

export default Campaign;
