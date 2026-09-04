import {
  Request,
  Response,
} from "express";

import * as siteService
  from "./site.service.js";

import {
  createSiteSchema,
  updateSiteSchema,
  siteQuerySchema,
} from "./site.validator.js";

/* ----------------------------------
   CREATE
----------------------------------- */

export async function createSite(
  req: Request,
  res: Response
) {
  try {
    const data =
      createSiteSchema.parse(
        req.body
      );

    const site =
      await siteService.createSite(
        data
      );

    return res.status(201).json({
      success: true,
      message:
        "Site created successfully",
      data: site,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

/* ----------------------------------
   GET ALL
----------------------------------- */

export async function getSites(
  req: Request,
  res: Response
) {
  try {
    const filters =
      siteQuerySchema.parse(
        req.query
      );

    const sites =
      await siteService.getSites(
        filters
      );

    return res.status(200).json({
      success: true,
      data: sites,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

/* ----------------------------------
   GET ONE
----------------------------------- */

export async function getSite(
  req: Request,
  res: Response
) {
  try {
    const siteId =
      req.params.id as string;

    const site =
      await siteService.getSiteById(
        siteId
      );

    return res.status(200).json({
      success: true,
      data: site,
    });
  } catch (error: any) {
    return res.status(404).json({
      success: false,
      message: error.message,
    });
  }
}

/* ----------------------------------
   UPDATE
----------------------------------- */

export async function updateSite(
  req: Request,
  res: Response
) {
  try {
    const siteId =
      req.params.id as string;

    const data =
      updateSiteSchema.parse(
        req.body
      );

    const site =
      await siteService.updateSite(
        siteId,
        data
      );

    return res.status(200).json({
      success: true,
      message:
        "Site updated successfully",
      data: site,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message,
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
    /*
      CSV content is sent as:

      {
        "csv": "city,type,address,lat,lng,date,..."
      }
    */

    const csv = req.body.csv;

    if (
      typeof csv !== "string" ||
      !csv.trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "CSV content is required",
      });
    }

    const result =
      await siteService.importSitesFromCsv(
        csv
      );

    if (!result.success) {
      return res
        .status(400)
        .json(result);
    }

    return res
      .status(201)
      .json(result);
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}