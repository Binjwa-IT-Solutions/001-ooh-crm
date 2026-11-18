import { Router } from "express";
import { requireAuth } from "../../core/auth/auth-middleware.js";
import { requirePermission } from "../../core/rbac/index.js";

import {
  getEscalations,
  getTaskEscalations,
} from "./escalation.controller.js";

const router = Router();

router.get(
  "/escalations",
  requireAuth,
  requirePermission("tasks.view"),
  getEscalations,
);

router.get(
  "/tasks/:id/escalations",
  requireAuth,
  requirePermission("tasks.view"),
  getTaskEscalations,
);

export default router;
