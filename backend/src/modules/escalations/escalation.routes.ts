import { Router } from "express";
import { requireAuth } from "../../core/auth/auth-middleware.js";
import { requirePermission } from "../../core/rbac/index.js";

import {
  getEscalations,
  getTaskEscalations,
} from "./escalation.controller.js";

const router = Router();

router.use(requireAuth);

router.get(
  "/escalations",
  requirePermission("tasks.view"),
  getEscalations,
);

router.get(
  "/tasks/:id/escalations",
  requirePermission("tasks.view"),
  getTaskEscalations,
);

export default router;