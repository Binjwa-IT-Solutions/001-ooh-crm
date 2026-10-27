import { Router } from "express";
import { requireAuth } from "../../core/auth/auth-middleware.js";
import { requirePermission } from "../../core/rbac/index.js";

import {
  createSite,
  getSitesController,
  getSite,
  updateSiteController,
  importSites,
  getStates,
  getCities,
} from "./site.controller.js";

const router = Router();

router.use(requireAuth);

/* CREATE ATR */
router.post(
  "/",
  requirePermission("sites.manage"),
  createSite,
);

/* GET ALL ATR */
router.get(
  "/",
  requirePermission("sites.view"),
  getSitesController,
);

/* STATE OPTIONS */
router.get(
  "/options/states",
  requirePermission("sites.view"),
  getStates,
);

/* CITY OPTIONS */
router.get(
  "/options/cities",
  requirePermission("sites.view"),
  getCities,
);

/* CSV IMPORT */
router.post(
  "/import",
  requirePermission("sites.manage"),
  importSites,
);

/* GET ONE ATR */
router.get(
  "/:id",
  requirePermission("sites.view"),
  getSite,
);

/* UPDATE ATR */
router.patch(
  "/:id",
  requirePermission("sites.manage"),
  updateSiteController,
);

export default router;
