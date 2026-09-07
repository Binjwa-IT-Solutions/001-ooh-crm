import { Router } from "express";
import { requireAuth } from "../../core/auth/auth-middleware.js";
import { requirePermission } from "../../core/rbac/index.js";

import {
  getTasksController,
  getCampaignTasksController,
  updateTaskController,
  createTaskTemplateController,
  getTaskTemplatesController,
  generateTasksController,
} from "./task.controller.js";

const router = Router();

router.use(requireAuth);

/*
 * GET /api/tasks
 */
router.get("/", requirePermission("tasks.view"), getTasksController);

/*
 * GET /api/tasks/campaign/:id
 */
router.get("/campaign/:id", requirePermission("tasks.view"), getCampaignTasksController);

/*
 * PATCH /api/tasks/:id
 */
router.patch("/:id", requirePermission("tasks.manage"), updateTaskController);

/*
 * Task Templates endpoints
 */
router.get("/templates", requirePermission("tasks.view"), getTaskTemplatesController);
router.post("/templates", requirePermission("tasks.manage"), createTaskTemplateController);

/*
 * Internal / manual generate route
 */
router.post("/generate", requirePermission("tasks.manage"), generateTasksController);

export default router;