import mongoose from "mongoose";

import {
  Site,
  ATRStatus,
  AvailabilityStatus,
  MediaType,
} from "./site.model.js";

import type { ISite } from "./site.model.js";

import type {
  CreateSiteInput,
  UpdateSiteInput,
  SiteQueryInput,
} from "./site.validator.js";

const EDIT_LIMIT = 48 * 60 * 60 * 1000;

/* ----------------------------------
   DATE
----------------------------------- */

function normalizeDate(
  value: string | Date
): Date {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date");
  }

  return date;
}

/* ----------------------------------
   DURATION
----------------------------------- */

function calculateDuration(
  startDate: Date,
  endDate: Date
): number {
  const start = new Date(startDate);
  const end = new Date(endDate);

  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  return (
    Math.floor(
      (end.getTime() - start.getTime()) /
        (1000 * 60 * 60 * 24)
    ) + 1
  );
}

/* ----------------------------------
   ESCAPE REGEX
----------------------------------- */

function escapeRegex(
  value: string
): string {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

/* ----------------------------------
   ATR NUMBER HELPERS
----------------------------------- */

function getAtrNumber(
  atrNo: string
): number {
  const number = Number(
    atrNo.replace(/^ATR-/i, "")
  );

  return Number.isNaN(number)
    ? 0
    : number;
}

async function getLastAtrNumber(): Promise<number> {
  const atrs = await Site.find({
    atrNo: {
      $regex: /^ATR-\d+$/i,
    },
    deletedAt: null,
  })
    .select("atrNo")
    .lean();

  let maxNumber = 0;

  for (const atr of atrs) {
    const number = getAtrNumber(
      atr.atrNo
    );

    if (number > maxNumber) {
      maxNumber = number;
    }
  }

  return maxNumber;
}

/* ----------------------------------
   GENERATE ATR NO
----------------------------------- */

export async function generateAtrNo(): Promise<string> {
  const lastNumber =
    await getLastAtrNumber();

  return `ATR-${String(
    lastNumber + 1
  ).padStart(3, "0")}`;
}

/* ----------------------------------
   BACKFILL OLD ATRS
----------------------------------- */

export async function backfillAtrNumbers() {
  const oldAtrs = await Site.find({
    $or: [
      {
        atrNo: {
          $exists: false,
        },
      },
      {
        atrNo: null,
      },
      {
        atrNo: "",
      },
    ],
    deletedAt: null,
  })
    .sort({
      createdAt: 1,
    })
    .select("_id atrNo")
    .lean();

  if (!oldAtrs.length) {
    return {
      updated: 0,
    };
  }

  const lastNumber =
    await getLastAtrNumber();

  const operations =
    oldAtrs.map(
      (atr, index) => ({
        updateOne: {
          filter: {
            _id: atr._id,
          },
          update: {
            $set: {
              atrNo: `ATR-${String(
                lastNumber + index + 1
              ).padStart(3, "0")}`,
            },
          },
        },
      })
    );

  if (operations.length) {
    await Site.bulkWrite(
      operations
    );
  }

  return {
    updated: operations.length,
  };
}

/* ----------------------------------
   CREATE ATR
----------------------------------- */

export async function createSite(
  data: CreateSiteInput
): Promise<ISite> {
  const startDate =
    normalizeDate(data.startDate);

  const endDate =
    normalizeDate(data.endDate);

  if (endDate < startDate) {
    throw new Error(
      "End date must be on or after start date"
    );
  }

  const duration =
    calculateDuration(
      startDate,
      endDate
    );

  const atrNo =
    await generateAtrNo();

  const existing =
    await Site.findOne({
      atrNo,
      deletedAt: null,
    }).lean();

  if (existing) {
    throw new Error(
      `ATR ${atrNo} already exists`
    );
  }

  const atr = new Site({
    atrNo,

    clientName:
      data.clientName,

    salesPersonName:
      data.salesPersonName,

    salesPersonContact:
      data.salesPersonContact || data.vendorContact || "",

    vendorContact:
      data.vendorContact || data.salesPersonContact || "",

    state:
      data.state.trim(),

    city:
      data.city.trim(),

    location:
      data.location.trim(),

    mediaType:
      data.mediaType,

    quantity:
      data.quantity,

    startDate,

    endDate,

    duration,

    vendorName:
      data.vendorName.trim(),

    availability:
      data.availability ??
      AvailabilityStatus.AVAILABLE,

    status:
      data.status ??
      ATRStatus.ON_CALL,

    deletedAt: null,
  });

  await atr.save();

  return atr;
}

/* ----------------------------------
   GET ALL ATR
----------------------------------- */

export async function getSites(
  filters: SiteQueryInput = {}
) {
  await backfillAtrNumbers();

  const query: any = {
    deletedAt: null,
  };

  /* STATE */

  if (filters.state?.trim()) {
    query.state = {
      $regex: escapeRegex(
        filters.state.trim()
      ),
      $options: "i",
    };
  }

  /* CITY */

  if (filters.city?.trim()) {
    query.city = {
      $regex: escapeRegex(
        filters.city.trim()
      ),
      $options: "i",
    };
  }

  /* VENDOR */

  if (filters.vendorName?.trim()) {
    query.vendorName = {
      $regex: escapeRegex(
        filters.vendorName.trim()
      ),
      $options: "i",
    };
  }

  /* SALES PERSON */

  if (
    filters.salesPersonName?.trim()
  ) {
    query.salesPersonName = {
      $regex: escapeRegex(
        filters.salesPersonName.trim()
      ),
      $options: "i",
    };
  }

  /* MEDIA TYPE */

  if (filters.mediaType) {
    query.mediaType =
      filters.mediaType;
  }

  /* AVAILABILITY */

  if (filters.availability) {
    query.availability =
      filters.availability;
  }

  /* STATUS */

  if (filters.status) {
    query.status =
      filters.status;
  }

  /* SEARCH */

  if (filters.search?.trim()) {
    const search =
      escapeRegex(
        filters.search.trim()
      );

    query.$or = [
      {
        atrNo: {
          $regex: search,
          $options: "i",
        },
      },
      {
        clientName: {
          $regex: search,
          $options: "i",
        },
      },
      {
        salesPersonName: {
          $regex: search,
          $options: "i",
        },
      },
      {
        salesPersonContact: {
          $regex: search,
          $options: "i",
        },
      },
      {
        vendorContact: {
          $regex: search,
          $options: "i",
        },
      },
      {
        state: {
          $regex: search,
          $options: "i",
        },
      },
      {
        city: {
          $regex: search,
          $options: "i",
        },
      },
      {
        location: {
          $regex: search,
          $options: "i",
        },
      },
      {
        vendorName: {
          $regex: search,
          $options: "i",
        },
      },
    ];
  }

  return Site.find(query)
    .sort({
      createdAt: -1,
    })
    .lean();
}

/* ----------------------------------
   GET ONE ATR
----------------------------------- */

export async function getSiteById(
  id: string
) {
  if (
    !mongoose.Types.ObjectId.isValid(
      id
    )
  ) {
    throw new Error(
      "Invalid ATR ID"
    );
  }

  await backfillAtrNumbers();

  const atr =
    await Site.findOne({
      _id: id,
      deletedAt: null,
    }).lean();

  if (!atr) {
    throw new Error(
      "ATR not found"
    );
  }

  return atr;
}

/* ----------------------------------
   UPDATE ATR
   ONLY 48 HOURS
----------------------------------- */

export async function updateSite(
  id: string,
  data: UpdateSiteInput
) {
  if (
    !mongoose.Types.ObjectId.isValid(
      id
    )
  ) {
    throw new Error(
      "Invalid ATR ID"
    );
  }

  const existing =
    await Site.findOne({
      _id: id,
      deletedAt: null,
    }).lean();

  if (!existing) {
    throw new Error(
      "ATR not found"
    );
  }

  /* 48 HOURS CHECK */

  const createdAt =
    new Date(
      existing.createdAt
    ).getTime();

  const age =
    Date.now() - createdAt;

  if (age >= EDIT_LIMIT) {
    throw new Error(
      "Edit time expired. ATR can only be edited within 48 hours of creation."
    );
  }

  /* DATE */

  let startDate =
    existing.startDate;

  let endDate =
    existing.endDate;

  if (
    data.startDate !== undefined
  ) {
    startDate =
      normalizeDate(
        data.startDate
      );
  }

  if (
    data.endDate !== undefined
  ) {
    endDate =
      normalizeDate(
        data.endDate
      );
  }

  if (endDate < startDate) {
    throw new Error(
      "End date must be on or after start date"
    );
  }

  /* DURATION */

  const duration =
    data.startDate !== undefined ||
    data.endDate !== undefined
      ? calculateDuration(
          startDate,
          endDate
        )
      : existing.duration;

  /* UPDATE */

  const updateData: any = {
    ...data,
    startDate,
    endDate,
    duration,
  };

  if (
    data.vendorContact !== undefined &&
    data.salesPersonContact === undefined
  ) {
    updateData.salesPersonContact =
      data.vendorContact;
  }

  if (
    data.salesPersonContact !== undefined &&
    data.vendorContact === undefined
  ) {
    updateData.vendorContact =
      data.salesPersonContact;
  }

  /* ATR NO CANNOT CHANGE */

  delete updateData.atrNo;

  /* TRIM TEXT VALUES */

  if (typeof updateData.state === "string") {
    updateData.state =
      updateData.state.trim();
  }

  if (typeof updateData.city === "string") {
    updateData.city =
      updateData.city.trim();
  }

  if (
    typeof updateData.location ===
    "string"
  ) {
    updateData.location =
      updateData.location.trim();
  }

  if (
    typeof updateData.vendorName ===
    "string"
  ) {
    updateData.vendorName =
      updateData.vendorName.trim();
  }

  const updated =
    await Site.findOneAndUpdate(
      {
        _id: id,
        deletedAt: null,
      },
      {
        $set: updateData,
      },
      {
        new: true,
        runValidators: true,
      }
    ).lean();

  if (!updated) {
    throw new Error(
      "ATR not found"
    );
  }

  return updated;
}

/* ----------------------------------
   GET STATES
   DYNAMIC FROM MONGODB
----------------------------------- */

export async function getSiteStates(
  search = ""
): Promise<string[]> {
  const query: any = {
    deletedAt: null,
  };

  if (search.trim()) {
    query.state = {
      $regex: escapeRegex(
        search.trim()
      ),
      $options: "i",
    };
  }

  const states =
    await Site.distinct(
      "state",
      query
    );

  return states
    .filter(Boolean)
    .map((state) =>
      String(state).trim()
    )
    .filter(Boolean)
    .sort((a, b) =>
      a.localeCompare(b)
    );
}

/* ----------------------------------
   GET CITIES
   BASED ON STATE
----------------------------------- */

export async function getSiteCities(
  state: string,
  search = ""
): Promise<string[]> {
  const cleanState =
    state?.trim();

  if (!cleanState) {
    throw new Error(
      "State is required"
    );
  }

  const query: any = {
    deletedAt: null,

    state: {
      $regex: `^${escapeRegex(
        cleanState
      )}$`,
      $options: "i",
    },
  };

  if (search.trim()) {
    query.city = {
      $regex: escapeRegex(
        search.trim()
      ),
      $options: "i",
    };
  }

  const cities =
    await Site.distinct(
      "city",
      query
    );

  return cities
    .filter(Boolean)
    .map((city) =>
      String(city).trim()
    )
    .filter(Boolean)
    .sort((a, b) =>
      a.localeCompare(b)
    );
}

/* ----------------------------------
   CSV IMPORT
----------------------------------- */

export async function importSitesFromCsv(
  csv: string
) {
  const lines = csv
    .trim()
    .split(/\r?\n/)
    .map((line) =>
      line.trim()
    )
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error(
      "CSV must contain header and data"
    );
  }

  const headers =
    lines[0]
      .split(",")
      .map((header) =>
        header.trim()
      );

  const imported: ISite[] = [];

  const errors: {
    row: number;
    message: string;
  }[] = [];

  for (
    let i = 1;
    i < lines.length;
    i++
  ) {
    try {
      const values =
        lines[i]
          .split(",")
          .map((value) =>
            value.trim()
          );

      const row: any = {};

      headers.forEach(
        (header, index) => {
          row[header] =
            values[index];
        }
      );

      const input =
        createSiteDataFromCsv(row);

      const atr =
        await createSite(input);

      imported.push(atr);
    } catch (error: any) {
      errors.push({
        row: i + 1,
        message:
          error?.message ||
          "Invalid row",
      });
    }
  }

  return {
    success:
      errors.length === 0,

    imported:
      imported.length,

    data: imported,

    errors,
  };
}

/* ----------------------------------
   CSV CONVERTER
----------------------------------- */

function createSiteDataFromCsv(
  row: any
): CreateSiteInput {
  return {
    clientName:
      row.clientName,

    salesPersonName:
      row.salesPersonName,

    salesPersonContact:
      row.salesPersonContact || row.vendorContact,

    vendorContact:
      row.vendorContact || row.salesPersonContact,

    state:
      row.state,

    city:
      row.city,

    location:
      row.location,

    mediaType:
      row.mediaType as MediaType,

    quantity:
      Number(row.quantity),

    startDate:
      row.startDate,

    endDate:
      row.endDate,

    vendorName:
      row.vendorName,

    availability:
      row.availability ||
      AvailabilityStatus.AVAILABLE,

    status:
      row.status ||
      ATRStatus.ON_CALL,
  };
}

/* ----------------------------------
   CHECK ATR EXIST
----------------------------------- */

export async function checkSitesExist(
  siteIds: string[],
  session?: mongoose.ClientSession
) {
  const validIds =
    siteIds.filter((id) =>
      mongoose.Types.ObjectId.isValid(
        id
      )
    );

  if (
    validIds.length !==
    siteIds.length
  ) {
    return {
      valid: false,

      missingIds:
        siteIds.filter(
          (id) =>
            !mongoose.Types.ObjectId.isValid(
              id
            )
        ),
    };
  }

  let query: any =
    Site.find({
      _id: {
        $in: validIds.map(
          (id) =>
            new mongoose.Types.ObjectId(
              id
            )
        ),
      },

      deletedAt: null,
    }).select("_id");

  if (session) {
    query =
      query.session(session);
  }

  const sites =
    await query.lean();

  const found =
    new Set(
      sites.map(
        (site: any) =>
          site._id.toString()
      )
    );

  const missingIds =
    validIds.filter(
      (id) =>
        !found.has(id)
    );

  return {
    valid:
      missingIds.length === 0,

    missingIds,
  };
}

/* ----------------------------------
   CHECK ATR ACTIVE
----------------------------------- */

export async function checkSitesActive(
  siteIds: string[],
  session?: mongoose.ClientSession
) {
  const validIds =
    siteIds.filter((id) =>
      mongoose.Types.ObjectId.isValid(
        id
      )
    );

  if (
    validIds.length !==
    siteIds.length
  ) {
    return {
      valid: false,
      inactiveCodes: [],
    };
  }

  let query: any =
    Site.find({
      _id: {
        $in: validIds.map(
          (id) =>
            new mongoose.Types.ObjectId(
              id
            )
        ),
      },

      deletedAt: null,
    }).select(
      "_id atrNo status availability"
    );

  if (session) {
    query =
      query.session(session);
  }

  const sites =
    await query.lean();

  const invalid =
    sites.filter(
      (site: any) =>
        site.status !==
          ATRStatus.APPROVED ||
        site.availability ===
          AvailabilityStatus.BOOKED
    );

  return {
    valid:
      invalid.length === 0,

    inactiveCodes:
      invalid.map(
        (site: any) =>
          site.atrNo
      ),
  };
}

/* ----------------------------------
   GET ATR BY IDS
----------------------------------- */

export async function getSitesByIds(
  siteIds: string[],
  fields?: string
) {
  const validIds =
    siteIds.filter((id) =>
      mongoose.Types.ObjectId.isValid(
        id
      )
    );

  if (!validIds.length) {
    return [];
  }

  let query: any =
    Site.find({
      _id: {
        $in: validIds.map(
          (id) =>
            new mongoose.Types.ObjectId(
              id
            )
        ),
      },

      deletedAt: null,
    });

  if (fields) {
    query =
      query.select(fields);
  }

  return query.lean();
}

/* ----------------------------------
   GET ATR BY VENDOR
----------------------------------- */

export async function getSitesByVendor(
  vendorName: string
) {
  if (!vendorName?.trim()) {
    throw new Error(
      "Vendor name is required"
    );
  }

  await backfillAtrNumbers();

  return Site.find({
    vendorName: {
      $regex: escapeRegex(
        vendorName.trim()
      ),
      $options: "i",
    },

    deletedAt: null,
  })
    .select(
      "atrNo clientName salesPersonName salesPersonContact vendorContact state city location mediaType quantity startDate endDate duration vendorName availability status"
    )
    .sort({
      atrNo: 1,
    })
    .lean();
}

/* ----------------------------------
   AVAILABLE ATRS IN CITY
----------------------------------- */

export async function getAvailableSitesInCity(
  city: string,
  excludeIds: string[] = []
) {
  if (!city?.trim()) {
    throw new Error(
      "City is required"
    );
  }

  const query: any = {
    city: {
      $regex:
        `^${escapeRegex(
          city.trim()
        )}$`,
      $options: "i",
    },

    availability:
      AvailabilityStatus.AVAILABLE,

    deletedAt: null,
  };

  if (excludeIds.length) {
    query._id = {
      $nin: excludeIds,
    };
  }

  return Site.find(query)
    .sort({
      startDate: 1,
    })
    .lean();
}

