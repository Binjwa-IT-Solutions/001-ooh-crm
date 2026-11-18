import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

import { requireAuth } from "../../core/auth/auth-middleware.js";
import { requirePermission } from "../../core/rbac/index.js";
import * as controller from "./vendor.controller.js";

const uploadDir = path.resolve("uploads/vendors");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },

  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);

    const name = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9]/g, "-");

    cb(null, `${Date.now()}-${name}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

const router = Router();

router.use(requireAuth);

/* List / Filters */

router.get(
  "/",
  requirePermission("vendors.view"),
  controller.list,
);

router.get(
  "/filters",
  requirePermission("vendors.view"),
  controller.filters,
);

/* Vendor details */

router.get(
  "/:id/sites",
  requirePermission("vendors.view"),
  controller.getSites,
);

router.get(
  "/:id",
  requirePermission("vendors.view"),
  controller.getById,
);

/* Create / Update */

router.post(
  "/",
  requirePermission("vendors.manage"),
  controller.create,
);

router.patch(
  "/:id",
  requirePermission("vendors.manage"),
  controller.update,
);

/* Status */

router.patch(
  "/:id/activate",
  requirePermission("vendors.manage"),
  controller.activate,
);

router.patch(
  "/:id/deactivate",
  requirePermission("vendors.manage"),
  controller.deactivate,
);

router.patch(
  "/:id/blacklist",
  requirePermission("vendors.manage"),
  controller.blacklist,
);

/* Registration */

router.patch(
  "/:id/registration-status",
  requirePermission("vendors.manage"),
  controller.registrationStatus,
);

/* Documents */

router.post(
  "/:id/documents",
  requirePermission("vendors.manage"),
  upload.single("file"),
  controller.addDocument,
);

router.delete(
  "/:id/documents/:documentId",
  requirePermission("vendors.manage"),
  controller.removeDocument,
);

export default router;