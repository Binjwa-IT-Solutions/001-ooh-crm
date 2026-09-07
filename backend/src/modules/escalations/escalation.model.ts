import {
  Schema,
  model,
  type Document,
} from "mongoose";

export type EscalationLevel =
  | "L1"
  | "L2"
  | "L3";

export interface EscalationDocument
  extends Document {
  taskId: Schema.Types.ObjectId;
  level: EscalationLevel;
  triggeredAt: Date;
  notifiedUserIds: Schema.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const escalationSchema =
  new Schema<EscalationDocument>(
    {
      taskId: {
        type: Schema.Types.ObjectId,
        ref: "Task",
        required: true,
        index: true,
      },

      level: {
        type: String,
        enum: ["L1", "L2", "L3"],
        required: true,
      },

      triggeredAt: {
        type: Date,
        required: true,
        default: Date.now,
      },

      notifiedUserIds: [
        {
          type: Schema.Types.ObjectId,
          required: true,
        },
      ],
    },
    {
      timestamps: true,
    },
  );

escalationSchema.index(
  {
    taskId: 1,
    level: 1,
  },
  {
    unique: true,
  },
);

export const EscalationModel = model<EscalationDocument>(
    "Escalation",
    escalationSchema,
  );