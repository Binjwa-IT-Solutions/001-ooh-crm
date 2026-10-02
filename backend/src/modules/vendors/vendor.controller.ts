import type {
  Request,
  Response,
  NextFunction,
} from "express";

import * as vendorService
  from "./vendor.service.js";

import {
  createVendorSchema,
  updateVendorSchema,
} from "./vendor.validator.js";

/* LIST */

export async function list(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data =
      await vendorService.getVendors({
        search:
          typeof req.query.search ===
          "string"
            ? req.query.search
            : undefined,

        city:
          typeof req.query.city ===
          "string"
            ? req.query.city
            : undefined,

        state:
          typeof req.query.state ===
          "string"
            ? req.query.state
            : undefined,

        status:
          req.query.status ===
            "Active" ||
          req.query.status ===
            "Inactive" ||
          req.query.status ===
            "Blacklist"
            ? req.query.status
            : undefined,

        registrationStatus:
          req.query
            .registrationStatus ===
            "Registered" ||
          req.query
            .registrationStatus ===
            "Unregistered" ||
          req.query
            .registrationStatus ===
            "Pending"
            ? req.query
                .registrationStatus
            : undefined,

        vendorType:
          typeof req.query.vendorType ===
          "string"
            ? req.query.vendorType
            : undefined,
      });

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

/* FILTERS */

export async function filters(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data =
      await vendorService
        .getVendorFilters();

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

/* GET BY ID */

export async function getById(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data =
      await vendorService
        .getVendorById(
          String(req.params.id),
        );

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

/* CREATE */

export async function create(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const input =
      createVendorSchema.parse(
        req.body,
      );

    const data =
      await vendorService
        .createVendor(input);

    res.status(201).json({
      success: true,
      message:
        "Vendor created successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
}

/* UPDATE */

export async function update(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const input =
      updateVendorSchema.parse(
        req.body,
      );

    const data =
      await vendorService
        .updateVendor(
          String(req.params.id),
          input,
        );

    res.json({
      success: true,
      message:
        "Vendor updated successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
}

/* ACTIVATE */

export async function activate(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data =
      await vendorService
        .setVendorStatus(
          String(req.params.id),
          "Active",
        );

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

/* DEACTIVATE */

export async function deactivate(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data =
      await vendorService
        .setVendorStatus(
          String(req.params.id),
          "Inactive",
        );

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

/* BLACKLIST */

export async function blacklist(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data =
      await vendorService
        .setVendorStatus(
          String(req.params.id),
          "Blacklist",
        );

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

/* REGISTRATION STATUS */

export async function registrationStatus(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const status =
      req.body.registrationStatus;

    if (
      ![
        "Registered",
        "Unregistered",
        "Pending",
      ].includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid registration status",
      });
    }

    const data =
      await vendorService
        .setRegistrationStatus(
          String(req.params.id),
          status,
        );

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

/* ADD DOCUMENT */

export async function addDocument(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const document = {
      type: req.body.type,
      name:
        req.file?.originalname ||
        req.body.name,
      url: req.file
        ? `/uploads/vendors/${req.file.filename}`
        : req.body.url,
      fileKey: req.file?.filename,
    };

    if (!document.type) {
      return res.status(400).json({
        success: false,
        message:
          "Document type is required",
      });
    }

    if (!document.name) {
      return res.status(400).json({
        success: false,
        message:
          "Document name is required",
      });
    }

    const data =
      await vendorService.addDocument(
        String(req.params.id),
        document,
      );

    res.json({
      success: true,
      message:
        "Document uploaded successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
}

/* REMOVE DOCUMENT */

export async function removeDocument(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data =
      await vendorService
        .removeDocument(
          String(req.params.id),
          String(
            req.params.documentId,
          ),
        );

    res.json({
      success: true,
      message:
        "Document removed successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
}

/* SITES */

export async function getSites(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data =
      await vendorService
        .getSitesByVendor(
          String(req.params.id),
        );

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}