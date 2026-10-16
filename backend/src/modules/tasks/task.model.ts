import { Schema, model, Types } from "mongoose";
import { basePlugin, type BaseDocument } from "../../core/db/basePlugin.js";

export type TaskType =
  | "Printing"
  | "Installation"
  | "Verification"
  | "Removal"
  | "Custom";

export type TaskStatus =
  | "Pending"
  | "InProgress"
  | "Completed";

export interface ITask extends BaseDocument {
  campaignId: Types.ObjectId;
  siteId: Types.ObjectId;
  title: string;
  type: TaskType;
  assignedTo?: Types.ObjectId | null;
  deadline: Date;
  status: TaskStatus;
  proofRequired: boolean;
  proofId?: Types.ObjectId | null;
  completedAt?: Date | null;
}

const taskSchema = new Schema<ITask>(
  {
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
      index: true,
    },

    siteId: {
      type: Schema.Types.ObjectId,
      ref: "Site",
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      enum: [
        "Printing",
        "Installation",
        "Verification",
        "Removal",
        "Custom",
      ],
      required: true,
    },

    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },

    deadline: {
      type: Date,
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: [
        "Pending",
        "InProgress",
        "Completed",
      ],
      default: "Pending",
    },

    proofRequired: {
      type: Boolean,
      default: false,
    },

    proofId: {
      type: Schema.Types.ObjectId,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },
  }
);

taskSchema.plugin(basePlugin);

taskSchema.index({
  campaignId: 1,
  siteId: 1,
  type: 1,
});

export const Task = model<ITask>(
  "Task",
  taskSchema,
);