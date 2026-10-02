
import type { Request, Response } from "express";

import {
  createSite as createSiteService,
  getSites,
  getSiteById,
  updateSite,
  importSitesFromCsv,
  getSiteStates,
  getSiteCities,
} from "./site.service.js";

import {
  createSiteSchema,
  updateSiteSchema,
  siteQuerySchema,
} from "./site.validator.js";

/* ----------------------------------
   CREATE ATR
----------------------------------- */

export async function createSite(
  req: Request,
  res: Response
) {
  try {
    const data =
      createSiteSchema.parse(req.body);

    const atr =
      await createSiteService(data);

    return res.status(201).json({
      success: true,
      data: atr,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message:
        error?.message ||
        "Failed to create ATR",
    });
  }
}

/* ----------------------------------
   GET ALL ATR
----------------------------------- */

export async function getSitesController(
  req: Request,
  res: Response
) {
  try {
    const filters =
      siteQuerySchema.parse(req.query);

    const sites =
      await getSites(filters);

    return res.status(200).json({
      success: true,
      data: sites,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message:
        error?.message ||
        "Failed to fetch ATRs",
    });
  }
}

/* ----------------------------------
   GET SINGLE ATR
----------------------------------- */

export async function getSite(
  req: Request,
  res: Response
) {
  try {
    const id =
      String(req.params.id);

    const atr =
      await getSiteById(id);

    return res.status(200).json({
      success: true,
      data: atr,
    });
  } catch (error: any) {
    return res.status(404).json({
      success: false,
      message:
        error?.message ||
        "ATR not found",
    });
  }
}

/* ----------------------------------
   UPDATE ATR
----------------------------------- */

export async function updateSiteController(
  req: Request,
  res: Response
) {
  try {
    const id =
      String(req.params.id);

    const data =
      updateSiteSchema.parse(req.body);

    const atr =
      await updateSite(id, data);

    return res.status(200).json({
      success: true,
      data: atr,
    });
  } catch (error: any) {
    const message =
      error?.message ||
      "Failed to update ATR";

    const status =
      message.includes("48 hours")
        ? 403
        : 400;

    return res.status(status).json({
      success: false,
      message,
    });
  }
}

/* ----------------------------------
   GET SAVED STATES
----------------------------------- */

export async function getStates(
  req: Request,
  res: Response
) {
  try {
    const search =
      typeof req.query.search === "string"
        ? req.query.search
        : "";

    const states =
      await getSiteStates(search);

    return res.status(200).json({
      success: true,
      data: states,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message:
        error?.message ||
        "Failed to fetch states",
    });
  }
}

/* ----------------------------------
   GET SAVED CITIES BY STATE
----------------------------------- */

export async function getCities(
  req: Request,
  res: Response
) {
  try {
    const state =
      typeof req.query.state === "string"
        ? req.query.state
        : "";

    const search =
      typeof req.query.search === "string"
        ? req.query.search
        : "";

    if (!state.trim()) {
      return res.status(400).json({
        success: false,
        message: "State is required",
      });
    }

    const cities =
      await getSiteCities(
        state,
        search
      );

    return res.status(200).json({
      success: true,
      data: cities,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message:
        error?.message ||
        "Failed to fetch cities",
    });
  }
}

/* ----------------------------------
   CSV IMPORT
----------------------------------- */

export async function importSites(
  req: Request,
  res: Response
) {
  try {
    const csv =
      typeof req.body === "string"
        ? req.body
        : req.body?.csv;

    if (!csv) {
      return res.status(400).json({
        success: false,
        message: "CSV data is required",
      });
    }

    const result =
      await importSitesFromCsv(csv);

    return res.status(201).json(result);
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message:
        error?.message ||
        "CSV import failed",
    });
  }
}

