import { Request, Response } from "express";

import {
  createTaskTemplate,
  generateForCampaign,
  getTaskTemplates,
  getTasks,
  getTasksByCampaign,
  updateTask,
} from "./task.service.js";

import {
  createTaskTemplateSchema,
  updateTaskSchema,
} from "./task.validator.js";

function getQueryString(
  value: unknown,
): string | undefined {
  if (Array.isArray(value)) {
    const first = value[0];

    return typeof first === "string"
      ? first
      : undefined;
  }

  return typeof value === "string"
    ? value
    : undefined;
}

export async function getTasksController(
  req: Request,
  res: Response,
) {
  try {
    const campaignId =
      getQueryString(
        req.query.campaignId,
      );

    const assignedTo =
      getQueryString(
        req.query.assignedTo,
      );

    const status =
      getQueryString(
        req.query.status,
      );

    const filter: Record<
      string,
      unknown
    > = {};

    if (campaignId) {
      filter.campaignId = campaignId;
    }

    if (assignedTo) {
      filter.assignedTo = assignedTo;
    }

    /*
     * Overdue is computed by service.
     * We don't store Overdue in MongoDB.
     */
    if (
      status &&
      status !== "Overdue"
    ) {
      filter.status = status;
    }

    const ctx = (req as any).ctx || ((req as any).user ? { user: (req as any).user } : undefined);
    const tasks = await getTasks(filter, ctx);

    const result =
      status === "Overdue"
        ? tasks.filter(
            (task) =>
              task.status === "Overdue",
          )
        : tasks;

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch tasks.",
    });
  }
}

export async function getCampaignTasksController(
  req: Request,
  res: Response,
) {
  try {
    const tasks =
      await getTasksByCampaign(
        req.params.id as string,
      );

    return res.json({
      success: true,
      data: tasks,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch campaign tasks.",
    });
  }
}

export async function updateTaskController(
  req: Request,
  res: Response,
) {
  try {
    const data =
      updateTaskSchema.parse(
        req.body,
      );

    const task = await updateTask(
      req.params.id as string,
      data,
    );

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found.",
      });
    }

    return res.json({
      success: true,
      data: task,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to update task.",
    });
  }
}

export async function createTaskTemplateController(
  req: Request,
  res: Response,
) {
  try {
    const data =
      createTaskTemplateSchema.parse(
        req.body,
      );

    const template =
      await createTaskTemplate(data);

    return res.status(201).json({
      success: true,
      data: template,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to create task template.",
    });
  }
}

export async function getTaskTemplatesController(
  _req: Request,
  res: Response,
) {
  try {
    const templates =
      await getTaskTemplates();

    return res.json({
      success: true,
      data: templates,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch templates.",
    });
  }
}

/*
 * Internal/service trigger.
 *
 * D1 should call generateForCampaign()
 * directly after successful approval.
 *
 * This controller is optional and should NOT
 * be used by the D3 UI.
 */
export async function generateTasksController(
  req: Request,
  res: Response,
) {
  try {
    const campaign = req.body.campaign;

    const tasks =
      await generateForCampaign(
        campaign,
        {
          userId: (
            req as any
          ).user?._id,
          role: (
            req as any
          ).user?.role,
        },
      );

    return res.status(201).json({
      success: true,
      data: tasks,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to generate tasks.",
    });
  }
}