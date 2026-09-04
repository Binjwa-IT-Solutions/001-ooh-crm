import { Types } from "mongoose";

import {
  EscalationModel,
  type EscalationLevel,
} from "./escalation.model.js";
import { Task } from "../tasks/task.model.js";
import { Employee } from "../employees/employees.model.js";
import { AuthUser } from "../../core/auth/auth-model.js";
import { notify } from "../../core/notifications/index.js";

export const ESCALATION_THRESHOLD_HOURS = {
  L1: 2,
  L2: 6,
  L3: 24,
} as const;

export type EscalationTask = {
  _id: Types.ObjectId | string;
  deadline: Date | string;
  status: string;
  assignedTo?: Types.ObjectId | string | null;
};

/**
 * Calculate how many hours a task has been overdue.
 */
export function getOverdueHours(
  deadline: Date | string,
  now: Date = new Date(),
): number {
  const deadlineDate =
    deadline instanceof Date
      ? deadline
      : new Date(deadline);

  if (
    Number.isNaN(
      deadlineDate.getTime(),
    )
  ) {
    return 0;
  }

  const difference =
    now.getTime() -
    deadlineDate.getTime();

  return Math.max(
    0,
    difference /
      (1000 * 60 * 60),
  );
}

/**
 * Determine which escalation levels
 * have been reached.
 *
 * 0-2 hours  → none
 * 2-6 hours  → L1
 * 6-24 hours → L1 + L2
 * 24+ hours  → L1 + L2 + L3
 */
export function getReachedLevels(
  deadline: Date | string,
  now: Date = new Date(),
): EscalationLevel[] {
  const overdueHours =
    getOverdueHours(
      deadline,
      now,
    );

  const levels: EscalationLevel[] =
    [];

  if (
    overdueHours >=
    ESCALATION_THRESHOLD_HOURS.L1
  ) {
    levels.push("L1");
  }

  if (
    overdueHours >=
    ESCALATION_THRESHOLD_HOURS.L2
  ) {
    levels.push("L2");
  }

  if (
    overdueHours >=
    ESCALATION_THRESHOLD_HOURS.L3
  ) {
    levels.push("L3");
  }

  return levels;
}

/**
 * Check whether a particular escalation
 * has already been created.
 */
export async function hasEscalation(
  taskId: string,
  level: EscalationLevel,
): Promise<boolean> {
  if (
    !Types.ObjectId.isValid(taskId)
  ) {
    throw new Error(
      "Invalid task id",
    );
  }

  const exists =
    await EscalationModel.exists({
      taskId: new Types.ObjectId(
        taskId,
      ),
      level,
    } as any);

  return Boolean(exists);
}

/**
 * Create escalation safely.
 *
 * Unique index:
 * { taskId: 1, level: 1 }
 *
 * makes this operation idempotent.
 */
export async function createEscalation(
  taskId: string,
  level: EscalationLevel,
  notifiedUserIds: string[],
) {
  if (
    !Types.ObjectId.isValid(taskId)
  ) {
    throw new Error(
      "Invalid task id",
    );
  }

  const userIds =
    notifiedUserIds.filter((id) =>
      Types.ObjectId.isValid(id),
    );

  try {
    const escalation =
      await EscalationModel.findOneAndUpdate(
        {
          taskId: new Types.ObjectId(
            taskId,
          ),
          level,
        } as any,
        {
          $setOnInsert: {
            taskId:
              new Types.ObjectId(
                taskId,
              ),

            level,

            triggeredAt: new Date(),

            notifiedUserIds:
              userIds.map(
                (id) =>
                  new Types.ObjectId(id),
              ),
          },
        },
        {
          upsert: true,
          returnDocument: "after",
          setDefaultsOnInsert: true,
        },
      ).lean();

    return escalation;
  } catch (error: any) {
    /**
     * Concurrent worker safety.
     *
     * If another worker inserted the
     * same task + level first, MongoDB
     * returns duplicate-key error.
     *
     * Fetch the already-created record.
     */
    if (error?.code === 11000) {
      return EscalationModel.findOne({
        taskId: new Types.ObjectId(
          taskId,
        ),
        level,
      } as any).lean();
    }

    throw error;
  }
}

/**
 * Get all escalations.
 *
 * Used by:
 * GET /api/escalations
 */
export async function getAllEscalations() {
  try {
    await processEscalations();
  } catch (err) {
    console.warn("[Escalations] Error auto-processing escalations:", err);
  }

  return EscalationModel.find()
    .populate("taskId", "title type deadline status")
    .sort({
      triggeredAt: -1,
    })
    .lean();
}

/**
 * Get escalation history for one task.
 *
 * Used by:
 * GET /api/tasks/:id/escalations
 */
export async function getEscalationsByTaskId(
  taskId: string,
) {
  if (
    !Types.ObjectId.isValid(taskId)
  ) {
    throw new Error(
      "Invalid task id",
    );
  }

  try {
    await processEscalations();
  } catch (err) {
    console.warn("[Escalations] Error auto-processing task escalations:", err);
  }

  return (
    EscalationModel.find({
      taskId: new Types.ObjectId(
        taskId,
      ),
    } as any)
      .populate("taskId", "title type deadline status campaignId")
      .sort({
        triggeredAt: 1,
      })
      .lean()
  );
}

/**
 * Get the latest escalation level
 * for a task.
 */
export async function getLatestEscalation(
  taskId: string,
) {
  if (
    !Types.ObjectId.isValid(taskId)
  ) {
    throw new Error(
      "Invalid task id",
    );
  }

  return (
    EscalationModel.findOne({
      taskId: new Types.ObjectId(
        taskId,
      ),
    } as any)
    .sort({
      triggeredAt: -1,
    })
    .lean()
  );
}

/**
 * Process one task and return the
 * escalation levels that should be handled.
 *
 * This function DOES NOT send notifications.
 * Notification + recipient resolution belong
 * to the worker/integration layer.
 */
export function getTaskEscalationLevels(
  task: EscalationTask,
  now: Date = new Date(),
): EscalationLevel[] {
  /**
   * Completed tasks must never escalate.
   */
  if (task.status === "Completed") {
    return [];
  }

  return getReachedLevels(
    task.deadline,
    now,
  );
}

/**
 * Aliases for controller compatibility.
 */
export const listEscalations =
  getAllEscalations;

export const listTaskEscalations =
  getEscalationsByTaskId;

/**
 * Process escalations for all overdue tasks.
 *
 * This function:
 * 1. Fetches all overdue tasks
 * 2. Determines escalation levels
 * 3. Creates escalations for new levels
 * 4. Triggers notifications
 */
export async function processEscalations() {
  const now = new Date();

  try {
    // 1. Fetch all non-completed tasks that are overdue
    const allTasks = await Task.find({
      status: { $ne: "Completed" },
      deadline: { $lt: now },
    })
      .populate("assignedTo", "_id")
      .lean();

    if (allTasks.length === 0) {
      console.log(
        "[Escalations] No overdue tasks found",
      );
      return;
    }

    let escalationsCreated = 0;
    let notificationsSent = 0;

    // 2. Process each task
    for (const task of allTasks) {
      const reachedLevels =
        getTaskEscalationLevels(
          task as EscalationTask,
          now,
        );

      if (reachedLevels.length === 0) {
        continue;
      }

      // 3. Create escalations for each new level
      for (const level of reachedLevels) {
        const existing = await EscalationModel.findOne({
          taskId: new Types.ObjectId(String(task._id)),
          level,
        } as any);

        // Collect user IDs to notify
        const notifyUserIds: string[] = [];

        const addUser = (id: any) => {
          if (!id) return;
          const str = String(id);
          if (!notifyUserIds.includes(str)) {
            notifyUserIds.push(str);
          }
        };

        // 1. If assigned, notify assigned user
        if (task.assignedTo) {
          try {
            const emp = await Employee.findOne({
              $or: [{ _id: task.assignedTo }, { userId: task.assignedTo }],
            })
              .populate("reportingManagerId", "_id userId fullName")
              .lean();

            if (emp?.userId) {
              addUser(emp.userId);
            } else {
              addUser(task.assignedTo);
            }

            // For L2 and L3, notify reporting manager
            if ((level === "L2" || level === "L3") && emp?.reportingManagerId) {
              const manager = emp.reportingManagerId as any;
              if (manager?.userId) addUser(manager.userId);
              else if (manager?._id) addUser(manager._id);
            }
          } catch (empErr) {
            console.warn(`[Escalations] Could not resolve employee for ${task.assignedTo}:`, empErr);
            addUser(task.assignedTo);
          }
        }

        // 2. Resolve Campaign Manager
        try {
          if (task.campaignId) {
            const { Campaign } = await import("../campaigns/campaign.model.js");
            const camp = await Campaign.findById(task.campaignId).select("assignedManager createdBy").lean();
            if (camp?.assignedManager) addUser(camp.assignedManager);
          }
        } catch (campErr) {
          console.warn("[Escalations] Could not resolve campaign manager:", campErr);
        }

        // 3. Level-specific operational routing
        try {
          if (level === "L1") {
            const opsUsers = await AuthUser.find({ role: "ops", status: "Active" }).select("_id").lean();
            for (const u of opsUsers) addUser(u._id);
          } else if (level === "L2") {
            const opsAndManagers = await AuthUser.find({
              role: { $in: ["ops", "manager"] },
              status: "Active",
            }).select("_id").lean();
            for (const u of opsAndManagers) addUser(u._id);
          } else if (level === "L3") {
            const managersAndAdmins = await AuthUser.find({
              role: { $in: ["ops", "manager", "admin"] },
              status: "Active",
            }).select("_id").lean();
            for (const u of managersAndAdmins) addUser(u._id);
          }
        } catch (roleErr) {
          console.warn("[Escalations] Could not resolve role-based users:", roleErr);
        }

        // Fallback: If still nobody, notify active Admins and Ops
        if (notifyUserIds.length === 0) {
          const fallbackUsers = await AuthUser.find({ role: { $in: ["admin", "ops"] }, status: "Active" }).select("_id").lean();
          for (const u of fallbackUsers) addUser(u._id);
        }

        if (existing) {
          // If existing escalation has no notified users recorded, backfill notifications
          if (!existing.notifiedUserIds || existing.notifiedUserIds.length === 0) {
            existing.notifiedUserIds = notifyUserIds.map((id) => new Types.ObjectId(id)) as any;
            await existing.save();

            for (const userId of notifyUserIds) {
              try {
                await notify({
                  userId,
                  type: "escalations.task_escalated",
                  title: `Task escalated to ${level}: ${task.title}`,
                  body: `Task "${task.title}" has reached escalation level ${level} due to overdue deadline.`,
                  link: `/escalations`,
                  email: true,
                });
                notificationsSent++;
              } catch (err) {
                console.error(`[Escalations] Failed to send notification to ${userId}:`, err);
              }
            }
          }
          continue;
        }

        // Create the escalation
        await createEscalation(
          String(task._id),
          level,
          notifyUserIds,
        );

        // Trigger notifications for each recipient
        for (const userId of notifyUserIds) {
          try {
            await notify({
              userId,
              type: "escalations.task_escalated",
              title: `Task escalated to ${level}: ${task.title}`,
              body: `Task "${task.title}" has reached escalation level ${level} due to overdue deadline.`,
              link: `/escalations`,
              email: true,
            });

            notificationsSent++;
          } catch (err) {
            console.error(
              `[Escalations] Failed to send notification to ${userId}:`,
              err,
            );
          }
        }

        escalationsCreated++;
      }
    }

    console.log(
      `[Escalations] Processing complete: ${escalationsCreated} escalations created, ${notificationsSent} notifications sent`,
    );
  } catch (err) {
    console.error(
      "[Escalations] Processing failed:",
      err,
    );
  }
}