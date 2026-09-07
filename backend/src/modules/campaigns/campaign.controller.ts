import { Request, Response } from "express";

import {
  campaignListQuerySchema,
  createCampaignSchema,
  updateCampaignStatusSchema,
} from "./campaign.validator.js";

import {
  createCampaign,
  createFromQuotation,
  getCampaign,
  listCampaigns,
  updateCampaign,
  updateCampaignStatus,
  listCampaignManagers,
  listCampaignLeadOptions,
} from "./campaign.service.js";

import { CampaignStatus } from "./campaign.model.js";

function getContext(req: Request) {
  return {
    userId: (req as any).user?.id,
    role: (req as any).user?.role,
  };
}

export async function createCampaignController(
  req: Request,
  res: Response,
) {
  try {
    const input =
      createCampaignSchema.parse(req.body);

    const campaign =
      await createCampaign(
        input,
        getContext(req),
      );

    return res.status(201).json({
      success: true,
      message: "Campaign created successfully",
      data: campaign,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message:
        error?.message ??
        "Failed to create campaign",
    });
  }
}

export async function listCampaignsController(
  req: Request,
  res: Response,
) {
  try {
    const query =
      campaignListQuerySchema.parse(
        req.query,
      );

    const campaigns =
      await listCampaigns(
        {
          search: query.search,

          status: query.status
            ? (query.status as CampaignStatus)
            : undefined,

          city: query.city,

          manager: query.manager,

          startDate: query.startDate,

          endDate: query.endDate,
        },
        getContext(req),
      );

    const start =
      (query.page - 1) * query.limit;

    const paginated =
      campaigns.slice(
        start,
        start + query.limit,
      );

    return res.status(200).json({
      success: true,
      data: paginated,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: campaigns.length,
        totalPages: Math.ceil(
          campaigns.length /
            query.limit,
        ),
      },
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message:
        error?.message ??
        "Failed to fetch campaigns",
    });
  }
}

export async function getCampaignController(
  req: Request,
  res: Response,
) {
  try {
    const campaign =
      await getCampaign(
        req.params.id as string,
        getContext(req),
      );

    return res.status(200).json({
      success: true,
      data: campaign,
    });
  } catch (error: any) {
    return res.status(404).json({
      success: false,
      message:
        error?.message ??
        "Campaign not found",
    });
  }
}

export async function updateCampaignStatusController(
  req: Request,
  res: Response,
) {
  try {
    const input =
      updateCampaignStatusSchema.parse(
        req.body,
      );

    const campaign =
      await updateCampaignStatus(
        req.params.id as string,
        input.status as CampaignStatus,
        getContext(req),
      );

    return res.status(200).json({
      success: true,
      message:
        "Campaign status updated successfully",
      data: campaign,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message:
        error?.message ??
        "Failed to update campaign status",
    });
  }
}

/**
 * Internal service endpoint used by B3.
 *
 * The PDF specifically requires:
 *
 * createFromQuotation(quotationId, ctx)
 *
 * B3 calls this after client acceptance.
 */
export async function createCampaignFromQuotationController(
  req: Request,
  res: Response,
) {
  try {
    const { quotationId } = req.body;

    if (!quotationId) {
      return res.status(400).json({
        success: false,
        message: "quotationId is required",
      });
    }

    const campaign =
      await createFromQuotation(
        quotationId,
        getContext(req),
      );

    return res.status(201).json({
      success: true,
      message:
        "Campaign created from quotation successfully",
      data: campaign,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message:
        error?.message ??
        "Failed to create campaign from quotation",
    });
  }
}

export async function updateCampaignController(
  req: Request,
  res: Response,
) {
  try {
    const input = createCampaignSchema.partial().parse(req.body);

    const campaign = await updateCampaign(
      req.params.id as string,
      input,
      getContext(req),
    );

    return res.status(200).json({
      success: true,
      message: "Campaign updated successfully",
      data: campaign,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error?.message ?? "Failed to update campaign",
    });
  }
}

export async function listCampaignManagersController(
  _req: Request,
  res: Response,
) {
  try {
    const managers = await listCampaignManagers();
    return res.status(200).json({
      success: true,
      data: managers,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error?.message ?? "Failed to fetch campaign managers",
    });
  }
}

export async function listCampaignLeadOptionsController(
  _req: Request,
  res: Response,
) {
  try {
    const leads = await listCampaignLeadOptions();
    return res.status(200).json({
      success: true,
      data: leads,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error?.message ?? "Failed to fetch lead options",
    });
  }
}