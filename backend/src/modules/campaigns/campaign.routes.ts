import { Router } from "express";
import { requireAuth } from "../../core/auth/auth-middleware.js";
import { requirePermission } from "../../core/rbac/index.js";

import {
  createCampaignController,
  createCampaignFromQuotationController,
  getCampaignController,
  listCampaignsController,
  updateCampaignStatusController,
  updateCampaignController,
  listCampaignManagersController,
  listCampaignLeadOptionsController,
} from "./campaign.controller.js";

const router = Router();

router.use(requireAuth);

/*
 * GET /api/campaigns
 *
 * Filters:
 * ?status=Draft
 * ?city=Indore
 * ?manager=<id>
 * ?search=keyword
 * ?startDate=2026-08-01
 * ?endDate=2026-08-31
 */
router.get(
  "/",
  requirePermission("campaigns.view"),
  listCampaignsController,
);

/*
 * GET /api/campaigns/managers
 */
router.get(
  "/managers",
  requirePermission("campaigns.view"),
  listCampaignManagersController,
);

/*
 * GET /api/campaigns/lead-options
 */
router.get(
  "/lead-options",
  requirePermission("campaigns.view"),
  listCampaignLeadOptionsController,
);

/*
 * GET /api/campaigns/:id
 */
router.get(
  "/:id",
  requirePermission("campaigns.view"),
  getCampaignController,
);

/*
 * PUT /api/campaigns/:id
 */
router.put(
  "/:id",
  requirePermission("campaigns.manage"),
  updateCampaignController,
);

/*
 * POST /api/campaigns
 */
router.post(
  "/",
  requirePermission("campaigns.manage"),
  createCampaignController,
);

/*
 * PATCH /api/campaigns/:id/status
 *
 * Body:
 * {
 *   "status": "Approved"
 * }
 */
router.patch(
  "/:id/status",
  requirePermission("campaigns.manage"),
  updateCampaignStatusController,
);

/*
 * B3 -> D1
 *
 * Create campaign when quotation is accepted.
 */
router.post(
  "/from-quotation",
  requirePermission("campaigns.manage"),
  createCampaignFromQuotationController,
);

export default router;
