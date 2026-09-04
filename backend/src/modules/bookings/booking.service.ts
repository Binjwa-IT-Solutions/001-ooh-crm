import { Types } from "mongoose";

import { withOptionalTransaction } from "../../core/db/transaction.js";

import {
  getSitesByIds,
  getAvailableSitesInCity,
} from "../sites/site.service.js";

import { SiteBooking } from "./site-booking.model.js";

/* -------------------------------------------------------------------------- */
/* Date Helpers                                                               */
/* -------------------------------------------------------------------------- */

function normalizeDateUTC(date: Date): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
    ),
  );
}

function generateDates(
  from: Date,
  to: Date,
): Date[] {
  const dates: Date[] = [];

  let current = normalizeDateUTC(from);
  const end = normalizeDateUTC(to);

  while (current <= end) {
    dates.push(new Date(current));

    current = new Date(
      current.getTime() + 86400000,
    );
  }

  return dates;
}

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

interface CreateBookingInput {
  siteId: string;
  campaignId: string;
  quotationId?: string;
  from: Date;
  to: Date;
}

/* -------------------------------------------------------------------------- */
/* Create Booking                                                             */
/* -------------------------------------------------------------------------- */

export async function createBooking(
  data: CreateBookingInput,
) {
  return withOptionalTransaction(async (session) => {
    /* ----------------------------- Validation ---------------------------- */

    if (!Types.ObjectId.isValid(data.siteId)) {
      throw new Error(
        `Invalid site id: ${data.siteId}`,
      );
    }

    if (!Types.ObjectId.isValid(data.campaignId)) {
      throw new Error(
        `Invalid campaign id: ${data.campaignId}`,
      );
    }

    if (
      data.quotationId &&
      !Types.ObjectId.isValid(data.quotationId)
    ) {
      throw new Error(
        `Invalid quotation id: ${data.quotationId}`,
      );
    }

    /* ------------------------------- Site -------------------------------- */

    const sites = await getSitesByIds([
      data.siteId,
    ]);

    const site = sites[0];

    if (!site) {
      throw new Error(
        `Site not found: ${data.siteId}`,
      );
    }

    if (site.status !== "Active") {
      throw new Error(
        `Site ${site.code} is not active`,
      );
    }

    /* ------------------------------- Dates ------------------------------- */

    const dates = generateDates(
      data.from,
      data.to,
    );

    const results = [];

    /* ---------------------------------------------------------------------- */
    /* Check + Create Each Daily Booking                                      */
    /* ---------------------------------------------------------------------- */

    for (const date of dates) {
      const existing = await SiteBooking.findOne({
        siteId: new Types.ObjectId(
          data.siteId,
        ),
        date,
      }).session(session ?? null);

      /* -------------------------------------------------------------------- */
      /* Same campaign already owns this date                                */
      /* -------------------------------------------------------------------- */

      if (
        existing &&
        String(existing.campaignId) ===
          String(data.campaignId)
      ) {
        results.push(existing);
        continue;
      }

      /* -------------------------------------------------------------------- */
      /* Another campaign already owns this date                             */
      /* -------------------------------------------------------------------- */

      if (existing) {
        const { Campaign } = await import(
          "../campaigns/campaign.model.js"
        );
        const existingCamp = await Campaign.findById(existing.campaignId)
          .session(session ?? null)
          .lean();

        if (
          !existingCamp ||
          existingCamp.status === "Cancelled" ||
          existingCamp.status === "Completed"
        ) {
          // Stale booking: delete it and allow new booking to take over
          await SiteBooking.deleteOne({
            _id: existing._id,
          }).session(session ?? null);
        } else {
          throw new Error(
            `Site ${site.code} is already booked for ${date
              .toISOString()
              .slice(0, 10)} by campaign ${
              existingCamp.campaignCode || existingCamp.name
            }`,
          );
        }
      }

      /* -------------------------------------------------------------------- */
      /* Create Booking                                                       */
      /* -------------------------------------------------------------------- */

      const booking = new SiteBooking({
        siteId: new Types.ObjectId(
          data.siteId,
        ),

        date,

        campaignId: new Types.ObjectId(
          data.campaignId,
        ),

        ...(data.quotationId
          ? {
              quotationId:
                new Types.ObjectId(
                  data.quotationId,
                ),
            }
          : {}),
      });

      await booking.save({
        ...(session ? { session } : {}),
      });

      results.push(booking);
    }

    return results;
  });
}

/* -------------------------------------------------------------------------- */
/* Site Availability                                                          */
/* -------------------------------------------------------------------------- */

export async function getSiteAvailability(
  siteId: string,
  from: Date,
  to: Date,
) {
  return SiteBooking.find({
    siteId,

    date: {
      $gte: normalizeDateUTC(from),
      $lte: normalizeDateUTC(to),
    },
  })
    .sort({
      date: 1,
    })
    .lean();
}

/* -------------------------------------------------------------------------- */
/* Get Booked Site IDs                                                        */
/* -------------------------------------------------------------------------- */

export async function getBookedSiteIds(
  from: Date,
  to: Date,
): Promise<string[]> {
  const bookings = await SiteBooking.find({
    date: {
      $gte: normalizeDateUTC(from),
      $lte: normalizeDateUTC(to),
    },
  })
    .select("siteId")
    .lean();

  return [
    ...new Set(
      bookings.map((booking) =>
        String(booking.siteId),
      ),
    ),
  ];
}

/* -------------------------------------------------------------------------- */
/* Get Available Sites                                                        */
/* -------------------------------------------------------------------------- */

export async function getAvailableSites(
  city: string,
  from: Date,
  to: Date,
) {
  const bookedSiteIds =
    await getBookedSiteIds(
      from,
      to,
    );

  return getAvailableSitesInCity(
    city,
    bookedSiteIds,
  );
}

/* -------------------------------------------------------------------------- */
/* Booking History                                                            */
/* -------------------------------------------------------------------------- */

export async function getBookingHistory() {
  const bookings =
    await SiteBooking.find({})
      .populate({
        path: "siteId",
        select:
          "code city type baseCostPerDay",
      })
      .sort({
        date: -1,
      })
      .lean();

  return bookings;
}

/* -------------------------------------------------------------------------- */
/* Release Campaign Bookings                                                  */
/* -------------------------------------------------------------------------- */

export async function releaseCampaignBookings(
  campaignId: string,
) {
  if (!Types.ObjectId.isValid(campaignId)) {
    throw new Error(
      `Invalid campaign id: ${campaignId}`,
    );
  }

  const result =
    await SiteBooking.deleteMany({
      campaignId: new Types.ObjectId(
        campaignId,
      ),
    });

  return {
    released: result.deletedCount,
  };
}