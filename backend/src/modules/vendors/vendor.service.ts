import mongoose from "mongoose";

import { Vendor } from "./vendor.model.js";
import { Site } from "../sites/site.model.js";

export interface VendorFilters {
  search?: string;
  state?: string;
  city?: string;
  status?: "Active" | "Inactive";
}

export interface VendorStateFilter {
  state: string;
  vendorCount: number;
  cityCount: number;
  cities: string[];
}

/* ----------------------------------
   GET VENDORS WITH BACKEND FILTER
----------------------------------- */

export async function getVendors(
  filters: VendorFilters = {},
) {
  const query: Record<string, any> = {
    deletedAt: null,
  };

  /* SEARCH */
  if (filters.search?.trim()) {
    const search = filters.search.trim();

    query.$or = [
      {
        name: {
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
        contactPerson: {
          $regex: search,
          $options: "i",
        },
      },
      {
        mobile: {
          $regex: search,
          $options: "i",
        },
      },
      {
        email: {
          $regex: search,
          $options: "i",
        },
      },
      {
        gstNumber: {
          $regex: search,
          $options: "i",
        },
      },
    ];
  }

  /* STATE FILTER */
  if (filters.state?.trim()) {
    query.state = filters.state.trim();
  }

  /* CITY FILTER */
  if (filters.city?.trim()) {
    query.city = filters.city.trim();
  }

  /* STATUS FILTER */
  if (filters.status) {
    query.status = filters.status;
  }

  return Vendor.find(query)
    .sort({
      createdAt: -1,
    })
    .lean();
}


/* ----------------------------------
   GET VENDOR FILTER OPTIONS
----------------------------------- */

export async function getVendorFilters(
  selectedState?: string,
) {
  const query: Record<string, any> = {
    deletedAt: null,
  };

  if (selectedState?.trim()) {
    query.state = selectedState.trim();
  }

  const vendors = await Vendor.find(query)
    .select("state city")
    .lean();

  const stateMap = new Map<
    string,
    {
      cities: Set<string>;
      vendorCount: number;
    }
  >();

  for (const vendor of vendors) {
    if (!vendor.state) continue;

    if (!stateMap.has(vendor.state)) {
      stateMap.set(vendor.state, {
        cities: new Set<string>(),
        vendorCount: 0,
      });
    }

    const stateData = stateMap.get(vendor.state)!;

    stateData.vendorCount += 1;

    if (vendor.city) {
      stateData.cities.add(vendor.city);
    }
  }

  const states: VendorStateFilter[] = Array.from(
    stateMap.entries(),
  )
    .map(([state, data]) => ({
      state,
      vendorCount: data.vendorCount,
      cityCount: data.cities.size,
      cities: Array.from(data.cities).sort(),
    }))
    .sort((a, b) =>
      a.state.localeCompare(b.state),
    );

  /* ALL CITIES */
  const cities = Array.from(
    new Set(
      vendors
        .map((vendor) => vendor.city)
        .filter(Boolean),
    ),
  ).sort();

  return {
    states,
    cities,
  };
}


/* ----------------------------------
   GET VENDOR BY ID
----------------------------------- */

export async function getVendorById(id: string) {
  if (
    !id ||
    !mongoose.Types.ObjectId.isValid(id)
  ) {
    throw new Error(
      `Invalid vendor id: ${id}`,
    );
  }

  const vendor = await Vendor.findOne({
    _id: id,
    deletedAt: null,
  }).lean();

  if (!vendor) {
    throw new Error(
      `Vendor not found: ${id}`,
    );
  }

  return vendor;
}


/* ----------------------------------
   FIND ACTIVE VENDOR
----------------------------------- */

export async function findActiveVendorById(
  id: string,
) {
  if (
    !id ||
    !mongoose.Types.ObjectId.isValid(id)
  ) {
    throw new Error(
      `Invalid vendor id: ${id}`,
    );
  }

  const vendor = await Vendor.findOne({
    _id: id,
    deletedAt: null,
  }).lean();

  if (!vendor) {
    throw new Error(
      `Vendor not found: ${id}`,
    );
  }

  if (vendor.status !== "Active") {
    throw new Error(
      `Vendor "${vendor.name}" is ${vendor.status}. Only Active vendors can be used for Purchase Orders.`,
    );
  }

  return vendor;
}


/* ----------------------------------
   CREATE VENDOR
----------------------------------- */

export async function createVendor(input: {
  name: string;
  state: string;
  city: string;
  siteOwnerName?: string;
  contactPerson?: string;
  mobile?: string;
  email?: string;
  address?: string;
  panNumber?: string;
  msmeNumber?: string;
  gstNumber?: string;
  paymentTerms?: string;
  bankAccountNumber?: string;
  ifsc?: string;
  status?: "Active" | "Inactive";
}) {
  const vendor = await Vendor.create({
    ...input,
    status: input.status ?? "Active",
  });

  return vendor.toObject();
}


/* ----------------------------------
   UPDATE VENDOR
----------------------------------- */

export async function updateVendor(
  id: string,
  input: Partial<{
    name: string;
    state: string;
    city: string;
    siteOwnerName: string;
    contactPerson: string;
    mobile: string;
    email: string;
    address: string;
    panNumber: string;
    msmeNumber: string;
    gstNumber: string;
    paymentTerms: string;
    bankAccountNumber: string;
    ifsc: string;
    status: "Active" | "Inactive";
  }>,
) {
  if (
    !id ||
    !mongoose.Types.ObjectId.isValid(id)
  ) {
    throw new Error(
      `Invalid vendor id: ${id}`,
    );
  }

  const vendor =
    await Vendor.findOneAndUpdate(
      {
        _id: id,
        deletedAt: null,
      },
      {
        $set: input,
      },
      {
        returnDocument: "after",
        runValidators: true,
      },
    ).lean();

  if (!vendor) {
    throw new Error(
      `Vendor not found: ${id}`,
    );
  }

  return vendor;
}


/* ----------------------------------
   DELETE VENDOR
----------------------------------- */

export async function deleteVendor(
  id: string,
) {
  if (
    !id ||
    !mongoose.Types.ObjectId.isValid(id)
  ) {
    throw new Error(
      `Invalid vendor id: ${id}`,
    );
  }

  const linkedSites =
    await Site.countDocuments({
      vendorId: id,
      deletedAt: null,
    });

  if (linkedSites > 0) {
    throw new Error(
      "Vendor has linked sites. Deactivate the vendor instead of deleting it.",
    );
  }

  const vendor =
    await Vendor.findOneAndUpdate(
      {
        _id: id,
        deletedAt: null,
      },
      {
        $set: {
          deletedAt: new Date(),
        },
      },
      {
        returnDocument: "after",
      },
    ).lean();

  if (!vendor) {
    throw new Error(
      `Vendor not found: ${id}`,
    );
  }

  return vendor;
}


/* ----------------------------------
   GET SITES LINKED TO VENDOR
----------------------------------- */

export async function getSitesByVendor(
  vendorId: string,
) {
  if (
    !vendorId ||
    !mongoose.Types.ObjectId.isValid(vendorId)
  ) {
    throw new Error(
      `Invalid vendor id: ${vendorId}`,
    );
  }

  const vendor = await Vendor.findOne({
    _id: vendorId,
    deletedAt: null,
  })
    .select("_id name")
    .lean();

  if (!vendor) {
    throw new Error(
      `Vendor not found: ${vendorId}`,
    );
  }

  return Site.find({
    vendorId,
    deletedAt: null,
  })
    .sort({
      createdAt: -1,
    })
    .lean();
}