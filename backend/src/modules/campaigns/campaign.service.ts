import { ClientSession, Types } from "mongoose";

import { withOptionalTransaction } from "../../core/db/transaction.js";

import Campaign, {
  CampaignStatus,
  ICampaign,
} from "./campaign.model.js";

import { Quotation } from "../quotations/quotations.model.js";
import { createBooking, releaseCampaignBookings } from "../bookings/booking.service.js";
import { checkSitesExist } from "../sites/site.service.js";
import { generateForCampaign } from "../tasks/task.service.js";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type RequestContext = {
  userId: Types.ObjectId | string;
  role?: string;
};

type CreateCampaignInput = {
  name: string;
  leadId: string;
  quotationId?: string;
  city: string;
  startDate: Date;
  endDate: Date;
  siteIds: string[];
  contractedValue: number;
  assignedManager?: string;
};

type CampaignFilters = {
  status?: CampaignStatus;
  city?: string;
  manager?: string;
  startDate?: Date;
  endDate?: Date;
};

/* -------------------------------------------------------------------------- */
/* Status Transitions                                                         */
/* -------------------------------------------------------------------------- */

const STATUS_TRANSITIONS: Record<
  CampaignStatus,
  CampaignStatus[]
> = {
  [CampaignStatus.DRAFT]: [
    CampaignStatus.APPROVED,
    CampaignStatus.CANCELLED,
  ],

  [CampaignStatus.APPROVED]: [
    CampaignStatus.IN_PROGRESS,
    CampaignStatus.CANCELLED,
  ],

  [CampaignStatus.IN_PROGRESS]: [
    CampaignStatus.COMPLETED,
    CampaignStatus.CANCELLED,
  ],

  [CampaignStatus.COMPLETED]: [],

  [CampaignStatus.CANCELLED]: [],
};

/* -------------------------------------------------------------------------- */
/* Validation Helpers                                                         */
/* -------------------------------------------------------------------------- */

function assertValidDates(
  start: Date,
  end: Date,
) {
  if (end <= start) {
    throw new Error(
      "endDate must be after startDate",
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Campaign Code                                                              */
/* -------------------------------------------------------------------------- */

async function generateCampaignCode(
  session?: ClientSession,
) {
  const year = new Date().getFullYear();

  let query = Campaign.findOne({
    campaignCode: new RegExp(
      `^MO-C-${year}-`,
    ),
  }).sort({
    campaignCode: -1,
  });

  if (session) {
    query = query.session(session);
  }

  const last = await query.lean();

  const number = last?.campaignCode
    ? Number(
        last.campaignCode.split("-").pop(),
      ) + 1
    : 1;

  return `MO-C-${year}-${String(
    number,
  ).padStart(4, "0")}`;
}

/* -------------------------------------------------------------------------- */
/* Validate Sites                                                             */
/* -------------------------------------------------------------------------- */

async function validateSitesExist(
  siteIds: string[],
  session?: ClientSession,
) {
  if (!siteIds.length) {
    throw new Error(
      "Campaign must have at least one site",
    );
  }

  const {
    valid,
    missingIds,
  } = await checkSitesExist(
    siteIds,
    session,
  );

  if (!valid) {
    throw new Error(
      `Site(s) not found or invalid: ${missingIds.join(
        ", ",
      )}`,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Identify Invalid Sites                                                     */
/* -------------------------------------------------------------------------- */

export async function identifyInvalidSites(): Promise<
  Array<{
    campaignId: string;
    campaignCode: string;
    invalidSites: string[];
  }>
> {
  const campaigns =
    await Campaign.find().lean();

  const allSiteIds =
    campaigns.flatMap(
      (campaign) =>
        (campaign.siteIds || []).map(
          String,
        ),
    );

  const uniqueIds = [
    ...new Set(allSiteIds),
  ];

  const {
    missingIds,
  } = await checkSitesExist(
    uniqueIds,
  );

  const missingSet =
    new Set(missingIds);

  const result: Array<{
    campaignId: string;
    campaignCode: string;
    invalidSites: string[];
  }> = [];

  for (const campaign of campaigns) {
    const invalidSites =
      (campaign.siteIds || []).filter(
        (siteId: any) =>
          missingSet.has(
            siteId.toString(),
          ),
      );

    if (invalidSites.length > 0) {
      result.push({
        campaignId: String(
          campaign._id,
        ),
        campaignCode:
          campaign.campaignCode,
        invalidSites:
          invalidSites.map((id) =>
            String(id),
          ),
      });
    }
  }

  return result;
}

/* -------------------------------------------------------------------------- */
/* Repair Invalid Sites                                                       */
/* -------------------------------------------------------------------------- */

export async function repairInvalidSites(): Promise<
  Array<{
    campaignId: string;
    campaignCode: string;
    removed: number;
  }>
> {
  const campaigns =
    await Campaign.find().lean();

  const allIds =
    campaigns.flatMap(
      (campaign) =>
        (campaign.siteIds || []).map(
          String,
        ),
    );

  const uniqueIds = [
    ...new Set(allIds),
  ];

  const {
    missingIds,
  } = await checkSitesExist(
    uniqueIds,
  );

  const missingSet =
    new Set(missingIds);

  const repaired: Array<{
    campaignId: string;
    campaignCode: string;
    removed: number;
  }> = [];

  for (const campaign of campaigns) {
    const validSites =
      (campaign.siteIds || []).filter(
        (siteId: any) =>
          !missingSet.has(
            siteId.toString(),
          ),
      );

    const invalidCount =
      (campaign.siteIds || []).length -
      validSites.length;

    if (invalidCount === 0) {
      continue;
    }

    if (validSites.length === 0) {
      console.warn(
        `Campaign ${campaign.campaignCode} has no valid sites — skipping to prevent data loss`,
      );

      continue;
    }

    await Campaign.updateOne(
      {
        _id: campaign._id,
      },
      {
        siteIds: validSites,
      },
    );

    repaired.push({
      campaignId: String(
        campaign._id,
      ),
      campaignCode:
        campaign.campaignCode,
      removed: invalidCount,
    });
  }

  return repaired;
}

/* -------------------------------------------------------------------------- */
/* Create Campaign                                                            */
/* -------------------------------------------------------------------------- */

export async function createCampaign(
  input: CreateCampaignInput,
  ctx: RequestContext,
): Promise<ICampaign> {
  assertValidDates(
    input.startDate,
    input.endDate,
  );

  return withOptionalTransaction(
    async (session) => {
      let quotation = null;

      /*
       * Quotation is optional for normal
       * campaign creation.
       */

      if (
        input.quotationId &&
        Types.ObjectId.isValid(
          input.quotationId,
        )
      ) {
        quotation =
          await Quotation.findOne({
            _id: input.quotationId,
            deletedAt: null,
          }).session(
            session ?? null,
          );

        /*
         * If quotation exists, make sure
         * another campaign is not already
         * linked to it.
         */

        if (quotation) {
          const existing =
            await Campaign.findOne({
              quotationId:
                quotation._id,
            }).session(
              session ?? null,
            );

          if (existing) {
            return existing;
          }
        }
      }

      /* -------------------------- Validate Sites ------------------------- */

      await validateSitesExist(
        input.siteIds,
        session ?? undefined,
      );

      /* --------------------------- Validate Lead ------------------------ */

      if (
        !Types.ObjectId.isValid(
          input.leadId,
        )
      ) {
        throw new Error(
          "Invalid lead id",
        );
      }

      /* ----------------------- Validate Manager -------------------------- */

      let assignedManager:
        | Types.ObjectId
        | undefined;

      if (input.assignedManager) {
        if (
          !Types.ObjectId.isValid(
            input.assignedManager,
          )
        ) {
          throw new Error(
            "Invalid assigned manager id",
          );
        }

        assignedManager =
          new Types.ObjectId(
            input.assignedManager,
          );
      }

      /* -------------------------- Create Campaign ------------------------ */

      const campaign =
        new Campaign({
          campaignCode:
            await generateCampaignCode(
              session,
            ),

          name: input.name,

          leadId:
            new Types.ObjectId(
              input.leadId,
            ),

          quotationId:
            quotation?._id,

          city: input.city,

          startDate:
            input.startDate,

          endDate:
            input.endDate,

          siteIds:
            input.siteIds.map(
              (id) =>
                new Types.ObjectId(id),
            ),

          contractedValue:
            input.contractedValue,

          status:
            CampaignStatus.DRAFT,

          assignedManager,
        });

      await campaign.save({
        session,
      });

      return campaign;
    },
  );
}

/* -------------------------------------------------------------------------- */
/* Create Campaign From Quotation                                             */
/* -------------------------------------------------------------------------- */

export async function createFromQuotation(
  quotationId: string,
  ctx: RequestContext,
): Promise<ICampaign> {
  return withOptionalTransaction(
    async (session) => {
      if (
        !Types.ObjectId.isValid(
          quotationId,
        )
      ) {
        throw new Error(
          "Invalid quotation id",
        );
      }

      const quotation =
        await Quotation.findOne({
          _id: quotationId,
          deletedAt: null,
        }).session(
          session ?? null,
        );

      if (!quotation) {
        throw new Error(
          "Quotation not found",
        );
      }

      const existing =
        await Campaign.findOne({
          quotationId:
            quotation._id,
        }).session(
          session ?? null,
        );

      if (existing) {
        return existing;
      }

      const sites =
        quotation.sites ?? [];

      if (!sites.length) {
        throw new Error(
          "Quotation has no sites",
        );
      }

      const startDate =
        new Date(
          Math.min(
            ...sites.map((site) =>
              new Date(
                site.startDate,
              ).getTime(),
            ),
          ),
        );

      const endDate =
        new Date(
          Math.max(
            ...sites.map((site) =>
              new Date(
                site.endDate,
              ).getTime(),
            ),
          ),
        );

      assertValidDates(
        startDate,
        endDate,
      );

      /* -------------------------- Validate Sites ------------------------- */

      const siteIds =
        sites.map((site) =>
          String(site.siteId),
        );

      await validateSitesExist(
        siteIds,
        session ?? undefined,
      );

      /* -------------------------- Create Campaign ------------------------ */

      const campaign =
        new Campaign({
          campaignCode:
            await generateCampaignCode(
              session,
            ),

          name:
            quotation.clientName ||
            "Campaign",

          leadId:
            quotation.leadId,

          quotationId:
            quotation._id,

          city: "",

          startDate,

          endDate,

          siteIds:
            sites.map(
              (site) =>
                site.siteId,
            ),

          contractedValue:
            quotation.total,

          status:
            CampaignStatus.DRAFT,
        });

      await campaign.save({
        session,
      });

      return campaign;
    },
  );
}

/* -------------------------------------------------------------------------- */
/* Campaign List                                                              */
/* -------------------------------------------------------------------------- */

export async function listCampaigns(
  filters: CampaignFilters,
  ctx: RequestContext,
) {
  const query: Record<string, any> =
    {};

  if (filters.status) {
    query.status =
      filters.status;
  }

  if (filters.city?.trim()) {
    query.city = new RegExp(
      filters.city.trim(),
      "i",
    );
  }

  if (filters.manager?.trim()) {
    if (
      Types.ObjectId.isValid(
        filters.manager,
      )
    ) {
      query.assignedManager =
        new Types.ObjectId(
          filters.manager,
        );
    }
  }

  /*
   * Date filtering.
   *
   * If both dates are supplied, find campaigns
   * whose start date falls within the range.
   */

  if (
    filters.startDate ||
    filters.endDate
  ) {
    query.startDate = {};

    if (filters.startDate) {
      query.startDate.$gte =
        filters.startDate;
    }

    if (filters.endDate) {
      query.startDate.$lte =
        filters.endDate;
    }
  }

  return Campaign.find(query)
    .populate(
      "leadId",
      "name company email",
    )
    .populate(
      "siteIds",
      "name code city type size baseCostPerDay",
    )
    .populate(
      "assignedManager",
      "name email",
    )
    .sort({
      createdAt: -1,
    });
}

/* -------------------------------------------------------------------------- */
/* Get Campaign                                                               */
/* -------------------------------------------------------------------------- */

export async function getCampaign(
  id: string,
  ctx: RequestContext,
) {
  if (
    !Types.ObjectId.isValid(id)
  ) {
    throw new Error(
      "Invalid campaign id",
    );
  }

  const campaign =
    await Campaign.findById(id)
      .populate(
        "leadId",
        "name company email phone",
      )
      .populate(
        "quotationId",
        "quoteNumber total sites",
      )
      .populate(
        "siteIds",
        "name code city type size baseCostPerDay",
      )
      .populate(
        "assignedManager",
        "name email",
      );

  if (!campaign) {
    throw new Error(
      "Campaign not found",
    );
  }

  return campaign;
}

/* -------------------------------------------------------------------------- */
/* Update Campaign Status                                                     */
/* -------------------------------------------------------------------------- */

export async function updateCampaignStatus(
  id: string,
  nextStatus: CampaignStatus,
  ctx: RequestContext,
) {
  if (
    !Types.ObjectId.isValid(id)
  ) {
    throw new Error(
      "Invalid campaign id",
    );
  }

  return withOptionalTransaction(
    async (session) => {
      const campaign =
        await Campaign.findById(
          id,
        ).session(
          session ?? null,
        );

      if (!campaign) {
        throw new Error(
          "Campaign not found",
        );
      }

      /* ----------------------- Same Status Check ------------------------- */

      if (
        campaign.status ===
        nextStatus
      ) {
        throw new Error(
          `Campaign is already ${nextStatus}`,
        );
      }

      /* ---------------------- Transition Check --------------------------- */

      if (
        !STATUS_TRANSITIONS[
          campaign.status
        ].includes(nextStatus)
      ) {
        throw new Error(
          `Invalid campaign status transition: ${campaign.status} → ${nextStatus}`,
        );
      }

      /* -------------------------------------------------------------------- */
      /* Approval Flow                                                        */
      /* -------------------------------------------------------------------- */

      if (
        nextStatus ===
        CampaignStatus.APPROVED
      ) {
        /*
         * Validate campaign sites first.
         */

        await validateSitesExist(
          campaign.siteIds.map(
            (id) => String(id),
          ),
          session ?? undefined,
        );

        /*
         * Pre-check for booking conflicts before writing anything.
         * Gives a clear error listing the conflicting sites and date
         * rather than a low-level duplicate key error.
         */
        const { SiteBooking } = await import(
          "../bookings/site-booking.model.js"
        );

        const conflictingInfo: string[] = [];

        for (const siteId of campaign.siteIds) {
          const conflicts = await SiteBooking.find({
            siteId: new Types.ObjectId(String(siteId)),
            date: {
              $gte: campaign.startDate,
              $lte: campaign.endDate,
            },
            campaignId: { $ne: campaign._id },
          })
            .populate("campaignId", "campaignCode name status")
            .session(session ?? null)
            .lean();

          for (const conflict of conflicts) {
            const ownerCamp = conflict.campaignId as any;
            if (
              !ownerCamp ||
              ownerCamp.status === "Cancelled" ||
              ownerCamp.status === "Completed"
            ) {
              // Stale booking from inactive/completed campaign: clean it up
              await SiteBooking.deleteMany({
                _id: conflict._id,
              }).session(session ?? null);
              continue;
            }

            const ownerCode =
              ownerCamp.campaignCode ||
              ownerCamp.name ||
              String(conflict.campaignId);
            const conflictMsg = `Site ${String(siteId)} is already booked by campaign ${ownerCode} (${ownerCamp.status})`;
            if (!conflictingInfo.includes(conflictMsg)) {
              conflictingInfo.push(conflictMsg);
            }
          }
        }

        if (conflictingInfo.length > 0) {
          throw new Error(
            `Cannot approve campaign: booking conflicts detected.\n${conflictingInfo.join("\n")}`,
          );
        }

        /*
         * Create bookings one by one.
         *
         * This is intentionally sequential.
         * It avoids Promise.all() creating multiple
         * independent booking operations while the
         * campaign itself is inside a transaction.
         */

        for (const siteId of campaign.siteIds) {
          await createBooking({
            siteId: String(siteId),

            campaignId:
              String(
                campaign._id,
              ),

            from:
              campaign.startDate,

            to:
              campaign.endDate,
          });
        }
      }

      /* ---- Release bookings when campaign is cancelled or completed ---- */

      if (
        nextStatus === CampaignStatus.CANCELLED ||
        nextStatus === CampaignStatus.COMPLETED
      ) {
        try {
          await releaseCampaignBookings(String(campaign._id));
        } catch (releaseErr) {
          console.warn(
            `[Bookings] Could not release bookings for ${nextStatus} campaign ${campaign._id}:`,
            releaseErr,
          );
        }
      }

      /* ------------------------- Update Status ---------------------------- */

      campaign.status =
        nextStatus;

      await campaign.save({
        session,
      });

      /* -------------------------------------------------------------------- */
      /* Auto Generate Tasks After Approval                                   */
      /* -------------------------------------------------------------------- */

      if (
        nextStatus ===
        CampaignStatus.APPROVED
      ) {
        try {
          await generateForCampaign(
            campaign,
            {
              userId: String(
                ctx.userId,
              ),
              role: ctx.role,
            },
          );
        } catch (taskErr) {
          console.error(
            `[D1] Failed to auto-generate tasks for campaign ${campaign._id}:`,
            taskErr,
          );
        }
      }

      return campaign;
    },
  );
}