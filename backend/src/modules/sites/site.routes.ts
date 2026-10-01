
import { Router } from "express";

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

/* CREATE ATR */
router.post("/", createSite);

/* GET ALL ATR */
router.get("/", getSitesController);

/* STATE OPTIONS */
router.get(
  "/options/states",
  getStates
);

/* CITY OPTIONS */
router.get(
  "/options/cities",
  getCities
);

/* CSV IMPORT */
router.post(
  "/import",
  importSites
);

/* GET ONE ATR */
router.get(
  "/:id",
  getSite
);

/* UPDATE ATR */
router.patch(
  "/:id",
  updateSiteController
);

export default router;

