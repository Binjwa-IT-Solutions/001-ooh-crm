import crypto from "crypto";
import mongoose from "mongoose";

import "../campaigns/campaign.model.js";
import "../vendors/vendor.model.js";

import { fileService } from "../../core/files/index.js";
import { Proof } from "./proof.model.js";

import {
  createProofSchema,
  generateProofLinkSchema,
  proofQuerySchema,
  reviewProofSchema,
} from "./proof.validator.js";

// =====================================================
// Generate Proof Link
// =====================================================

export async function generateProofLink(data?: unknown) {
  const input = data ? generateProofLinkSchema.parse(data) : {};
  const token =
    crypto.randomBytes(32).toString("hex");

  const campaignId =
    input.campaignId && mongoose.Types.ObjectId.isValid(input.campaignId)
      ? new mongoose.Types.ObjectId(input.campaignId)
      : undefined;

  const vendorId =
    input.vendorId && mongoose.Types.ObjectId.isValid(input.vendorId)
      ? new mongoose.Types.ObjectId(input.vendorId)
      : undefined;

  await Proof.create({
    proofLinkToken: token,
    proofLinkUses: 0,
    proofLinkMaxUses: 999999,
    proofLinkActive: true,
    campaignId,
    vendorId,
  });

  return {
    token,
    link: `/proof/${token}`,
    message: "Proof link generated successfully",
  };
}

// =====================================================
// Validate Proof Link Token
// =====================================================

export async function validateProofLinkToken(token: string) {
  if (!token) {
    return {
      valid: false,
      message: "Proof token is required",
    };
  }

  const proof = await Proof.findOne({
    proofLinkToken: token,
  })
    .populate("campaignId", "name campaignCode")
    .populate("vendorId", "name primaryContact")
    .lean();

  if (!proof) {
    return {
      valid: false,
      message: "Invalid proof link",
    };
  }

  const uses = proof.proofLinkUses ?? 0;

  if (!proof.proofLinkActive) {
    return {
      valid: false,
      message: "This proof link is inactive.",
      uses,
    };
  }

  return {
    valid: true,
    message: "Proof link is valid",
    uses,
    campaign: proof.campaignId,
    vendor: proof.vendorId,
  };
}

// =====================================================
// Create Proof - Authenticated Flow
// =====================================================

export async function createProof(
  data: unknown,
  file: Express.Multer.File,
  userId: string
) {
  if (!file) {
    throw new Error("Proof image is required");
  }

  if (
    !mongoose.Types.ObjectId.isValid(userId)
  ) {
    throw new Error("Invalid user ID");
  }

  const input =
    createProofSchema.parse(data);

  // Save the image buffer to disk/storage
  const stored = await fileService.save(file, { folder: "proofs" });

  const campaignId =
    input.campaignId && mongoose.Types.ObjectId.isValid(input.campaignId)
      ? new mongoose.Types.ObjectId(input.campaignId)
      : undefined;

  const vendorId =
    input.vendorId && mongoose.Types.ObjectId.isValid(input.vendorId)
      ? new mongoose.Types.ObjectId(input.vendorId)
      : undefined;

  return Proof.create({
    originalImageKey: stored.key,
    locationName: input.locationName,
    campaignId,
    vendorId,

    gps: {
      lat: input.lat,
      lng: input.lng,
    },

    gpsAccuracy: input.gpsAccuracy,

    capturedAt:
      new Date(input.capturedAt),

    uploadedBy:
      new mongoose.Types.ObjectId(userId),

    deviceInfo:
      input.deviceInfo || "Unknown",

    status: "Pending",
  });
}

// =====================================================
// Create Proof Using Generated Link
// =====================================================

export async function createProofByToken(
  token: string,
  data: unknown,
  file: Express.Multer.File
) {
  if (!token) {
    throw new Error(
      "Proof token is required"
    );
  }

  if (!file) {
    throw new Error(
      "Proof image is required"
    );
  }

  const input =
    createProofSchema.parse(data);

  /*
   * Atomically increase link usage.
   * Allows unlimited photos as requested.
   */
  const link =
    await Proof.findOneAndUpdate(
      {
        proofLinkToken: token,
        proofLinkActive: true,
      },
      {
        $inc: {
          proofLinkUses: 1,
        },
      },
      {
        new: true,
      }
    );

  if (!link) {
    throw new Error(
      "Proof link is invalid or inactive"
    );
  }

  // Save the image buffer to disk/storage
  const stored = await fileService.save(file, { folder: "proofs" });

  const proof =
    await Proof.create({
      originalImageKey: stored.key,
      locationName: input.locationName,
      campaignId: link.campaignId,
      vendorId: link.vendorId,

      gps: {
        lat: input.lat,
        lng: input.lng,
      },

      gpsAccuracy:
        input.gpsAccuracy,

      capturedAt:
        new Date(input.capturedAt),

      deviceInfo:
        input.deviceInfo || "Unknown",

      status: "Pending",
    });

  return proof;
}

// =====================================================
// Get Proofs
// =====================================================

export async function getProofs(
  query: unknown
) {
  const filters =
    proofQuerySchema.parse(query);

  const mongoQuery: Record<
    string,
    unknown
  > = {};

  if (filters.taskId) {
    mongoQuery.taskId =
      filters.taskId;
  }

  if (filters.campaignId) {
    mongoQuery.campaignId =
      filters.campaignId;
  }

  if (filters.vendorId) {
    mongoQuery.vendorId =
      filters.vendorId;
  }

  if (filters.atrId) {
    mongoQuery.atrId =
      filters.atrId;
  }

  if (filters.status) {
    mongoQuery.status =
      filters.status;
  }

  if (filters.uploadedBy) {
    mongoQuery.uploadedBy =
      filters.uploadedBy;
  }

  return Proof.find(mongoQuery)
    .populate("campaignId", "name campaignCode")
    .populate("vendorId", "name primaryContact")
    .sort({
      createdAt: -1,
    })
    .lean();
}

// =====================================================
// Get Proofs By Task
// =====================================================

export async function getTaskProofs(
  taskId: string
) {
  if (
    !mongoose.Types.ObjectId.isValid(
      taskId
    )
  ) {
    throw new Error(
      "Invalid task ID"
    );
  }

  return Proof.find({
    taskId,
  })
    .populate("campaignId", "name campaignCode")
    .populate("vendorId", "name primaryContact")
    .sort({
      createdAt: -1,
    })
    .lean();
}

// =====================================================
// Review Proof
// =====================================================

export async function reviewProof(
  proofId: string,
  data: unknown,
  reviewerId: string
) {
  if (
    !mongoose.Types.ObjectId.isValid(
      proofId
    )
  ) {
    throw new Error(
      "Invalid proof ID"
    );
  }

  if (
    !mongoose.Types.ObjectId.isValid(
      reviewerId
    )
  ) {
    throw new Error(
      "Invalid reviewer ID"
    );
  }

  const input =
    reviewProofSchema.parse(data);

  const proof =
    await Proof.findById(proofId);

  if (!proof) {
    throw new Error(
      "Proof not found"
    );
  }

  if (proof.status !== "Pending") {
    throw new Error(
      "Only pending proofs can be reviewed"
    );
  }

  proof.status = input.status;

  proof.rejectionReason =
    input.status === "Rejected"
      ? input.rejectionReason
      : undefined;

  proof.reviewedBy =
    new mongoose.Types.ObjectId(
      reviewerId
    );

  proof.reviewedAt = new Date();

  await proof.save();

  return proof;
}

// =====================================================
// Get Campaigns By Vendor
// =====================================================

export async function getCampaignsByVendor(vendorId: string) {
  if (!mongoose.Types.ObjectId.isValid(vendorId)) {
    return [];
  }

  const vId = new mongoose.Types.ObjectId(vendorId);

  // 1. Find campaigns from Purchase Orders
  const { PurchaseOrder } = await import(
    "../purchase-orders/purchase-order.model.js"
  );
  const poCampaignIds = await PurchaseOrder.find({
    vendorId: vId,
    campaignId: { $ne: null },
  }).distinct("campaignId");

  // 2. Find campaigns from Proofs
  const proofCampaignIds = await Proof.find({
    vendorId: vId,
    campaignId: { $ne: null },
  }).distinct("campaignId");

  // Combine unique valid ObjectIds
  const allIds = Array.from(
    new Set(
      [...poCampaignIds, ...proofCampaignIds].map((id) =>
        String(id)
      )
    )
  ).filter((id) => mongoose.Types.ObjectId.isValid(id));

  if (!allIds.length) {
    return [];
  }

  const { Campaign } = await import(
    "../campaigns/campaign.model.js"
  );
  return Campaign.find({
    _id: {
      $in: allIds.map(
        (id) => new mongoose.Types.ObjectId(id)
      ),
    },
  })
    .select("name campaignCode city startDate endDate status")
    .sort({ name: 1 })
    .lean();
}