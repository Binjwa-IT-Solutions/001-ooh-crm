import { Router } from "express";
import multer from "multer";

import * as proofController from "./proof.controller.js";

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
  proofController.generateProofLink
);

// Public Proof Submission
router.post(
  "/link/:token",
  upload.single("file"),
  proofController.createProofByToken
);

// Validate Proof Link
router.get(
  "/link/:token",
  proofController.validateProofLink
);

// Normal authenticated proof
router.post(
  "/",
  upload.single("file"),
  proofController.createProof
);

// Get all proofs
router.get(
  "/",
  proofController.getProofs
);

// Get task proofs
router.get(
  "/task/:id",
  proofController.getTaskProofs
);

// Review proof
router.patch(
  "/:id/review",
  proofController.reviewProof
);

// Get proof image
router.get(
  "/:id/image",
  proofController.getProofImage
);

// Get campaigns by vendor
router.get(
  "/vendor-campaigns/:vendorId",
  proofController.getCampaignsByVendor
);

export default router;