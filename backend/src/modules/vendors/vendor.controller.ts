import type {
  Request,
  Response,
  NextFunction,
} from "express";

import * as vendorService from "./vendor.service.js";

import {
  createVendorSchema,
  updateVendorSchema,
} from "./vendor.validator.js";

/* ----------------------------------
   LIST VENDORS
   GET /api/vendors
----------------------------------- */

export async function list(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim()
        : undefined;

    const state =
      typeof req.query.state === "string"
        ? req.query.state.trim()
        : undefined;

    const city =
      typeof req.query.city === "string"
        ? req.query.city.trim()
        : undefined;

    const status =
      req.query.status === "Active" ||
      req.query.status === "Inactive"
        ? req.query.status
        : undefined;

    const vendors = await vendorService.getVendors({
      search,
      state,
      city,
      status,
    });

    return res.status(200).json({
      success: true,
      data: vendors,
    });
  } catch (error) {
    next(error);
  }
}


/* ----------------------------------
   FILTER OPTIONS
   GET /api/vendors/filters
----------------------------------- */

export async function filters(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const state =
      typeof req.query.state === "string"
        ? req.query.state.trim()
        : undefined;

    const data =
      await vendorService.getVendorFilters(state);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}


/* ----------------------------------
   GET VENDOR BY ID
   GET /api/vendors/:id
----------------------------------- */

export async function getById(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const vendor =
      await vendorService.getVendorById(
        String(req.params.id),
      );

    return res.status(200).json({
      success: true,
      data: vendor,
    });
  } catch (error) {
    next(error);
  }
}


/* ----------------------------------
   CREATE VENDOR
   POST /api/vendors
----------------------------------- */

export async function create(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const input =
      createVendorSchema.parse(req.body);

    const vendor =
      await vendorService.createVendor(input);

    return res.status(201).json({
      success: true,
      message: "Vendor created successfully",
      data: vendor,
    });
  } catch (error) {
    next(error);
  }
}


/* ----------------------------------
   UPDATE VENDOR
   PATCH /api/vendors/:id
----------------------------------- */

export async function update(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const input =
      updateVendorSchema.parse(req.body);

    const vendor =
      await vendorService.updateVendor(
        String(req.params.id),
        input,
      );

    return res.status(200).json({
      success: true,
      message: "Vendor updated successfully",
      data: vendor,
    });
  } catch (error) {
    next(error);
  }
}


/* ----------------------------------
   DEACTIVATE VENDOR
   PATCH /api/vendors/:id/deactivate
----------------------------------- */

export async function deactivate(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const vendor =
      await vendorService.updateVendor(
        String(req.params.id),
        {
          status: "Inactive",
        },
      );

    return res.status(200).json({
      success: true,
      message: "Vendor deactivated successfully",
      data: vendor,
    });
  } catch (error) {
    next(error);
  }
}


/* ----------------------------------
   GET SITES BY VENDOR
   GET /api/vendors/:id/sites
----------------------------------- */

export async function getSites(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const sites =
      await vendorService.getSitesByVendor(
        String(req.params.id),
      );

    return res.status(200).json({
      success: true,
      data: sites,
    });
  } catch (error) {
    next(error);
  }
}