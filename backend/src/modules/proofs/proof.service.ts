import crypto from "crypto";
import mongoose from "mongoose";

import "../campaigns/campaign.model.js";
import "../vendors/vendor.model.js";

import { fileService } from "../../core/files/index.js";
import { Proof, CampaignPow } from "./proof.model.js";

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

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await Proof.create({
    proofLinkToken: token,
    proofLinkUses: 0,
    proofLinkMaxUses: 999999,
    proofLinkActive: true,
    proofLinkExpiresAt: expiresAt,
    campaignId,
    vendorId,
  });

  return {
    token,
    link: `/proof/${token}`,
    expiresAt,
    message: "Proof link generated successfully (Valid for 24 hours)",
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

  if (proof.proofLinkExpiresAt && new Date() > new Date(proof.proofLinkExpiresAt)) {
    return {
      valid: false,
      message: "This proof link has expired (24 hours limit exceeded).",
      uses,
    };
  }

  return {
    valid: true,
    message: "Proof link is valid",
    uses,
    expiresAt: proof.proofLinkExpiresAt,
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
  userId?: string
) {
  if (!file) {
    throw new Error("Proof image is required");
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

  const uploadedBy =
    userId && mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(userId)
      : undefined;

  const created = await Proof.create({
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

    uploadedBy,

    deviceInfo:
      input.deviceInfo || "Manual Upload",

    status: "Pending",
  });

  if (campaignId) {
    try {
      await syncCampaignPow(String(campaignId), userId);
    } catch {
      // ignore
    }
  }

  const populated = await Proof.findById(created._id)
    .populate("campaignId", "name campaignCode")
    .populate("vendorId", "name primaryContact companyName")
    .lean();

  return populated || created;
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
  const link = await Proof.findOne({
    proofLinkToken: token,
    proofLinkActive: true,
  });

  if (!link) {
    throw new Error(
      "Proof link is invalid or inactive"
    );
  }

  if (link.proofLinkExpiresAt && new Date() > new Date(link.proofLinkExpiresAt)) {
    throw new Error(
      "This proof link has expired (24 hours limit exceeded)"
    );
  }

  // Atomically increase link usage
  link.proofLinkUses = (link.proofLinkUses ?? 0) + 1;
  await link.save();

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

  if (link.campaignId) {
    try {
      await syncCampaignPow(String(link.campaignId));
    } catch {
      // ignore
    }
  }

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

  if (filters.taskId && mongoose.Types.ObjectId.isValid(filters.taskId)) {
    mongoQuery.taskId =
      new mongoose.Types.ObjectId(filters.taskId);
  }

  if (filters.campaignId && mongoose.Types.ObjectId.isValid(filters.campaignId)) {
    mongoQuery.campaignId =
      new mongoose.Types.ObjectId(filters.campaignId);
  }

  if (filters.vendorId && mongoose.Types.ObjectId.isValid(filters.vendorId)) {
    mongoQuery.vendorId =
      new mongoose.Types.ObjectId(filters.vendorId);
  }

  if (filters.atrId && mongoose.Types.ObjectId.isValid(filters.atrId)) {
    mongoQuery.atrId =
      new mongoose.Types.ObjectId(filters.atrId);
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
  reviewerId?: string
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

  const input =
    reviewProofSchema.parse(data);

  const proof =
    await Proof.findById(proofId);

  if (!proof) {
    throw new Error(
      "Proof not found"
    );
  }

  proof.status = input.status;

  proof.rejectionReason =
    input.status === "Rejected"
      ? input.rejectionReason
      : undefined;

  if (reviewerId && mongoose.Types.ObjectId.isValid(reviewerId)) {
    proof.reviewedBy =
      new mongoose.Types.ObjectId(
        reviewerId
      );
  }

  proof.reviewedAt = new Date();

  await proof.save();

  if (proof.campaignId) {
    try {
      const { Campaign } = await import("../campaigns/campaign.model.js");
      if (input.status === "Complete") {
        await Campaign.findByIdAndUpdate(proof.campaignId, {
          status: "Completed",
          isPowUpdated: true,
        });
        await CampaignPow.findOneAndUpdate(
          { campaignId: proof.campaignId },
          {
            campaignId: proof.campaignId,
            status: "Complete",
            message: "Campaign status has been saved as Complete for this campaign's POW.",
            savedAt: new Date(),
          },
          { upsert: true }
        );
      } else if (input.status === "Rejected") {
        await Campaign.findByIdAndUpdate(proof.campaignId, {
          status: "Rejected",
          isPowUpdated: true,
        });
        await CampaignPow.findOneAndUpdate(
          { campaignId: proof.campaignId },
          {
            campaignId: proof.campaignId,
            status: "Rejected",
            message: "Campaign status has been saved as Rejected for this campaign's POW.",
            savedAt: new Date(),
          },
          { upsert: true }
        );
      }
    } catch {
      // ignore
    }
  }

  const updatedProof = await Proof.findById(proof._id)
    .populate("campaignId", "name campaignCode")
    .populate("vendorId", "name primaryContact companyName")
    .lean();

  return updatedProof || proof;
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

// =====================================================
// Sync / Save Campaign POW
// =====================================================

export async function syncCampaignPow(campaignId: string, userId?: string) {
  if (!mongoose.Types.ObjectId.isValid(campaignId)) {
    throw new Error("Invalid campaign ID");
  }

  const { Campaign } = await import(
    "../campaigns/campaign.model.js"
  );
  const campaign = await Campaign.findById(campaignId);
  if (!campaign) {
    throw new Error("Campaign not found");
  }

  const cStatus = (campaign.status || "").toLowerCase().trim();
  let proofStatus: "Complete" | "Rejected" = "Complete";
  if (
    cStatus === "rejected" ||
    cStatus === "campaign rejected" ||
    cStatus === "cancelled"
  ) {
    proofStatus = "Rejected";
  }

  const location = campaign.city
    ? `${campaign.city}${campaign.state ? `, ${campaign.state}` : ""}`
    : campaign.name || "Campaign Location";

  const message =
    proofStatus === "Complete"
      ? "Campaign status has been saved as Complete for this campaign's POW."
      : "Campaign status has been saved as Rejected for this campaign's POW.";

  const record = await CampaignPow.findOneAndUpdate(
    { campaignId: new mongoose.Types.ObjectId(campaignId) },
    {
      campaignId: new mongoose.Types.ObjectId(campaignId),
      campaignCode: campaign.campaignCode,
      campaignName: campaign.name,
      status: proofStatus,
      locationName: location,
      message,
      savedAt: new Date(),
      savedBy:
        userId && mongoose.Types.ObjectId.isValid(userId)
          ? new mongoose.Types.ObjectId(userId)
          : undefined,
    },
    { upsert: true, new: true }
  );

  campaign.isPowUpdated = true;
  campaign.powUpdatedAt = new Date();
  await campaign.save();

  return record;
}

export async function getAllCampaignPows() {
  return CampaignPow.find().sort({ savedAt: -1 }).lean();
}

export async function getCampaignPow(campaignId: string) {
  if (!mongoose.Types.ObjectId.isValid(campaignId)) return null;
  return CampaignPow.findOne({
    campaignId: new mongoose.Types.ObjectId(campaignId),
  }).lean();
}