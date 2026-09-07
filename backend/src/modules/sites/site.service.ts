import mongoose from "mongoose";

import {
  withOptionalTransaction,
} from "../../core/db/transaction.js";

import {
  Site,
  SiteStatus,
  SiteType,
  ISite,
} from "./site.model.js";

import {
  CreateSiteInput,
  UpdateSiteInput,
} from "./site.validator.js";

/* ----------------------------------
   TYPES
----------------------------------- */

interface SiteFilters {
  city?: string;
  type?: SiteType;
  status?: SiteStatus;
  search?: string;
}

/* ----------------------------------
   CITY CODE
----------------------------------- */

function getCityCode(city: string): string {
  const code = city
    .replace(/[^A-Za-z]/g, "")
    .substring(0, 3)
    .toUpperCase();

  return code.padEnd(3, "X");
}

/* ----------------------------------
   INDIA GPS VALIDATION
----------------------------------- */

function isInsideIndia(
  lat: number,
  lng: number
): boolean {
  const minLat = 6;
  const maxLat = 37.5;

  const minLng = 68;
  const maxLng = 97.5;

  return (
    lat >= minLat &&
    lat <= maxLat &&
    lng >= minLng &&
    lng <= maxLng
  );
}

/* ----------------------------------
   GENERATE SITE CODE
----------------------------------- */

async function generateSiteCode(
  city: string,
  type: SiteType,
  session?: mongoose.ClientSession
): Promise<string> {
  const cityCode = getCityCode(city);

  const typeCode = type
    .replace(/\s+/g, "-")
    .toUpperCase();

  /*
    Counter document is stored in MongoDB.

    We use a collection directly here so
    we don't need another model file.
  */

  const counterCollection =
    mongoose.connection.collection(
      "site_counters"
    );

  const key = `${cityCode}-${typeCode}`;

  const findOptions: any = {
    upsert: true,
    returnDocument: "after",
  };

  if (session) {
    findOptions.session = session;
  }

  const result =
    await counterCollection.findOneAndUpdate(
      {
        id: key,
      },
      {
        $inc: {
          sequence: 1,
        },
      },
      findOptions
    );

  const sequence =
    (result as any)?.sequence ??
    (result as any)?.value?.sequence ??
    1;

  return `${cityCode}-${typeCode}-${String(
    sequence
  ).padStart(3, "0")}`;
}

/* ----------------------------------
   CREATE SITE
----------------------------------- */

export async function createSite(
  data: CreateSiteInput
): Promise<ISite> {
  return withOptionalTransaction(
    async (session) => {
      /*
        1. Validate GPS
      */

      if (
        !isInsideIndia(
          data.gps.lat,
          data.gps.lng
        )
      ) {
        throw new Error(
          "GPS coordinates must fall within India"
        );
      }

      /*
        2. Validate dates
      */

      if (
        Number.isNaN(
          data.startDate.getTime()
        )
      ) {
        throw new Error(
          "Invalid site start date"
        );
      }

      if (
        Number.isNaN(
          data.endDate.getTime()
        )
      ) {
        throw new Error(
          "Invalid site end date"
        );
      }

      if (
        data.endDate < data.startDate
      ) {
        throw new Error(
          "endDate must be on or after startDate"
        );
      }

      /*
        3. Generate unique code
      */

      const code =
        await generateSiteCode(
          data.city,
          data.type,
          session
        );

      /*
        4. Create site
      */

      const saveOptions: any = {};

      if (session) {
        saveOptions.session = session;
      }

      const site = new Site({
        ...data,
        code,
      });

      await site.save(saveOptions);

      return site as unknown as ISite;
    }
  );
}

/* ----------------------------------
   GET SITES
----------------------------------- */

export async function getSites(
  filters: SiteFilters
) {
  const query: Record<
    string,
    any
  > = {};

  if (filters.city) {
    query.city = filters.city;
  }

  if (filters.type) {
    query.type = filters.type;
  }

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.search) {
    query.$or = [
      {
        code: {
          $regex: filters.search,
          $options: "i",
        },
      },
      {
        city: {
          $regex: filters.search,
          $options: "i",
        },
      },
      {
        address: {
          $regex: filters.search,
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
   GET SINGLE SITE
----------------------------------- */

export async function getSiteById(
  id: string
) {
  if (
    !mongoose.Types.ObjectId.isValid(id)
  ) {
    throw new Error(
      "Invalid site ID"
    );
  }

  const site =
    await Site.findById(id)
      .lean();

  if (!site) {
    throw new Error(
      "Site not found"
    );
  }

  return site;
}

/* ----------------------------------
   UPDATE SITE
----------------------------------- */

export async function updateSite(
  id: string,
  data: UpdateSiteInput
) {
  if (
    !mongoose.Types.ObjectId.isValid(id)
  ) {
    throw new Error(
      "Invalid site ID"
    );
  }

  /*
    Validate GPS when GPS is updated.
  */

  if (data.gps) {
    if (
      !isInsideIndia(
        data.gps.lat,
        data.gps.lng
      )
    ) {
      throw new Error(
        "GPS coordinates must fall within India"
      );
    }
  }

  /*
    Validate dates when dates are updated.
  */

  if (data.startDate) {
    if (
      Number.isNaN(
        data.startDate.getTime()
      )
    ) {
      throw new Error(
        "Invalid site start date"
      );
    }
  }

  if (data.endDate) {
    if (
      Number.isNaN(
        data.endDate.getTime()
      )
    ) {
      throw new Error(
        "Invalid site end date"
      );
    }
  }

  /*
    If only one date is updated, compare it
    with the existing site's other date.
  */

  if (
    data.startDate ||
    data.endDate
  ) {
    const existingSite =
      await Site.findById(id)
        .select("startDate endDate")
        .lean();

    if (!existingSite) {
      throw new Error(
        "Site not found"
      );
    }

    const finalStartDate =
      data.startDate ??
      existingSite.startDate;

    const finalEndDate =
      data.endDate ??
      existingSite.endDate;

    if (
      finalStartDate &&
      finalEndDate &&
      finalEndDate < finalStartDate
    ) {
      throw new Error(
        "endDate must be on or after startDate"
      );
    }
  }

  /*
    Code is never accepted
    from the client.
  */

  const updateData: any = {
    ...data,
  };

  delete updateData.code;

  const site =
    await Site.findByIdAndUpdate(
      id,
      updateData,
      {
        returnDocument: "after",
        runValidators: true,
      }
    ).lean();

  if (!site) {
    throw new Error(
      "Site not found"
    );
  }

  return site;
}

/* ----------------------------------
   CSV IMPORT
----------------------------------- */

interface CsvRow {
  city: string;
  type: string;
  address?: string;

  lat: number;
  lng: number;

  startDate: Date;
  endDate: Date;

  sizeWidth: number;
  sizeHeight: number;

  baseCostPerDay: number;
}

/*
  Expected CSV:

  city,type,address,lat,lng,startDate,endDate,sizeWidth,sizeHeight,baseCostPerDay

  Example:

  Mumbai,Airport,Mumbai Airport,19.0896,72.8656,2026-09-01,2026-12-31,40,20,500000
*/

/* ----------------------------------
   CSV PARSER
----------------------------------- */

function parseCsv(
  csv: string
): CsvRow[] {
  const lines = csv
    .trim()
    .split("\n")
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

  return lines
    .slice(1)
    .map((line) => {
      const values =
        line
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

      return {
        city: row.city,

        type: row.type,

        address:
          row.address,

        lat: Number(
          row.lat
        ),

        lng: Number(
          row.lng
        ),

        startDate: new Date(
          row.startDate
        ),

        endDate: new Date(
          row.endDate
        ),

        sizeWidth:
          Number(
            row.sizeWidth
          ),

        sizeHeight:
          Number(
            row.sizeHeight
          ),

        baseCostPerDay:
          Number(
            row.baseCostPerDay
          ),
      };
    });
}

/* ----------------------------------
   CSV VALIDATION
----------------------------------- */

function validateCsvRows(
  rows: CsvRow[]
) {
  const errors: string[] = [];

  rows.forEach(
    (row, index) => {
      const rowNumber =
        index + 2;

      if (!row.city) {
        errors.push(
          `Row ${rowNumber}: city is required`
        );
      }

      if (
        !Object.values(
          SiteType
        ).includes(
          row.type as SiteType
        )
      ) {
        errors.push(
          `Row ${rowNumber}: invalid site type`
        );
      }

      /*
        GPS validation
      */

      if (
        Number.isNaN(
          row.lat
        ) ||
        Number.isNaN(
          row.lng
        )
      ) {
        errors.push(
          `Row ${rowNumber}: invalid GPS`
        );
      }

      if (
        !Number.isNaN(
          row.lat
        ) &&
        !Number.isNaN(
          row.lng
        ) &&
        !isInsideIndia(
          row.lat,
          row.lng
        )
      ) {
        errors.push(
          `Row ${rowNumber}: GPS must be within India`
        );
      }

      /*
        Date validation
      */

      if (
        Number.isNaN(
          row.startDate.getTime()
        )
      ) {
        errors.push(
          `Row ${rowNumber}: invalid start date`
        );
      }

      if (
        Number.isNaN(
          row.endDate.getTime()
        )
      ) {
        errors.push(
          `Row ${rowNumber}: invalid end date`
        );
      }

      if (
        !Number.isNaN(
          row.startDate.getTime()
        ) &&
        !Number.isNaN(
          row.endDate.getTime()
        ) &&
        row.endDate < row.startDate
      ) {
        errors.push(
          `Row ${rowNumber}: end date must be on or after start date`
        );
      }

      /*
        Dimensions
      */

      if (
        row.sizeWidth <= 0 ||
        row.sizeHeight <= 0
      ) {
        errors.push(
          `Row ${rowNumber}: invalid dimensions`
        );
      }

      /*
        Cost
      */

      if (
        !Number.isInteger(
          row.baseCostPerDay
        ) ||
        row.baseCostPerDay < 0
      ) {
        errors.push(
          `Row ${rowNumber}: invalid base cost`
        );
      }
    }
  );

  return errors;
}

/* ----------------------------------
   IMPORT CSV
----------------------------------- */

export async function importSitesFromCsv(
  csv: string
) {
  const rows =
    parseCsv(csv);

  /*
    IMPORTANT:

    Validate EVERYTHING first.

    Do not write anything if even one
    row contains an error.
  */

  const errors =
    validateCsvRows(rows);

  if (
    errors.length > 0
  ) {
    return {
      success: false,
      imported: 0,
      errors,
    };
  }

  return withOptionalTransaction(
    async (session) => {
      const importedSites: ISite[] =
        [];

      const createOptions: any =
        {};

      if (session) {
        createOptions.session =
          session;
      }

      for (
        const row of rows
      ) {
        const code =
          await generateSiteCode(
            row.city,
            row.type as SiteType,
            session
          );

        const site =
          new Site({
            code,

            city:
              row.city,

            type:
              row.type as SiteType,

            address:
              row.address,

            gps: {
              lat:
                row.lat,

              lng:
                row.lng,
            },

            startDate:
              row.startDate,

            endDate:
              row.endDate,

            sizeWidth:
              row.sizeWidth,

            sizeHeight:
              row.sizeHeight,

            baseCostPerDay:
              row.baseCostPerDay,

            vendorId:
              null,

            status:
              SiteStatus.ACTIVE,

            photos: [],
          });

        await site.save(
          createOptions
        );

        importedSites.push(
          site as unknown as ISite
        );
      }

      return {
        success: true,

        imported:
          importedSites.length,

        data:
          importedSites,

        errors: [],
      };
    }
  );
}

/* ----------------------------------
   CROSS-MODULE SERVICE HELPERS
----------------------------------- */

export async function checkSitesExist(
  siteIds: string[],
  session?: mongoose.ClientSession
): Promise<{
  valid: boolean;
  missingIds: string[];
}> {
  const validIds =
    siteIds.filter(
      (id) =>
        mongoose.Types.ObjectId.isValid(
          id
        )
    );

  if (
    validIds.length !==
    siteIds.length
  ) {
    const invalidFormat =
      siteIds.filter(
        (id) =>
          !mongoose.Types.ObjectId.isValid(
            id
          )
      );

    return {
      valid: false,
      missingIds:
        invalidFormat,
    };
  }

  let query =
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
      query.session(
        session
      );
  }

  const found =
    await query.lean();

  const foundIds =
    new Set(
      found.map(
        (s) =>
          s._id.toString()
      )
    );

  const missingIds =
    validIds.filter(
      (id) =>
        !foundIds.has(id)
    );

  return {
    valid:
      missingIds.length === 0,

    missingIds,
  };
}

export async function checkSitesActive(
  siteIds: string[],
  session?: mongoose.ClientSession
): Promise<{
  valid: boolean;
  inactiveCodes: string[];
}> {
  let query =
    Site.find({
      _id: {
        $in: siteIds.map(
          (id) =>
            new mongoose.Types.ObjectId(
              id
            )
        ),
      },

      deletedAt: null,
    }).select(
      "_id code status"
    );

  if (session) {
    query =
      query.session(
        session
      );
  }

  const sites =
    await query.lean();

  const inactive =
    sites.filter(
      (s) =>
        s.status !==
        SiteStatus.ACTIVE
    );

  return {
    valid:
      inactive.length === 0,

    inactiveCodes:
      inactive.map(
        (s) => s.code
      ),
  };
}

export async function getSitesByIds(
  siteIds: string[],
  fields?: string
) {
  let query =
    Site.find({
      _id: {
        $in: siteIds.map(
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
      query.select(
        fields
      );
  }

  return query.lean();
}

export async function getSitesByVendor(
  vendorId: string
) {
  return Site.find({
    vendorId:
      new mongoose.Types.ObjectId(
        vendorId
      ),

    deletedAt: null,
  })
    .select(
      "code city type status startDate endDate gps"
    )
    .sort({
      code: 1,
    })
    .lean();
}

export async function getAvailableSitesInCity(
  city: string,
  bookedSiteIds: string[]
) {
  return Site.find({
    city,

    status:
      SiteStatus.ACTIVE,

    deletedAt: null,

    _id: {
      $nin: bookedSiteIds.map(
        (id) =>
          new mongoose.Types.ObjectId(
            id
          )
      ),
    },
  })
    .populate(
      "vendorId",
      "name city"
    )
    .sort({
      code: 1,
    })
    .lean();
}