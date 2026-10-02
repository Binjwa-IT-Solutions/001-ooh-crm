import { Router } from "express";
import { requireAuth } from "../../core/auth/auth-middleware.js";
import { requirePermission } from "../../core/rbac/index.js";
import * as controller from "./purchase-order.controller.js";

const router = Router();

router.use(requireAuth);

const view = requirePermission("purchase_orders.view");
const manage = requirePermission("purchase_orders.manage");

router.get("/", view, controller.list);
router.get("/campaign-options", view, controller.campaignOptions);
router.get("/vendor-options", view, controller.vendorOptions);

router.post("/", manage, controller.create);

router.get("/:id", view, controller.getById);
router.patch("/:id", manage, controller.update);

router.post("/:id/issue", manage, controller.issue);
router.post("/:id/cancel", manage, controller.cancel);

/* Step 4 */
router.patch("/:id/document", manage, controller.document);

/* Step 5 */
router.patch("/:id/payment", manage, controller.payment);

export default router;