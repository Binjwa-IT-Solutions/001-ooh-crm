import { Router } from "express";
import multer from "multer";

import * as proofController from "./proof.controller.js";
import { requireAuth } from "../../core/auth/auth-middleware.js";
import { requirePermission } from "../../core/rbac/index.js";

const optionalAuth = (req: any, res: any, next: any) => {
  if (req.headers.authorization?.startsWith("Bearer ")) {
    return requireAuth(req, res, next);
  }
  next();
};

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

// Generate Proof Link
router.post(
  "/link/generate",
  requireAuth,
  requirePermission("proofs.upload"),
  proofController.generateProofLink,
);

// Public Proof Submission (Token-based)
router.post(
  "/link/:token",
  upload.single("file"),
  proofController.createProofByToken,
);

// Validate Proof Link (Public)
router.get(
  "/link/:token",
  proofController.validateProofLink,
);

// Normal authenticated proof
router.post(
  "/",
  requireAuth,
  requirePermission("proofs.upload"),
  upload.single("file"),
  proofController.createProof,
);

// Get all proofs
router.get(
  "/",
  requireAuth,
  requirePermission("proofs.view"),
  proofController.getProofs,
);

// Get task proofs
router.get(
  "/task/:id",
  requireAuth,
  requirePermission("proofs.view"),
  proofController.getTaskProofs,
);

// Review proof (Approval / Rejection)
router.patch(
  "/:id/review",
  requireAuth,
  requirePermission("proofs.approve"),
  proofController.reviewProof,
);

// Get proof image
router.get(
  "/:id/image",
  proofController.getProofImage,
);

// Get campaigns by vendor
router.get(
  "/vendor-campaigns/:vendorId",
  requireAuth,
  requirePermission("proofs.view"),
  proofController.getCampaignsByVendor,
);

// Get Saved Campaign POW
router.get(
  "/campaign-pow",
  requireAuth,
  requirePermission("proofs.view"),
  proofController.getCampaignPow,
);

// Sync / Save Campaign POW
router.post(
  "/campaign-pow",
  requireAuth,
  requirePermission("proofs.upload"),
  proofController.syncCampaignPow,
);

export default router;