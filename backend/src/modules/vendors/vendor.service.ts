import { Vendor } from "./vendor.model.js";
import { Site } from "../sites/site.model.js";

export const getVendors = async (filters: any = {}) => {
  const {
    search,
    city,
    status,
    registrationStatus,
    vendorType,
  } = filters;

  const query: any = {};

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { "primaryContact.name": { $regex: search, $options: "i" } },
      { "primaryContact.email": { $regex: search, $options: "i" } },
      { gstNumber: { $regex: search, $options: "i" } },
      { panNumber: { $regex: search, $options: "i" } },
    ];
  }

  if (city) query.citiesServed = city;
  if (status) query.status = status;
  if (registrationStatus) query.registrationStatus = registrationStatus;
  if (vendorType) query.vendorType = vendorType;

  return Vendor.find(query).sort({ createdAt: -1 });
};

export const getVendorFilters = async () => {
  const [cities, dbRegistrationStatuses, vendorTypes, statuses] =
    await Promise.all([
      Vendor.distinct("citiesServed"),
      Vendor.distinct("registrationStatus"),
      Vendor.distinct("vendorType"),
      Vendor.distinct("status"),
    ]);

  const defaultRegistrationStatuses = [
    "Registered",
    "Unregistered",
    "Pending",
  ];
  const registrationStatuses = Array.from(
    new Set([
      ...defaultRegistrationStatuses,
      ...dbRegistrationStatuses.filter(Boolean),
    ])
  );

  return {
    cities,
    registrationStatuses,
    vendorTypes,
    statuses,
  };
};

export const getVendorById = async (id: string) => {
  const vendor = await Vendor.findById(id);

  if (!vendor) {
    throw new Error("Vendor not found");
  }

  return vendor;
};

/* Compatibility function for Purchase Orders / existing modules */
export const findActiveVendorById = async (id: string) => {
  const vendor = await Vendor.findOne({
    _id: id,
    status: "Active",
  });

  if (!vendor) {
    throw new Error("Active vendor not found");
  }

  return vendor;
};

export const createVendor = async (data: any) => {
  return Vendor.create(data);
};

export const updateVendor = async (id: string, data: any) => {
  const vendor = await Vendor.findByIdAndUpdate(
    id,
    data,
    {
      new: true,
      runValidators: true,
    }
  );

  if (!vendor) {
    throw new Error("Vendor not found");
  }

  return vendor;
};

export const setVendorStatus = async (
  id: string,
  status: "Active" | "Inactive" | "Blacklist"
) => {
  const vendor = await Vendor.findByIdAndUpdate(
    id,
    { status },
    { new: true, runValidators: true }
  );

  if (!vendor) {
    throw new Error("Vendor not found");
  }

  return vendor;
};

export const setRegistrationStatus = async (
  id: string,
  registrationStatus: "Registered" | "Unregistered" | "Pending"
) => {
  const vendor = await Vendor.findByIdAndUpdate(
    id,
    { registrationStatus },
    { new: true, runValidators: true }
  );

  if (!vendor) {
    throw new Error("Vendor not found");
  }

  return vendor;
};

export const addDocument = async (
  id: string,
  document: any
) => {
  const vendor = await Vendor.findByIdAndUpdate(
    id,
    { $push: { documents: document } },
    { new: true, runValidators: true }
  );

  if (!vendor) {
    throw new Error("Vendor not found");
  }

  return vendor;
};

export const removeDocument = async (
  id: string,
  documentId: string
) => {
  const vendor = await Vendor.findByIdAndUpdate(
    id,
    {
      $pull: {
        documents: { _id: documentId },
      },
    },
    { new: true }
  );

  if (!vendor) {
    throw new Error("Vendor not found");
  }

  return vendor;
};

export const getSitesByVendor = async (vendorId: string) => {
  return Site.find({ vendorId }).sort({ createdAt: -1 });
};

/* Compatibility for old modules */
export const deleteVendor = async (id: string) => {
  return setVendorStatus(id, "Inactive");
};