import path from "node:path";
import { Request, Response } from "express";
import { fileService } from "../../core/files/index.js";
import { Proof } from "./proof.model.js";
import * as proofService from "./proof.service.js";

type AuthRequest = Request & {
  user?: {
    _id?: string;
    id?: string;
  };
};

// Generate Proof Link
export const generateProofLink = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const result =
      await proofService.generateProofLink(req.body);

    return res.status(201).json(result);
  } catch (error: any) {
    return res.status(400).json({
      message:
        error?.message ||
        "Failed to generate proof link",
    });
  }
};

// Validate Proof Link
export const validateProofLink = async (
  req: Request,
  res: Response
) => {
  try {
    const token = String(req.params.token);

    if (!token) {
      return res.status(400).json({
        valid: false,
        message: "Proof token is required",
      });
    }

    const result =
      await proofService.validateProofLinkToken(token);

    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(400).json({
      valid: false,
      message:
        error?.message ||
        "Failed to validate proof link",
    });
  }
};

// Create Proof - authenticated flow
export const createProof = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId =
      req.user?._id || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: "Proof image is required",
      });
    }

    const proof =
      await proofService.createProof(
        req.body,
        req.file,
        userId
      );

    return res.status(201).json(proof);
  } catch (error: any) {
    return res.status(400).json({
      message:
        error?.message ||
        "Failed to create proof",
    });
  }
};

// Create Proof using generated token
export const createProofByToken = async (
  req: Request,
  res: Response
) => {
  try {
    const token = String(
      req.params.token
    );

    if (!token) {
      return res.status(400).json({
        message: "Proof token is required",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: "Proof image is required",
      });
    }

    const proof =
      await proofService.createProofByToken(
        token,
        req.body,
        req.file
      );

    return res.status(201).json(proof);
  } catch (error: any) {
    return res.status(400).json({
      message:
        error?.message ||
        "Failed to submit proof",
    });
  }
};

// Get Proofs
export const getProofs = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const proofs =
      await proofService.getProofs(
        req.query
      );

    return res.status(200).json(proofs);
  } catch (error: any) {
    return res.status(400).json({
      message:
        error?.message ||
        "Failed to fetch proofs",
    });
  }
};

// Get Proofs by Task
export const getTaskProofs = async (
  req: Request,
  res: Response
) => {
  try {
    const taskId = String(
      req.params.id
    );

    if (!taskId) {
      return res.status(400).json({
        message: "Task ID is required",
      });
    }

    const proofs =
      await proofService.getTaskProofs(
        taskId
      );

    return res.status(200).json(proofs);
  } catch (error: any) {
    return res.status(400).json({
      message:
        error?.message ||
        "Failed to fetch task proofs",
    });
  }
};

// Review Proof
export const reviewProof = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const proofId = String(
      req.params.id
    );

    const userId =
      req.user?._id || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    if (!proofId) {
      return res.status(400).json({
        message: "Proof ID is required",
      });
    }

    const proof =
      await proofService.reviewProof(
        proofId,
        req.body,
        userId
      );

    return res.status(200).json(proof);
  } catch (error: any) {
    return res.status(400).json({
      message:
        error?.message ||
        "Failed to review proof",
    });
  }
};

// Stream/Serve Proof Image
export const getProofImage = async (
  req: Request,
  res: Response
) => {
  try {
    const proofId = String(req.params.id);
    if (!proofId) {
      return res.status(400).send("Proof ID is required");
    }

    const proof = await Proof.findById(proofId);
    if (!proof) {
      return res.status(404).send("Proof not found");
    }

    const key = proof.watermarkedImageKey || proof.originalImageKey;
    if (!key) {
      return res.status(404).send("Proof image not found");
    }

    if (key.startsWith("http://") || key.startsWith("https://")) {
      return res.redirect(key);
    }

    if (key.startsWith("data:")) {
      const matches = key.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const contentType = matches[1];
        const buffer = Buffer.from(matches[2], "base64");
        res.setHeader("Content-Type", contentType);
        res.setHeader("Cache-Control", "public, max-age=86400");
        return res.send(buffer);
      }
    }

    try {
      const buffer = await fileService.read(key);
      const ext = path.extname(key).toLowerCase();
      const contentType =
        ext === ".png"
          ? "image/png"
          : ext === ".webp"
          ? "image/webp"
          : "image/jpeg";

      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.send(buffer);
    } catch {
      if (proof.watermarkedImageKey && proof.originalImageKey && key !== proof.originalImageKey) {
        try {
          const buffer = await fileService.read(proof.originalImageKey);
          const ext = path.extname(proof.originalImageKey).toLowerCase();
          const contentType =
            ext === ".png"
              ? "image/png"
              : ext === ".webp"
              ? "image/webp"
              : "image/jpeg";
          res.setHeader("Content-Type", contentType);
          res.setHeader("Cache-Control", "public, max-age=86400");
          return res.send(buffer);
        } catch {
          return res.status(404).send("Image file not found on storage");
        }
      }
      return res.status(404).send("Image file not found on storage");
    }
  } catch (error: any) {
    return res.status(400).send(error?.message || "Failed to load proof image");
  }
};

// Get Campaigns by Vendor
export const getCampaignsByVendor = async (
  req: Request,
  res: Response
) => {
  try {
    const vendorId = String(req.params.vendorId);
    if (!vendorId) {
      return res.status(400).json({ message: "Vendor ID is required" });
    }
    const campaigns = await proofService.getCampaignsByVendor(vendorId);
    return res.status(200).json({ data: campaigns });
  } catch (error: any) {
    return res.status(400).json({
      message: error?.message || "Failed to fetch vendor campaigns",
    });
  }
};