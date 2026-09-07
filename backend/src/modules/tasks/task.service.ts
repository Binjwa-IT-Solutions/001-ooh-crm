import { Types } from "mongoose";
import {
  Task,
  TaskStatus,
  TaskType,
} from "./task.model.js";
import { TaskTemplate } from "./task-template.model.js";

interface TaskContext {
  userId?: string;
  role?: string;
}

export async function generateForCampaign(
  campaign: any,
  _ctx: TaskContext,
) {
  if (!campaign?._id) {
    throw new Error(
      "Campaign is required.",
    );
  }

  if (campaign.status !== "Approved") {
    throw new Error(
      "Tasks can only be generated for an approved campaign.",
    );
  }

  /*
   * Idempotency:
   * If tasks already exist for this campaign,
   * do not create them again.
   */
  const existing = await Task.exists({
    campaignId: campaign._id,
  });

  if (existing) {
    return Task.find({
      campaignId: campaign._id,
    });
  }

  const templates =
    await TaskTemplate.find({
      active: true,
    }).lean();

  if (!templates.length) {
    throw new Error(
      "No active task templates found.",
    );
  }

  const tasks: any[] = [];

  /*
   * One complete task set per site.
   */
  for (const siteId of campaign.siteIds) {
    const normalizedSiteId =
      typeof siteId === "object"
        ? siteId._id
        : siteId;

    for (const template of templates) {
      const deadline = new Date(
        campaign.startDate,
      );

      deadline.setDate(
        deadline.getDate() +
          template.offsetDays,
      );

      tasks.push({
        campaignId: campaign._id,
        siteId: normalizedSiteId,
        title: template.title,
        type: template.type,
        deadline,
        status: "Pending",
        proofRequired:
          template.proofRequired ?? false,
        assignedTo: null,
      });
    }
  }

  if (!tasks.length) {
    return [];
  }

  return Task.insertMany(tasks);
}

export async function getTasks(
  filter: Record<string, unknown> = {},
) {
  const tasks = await Task.find(filter)
    .populate(
      "campaignId",
      "campaignCode name city startDate endDate",
    )
    .populate(
      "siteId",
      "code city type address sizeWidth sizeHeight",
    )
    .populate(
      "assignedTo",
      "name email",
    )
    .sort({
      deadline: 1,
    })
    .lean();

  return tasks.map((task) => {
    let status: string = task.status;

    if (
      task.status !== "Completed" &&
      new Date(task.deadline) < new Date()
    ) {
      status = "Overdue";
    }

    return {
      ...task,
      status,
    };
  });
}

export async function getTasksByCampaign(
  campaignId: string,
) {
  if (!Types.ObjectId.isValid(campaignId)) {
    throw new Error(
      "Invalid campaign ID.",
    );
  }

  return getTasks({
    campaignId,
  });
}

export async function updateTask(
  taskId: string,
  data: {
    status?: TaskStatus;
    assignedTo?: string;
  },
) {
  if (!Types.ObjectId.isValid(taskId)) {
    throw new Error(
      "Invalid task ID.",
    );
  }

  const update: Record<string, unknown> = {
    ...data,
  };

  if (data.status === "Completed") {
    update.completedAt = new Date();
  }

  if (
    data.status &&
    data.status !== "Completed"
  ) {
    update.completedAt = null;
  }

  return Task.findByIdAndUpdate(
    taskId,
    update,
    {
      returnDocument: "after",
      runValidators: true,
    },
  )
    .populate(
      "campaignId",
      "campaignCode name",
    )
    .populate(
      "siteId",
      "code city type",
    )
    .populate(
      "assignedTo",
      "name email",
    );
}

export async function createTaskTemplate(
  data: {
    type: TaskType;
    title: string;
    offsetDays: number;
    proofRequired?: boolean;
    role?: string;
    active?: boolean;
  },
) {
  return TaskTemplate.create(data);
}

export async function getTaskTemplates() {
  return TaskTemplate.find()
    .sort({
      type: 1,
      offsetDays: 1,
    })
    .lean();
}