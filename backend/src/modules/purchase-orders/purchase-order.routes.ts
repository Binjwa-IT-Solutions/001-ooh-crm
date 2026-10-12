import { Router } from "express";

import { requireAuth } from "../../core/auth/auth-middleware.js";
import { requirePermission } from "../../core/rbac/index.js";
import * as controller from "./purchase-order.controller.js";

const router = Router();

router.use(requireAuth);

router.get(
  "/",
  requirePermission("purchase_orders.view"),
  controller.list,
);

router.get(
  "/campaign-options",
  requirePermission("purchase_orders.view"),
  controller.campaignOptions,
);

router.get(
  "/vendor-options",
  requirePermission("purchase_orders.view"),
  controller.vendorOptions,
);

router.get(
  "/:id",
  requirePermission("purchase_orders.view"),
  controller.getById,
);

router.post(
  "/",
  requirePermission("purchase_orders.manage"),
  controller.create,
);

router.patch(
  "/:id",
  requirePermission("purchase_orders.manage"),
  controller.update,
);

router.post(
  "/:id/issue",
  requirePermission("purchase_orders.manage"),
  controller.issue,
);

router.post(
  "/:id/cancel",
  requirePermission("purchase_orders.manage"),
  controller.cancel,
);

export default router;