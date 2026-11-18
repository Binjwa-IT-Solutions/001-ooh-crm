import type { Request } from "express";
import mongoose from "mongoose";

import {
  PurchaseOrder,
  type IPurchaseOrderLineItem,
} from "./purchase-order.model.js";
import { Vendor } from "../vendors/vendor.model.js";
import Campaign from "../campaigns/campaign.model.js";

import type {
  CreatePurchaseOrderInput,
  UpdatePurchaseOrderInput,
  PurchaseOrderListQuery,
} from "./purchase-order.validator.js";

import { findActiveVendorById } from "../vendors/vendor.service.js";
import { getSitesByIds } from "../sites/site.service.js";

type RequestContext = NonNullable<Request["ctx"]>;

/* =========================================================
   HELPERS
========================================================= */

function getUserId(
  ctx: RequestContext,
): mongoose.Types.ObjectId | undefined {
  const userId = ctx.user?.id;

  if (!userId || !mongoose.isValidObjectId(userId)) {
    return undefined;
  }

  return new mongoose.Types.ObjectId(userId);
}

function calculateDays(
  from: Date,
  to: Date,
): number {
  const start = new Date(from);
  const end = new Date(to);

  if (Number.isNaN(start.getTime())) {
    throw new Error("Invalid from date");
  }

  if (Number.isNaN(end.getTime())) {
    throw new Error("Invalid to date");
  }

  if (end < start) {
    throw new Error(
      "To date cannot be before from date",
    );
  }

  return (
    Math.floor(
      (end.getTime() - start.getTime()) /
        86400000,
    ) + 1
  );
}

function buildLineItems(
  items?: CreatePurchaseOrderInput["lineItems"],
): IPurchaseOrderLineItem[] {
  if (!items || items.length === 0) {
    return [];
  }

  return items.map((item) => {
    const from = item.from ? new Date(item.from) : undefined;
    const to = item.to ? new Date(item.to) : undefined;

    let days = item.days || 1;
    if (from && to && !Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())) {
      days = calculateDays(from, to);
    }

    const rate = Number(item.negotiatedRatePerDay) || 0;
    const amount = item.amount ?? rate * days;

    return {
      siteId: item.siteId && mongoose.isValidObjectId(item.siteId)
        ? new mongoose.Types.ObjectId(item.siteId)
        : undefined,
      city: item.city,
      spaceType: item.spaceType,
      from,
      to,
      negotiatedRatePerDay: rate,
      days,
      amount,
    };
  });
}

function calculateTotal(
  items: IPurchaseOrderLineItem[],
): number {
  return items.reduce(
    (total, item) =>
      total + (item.amount || 0),
    0,
  );
}

async function generatePONumber(): Promise<string> {
  const year = new Date().getFullYear();

  const count =
    await PurchaseOrder.countDocuments({
      poNumber: {
        $regex: `^MO-PO-${year}-`,
      },
    });

  return `MO-PO-${year}-${String(
    count + 1,
  ).padStart(4, "0")}`;
}

/* =========================================================
   LIST PURCHASE ORDERS
========================================================= */

export async function listPurchaseOrders(
  filters: PurchaseOrderListQuery = {},
) {
  const query: Record<string, any> = {};

  if (filters.status && filters.status.trim()) {
    query.status = filters.status.trim();
  }

  if (filters.campaignId && mongoose.isValidObjectId(filters.campaignId)) {
    query.campaignId = new mongoose.Types.ObjectId(filters.campaignId);
  }

  if (filters.vendorId && mongoose.isValidObjectId(filters.vendorId)) {
    query.vendorId = new mongoose.Types.ObjectId(filters.vendorId);
  }

  if (filters.city && filters.city.trim()) {
    query.city = { $regex: filters.city.trim(), $options: "i" };
  }

  if (filters.search?.trim()) {
    const searchRegex = new RegExp(filters.search.trim(), "i");

    const [matchingVendors, matchingCampaigns] = await Promise.all([
      Vendor.find({
        $or: [
          { name: searchRegex },
          { contactPerson: searchRegex },
          { city: searchRegex },
        ],
      })
        .select("_id")
        .lean(),
      Campaign.find({
        $or: [
          { name: searchRegex },
          { campaignCode: searchRegex },
          { city: searchRegex },
        ],
      })
        .select("_id")
        .lean(),
    ]);

    const vendorIds = matchingVendors.map((v) => v._id);
    const campaignIds = matchingCampaigns.map((c) => c._id);

    const orConditions: any[] = [
      { poNumber: searchRegex },
      { pricingId: searchRegex },
      { city: searchRegex },
      { spaceType: searchRegex },
      { approvedBy: searchRegex },
    ];

    if (vendorIds.length > 0) {
      orConditions.push({ vendorId: { $in: vendorIds } });
    }

    if (campaignIds.length > 0) {
      orConditions.push({ campaignId: { $in: campaignIds } });
    }

    query.$or = orConditions;
  }

  return PurchaseOrder.find(query)
    .populate(
      "vendorId",
      "name city state status contactPerson mobile email",
    )
    .populate(
      "campaignId",
      "name campaignCode city startDate endDate status",
    )
    .populate(
      "lineItems.siteId",
      "mediaPlanNo code name city mediaType type baseCostPerDay",
    )
    .sort({
      createdAt: -1,
    })
    .lean();
}

/* =========================================================
   GET PURCHASE ORDER BY ID
========================================================= */

export async function getPurchaseOrderById(
  id: string,
) {
  if (!mongoose.isValidObjectId(id)) {
    throw new Error(
      "Invalid purchase order ID",
    );
  }

  const po =
    await PurchaseOrder.findById(id)
      .populate(
        "vendorId",
        "name city state status contactPerson mobile email",
      )
      .populate(
        "campaignId",
        "name campaignCode city startDate endDate status",
      )
      .populate(
        "lineItems.siteId",
        "mediaPlanNo code name city mediaType type baseCostPerDay",
      )
      .lean();

  if (!po) {
    throw new Error(
      "Purchase order not found",
    );
  }

  return po;
}

/* =========================================================
   OPTIONS FOR PURCHASE ORDER CREATION
========================================================= */

export async function listCampaignOptionsForPO() {
  return Campaign.find(
    {},
    "_id name campaignCode city status startDate endDate",
  )
    .sort({ createdAt: -1 })
    .lean();
}

export async function listVendorOptionsForPO() {
  return Vendor.find(
    { status: "Active" },
    "_id name city state status contactPerson mobile",
  )
    .sort({ name: 1 })
    .lean();
}

/* =========================================================
   CREATE PURCHASE ORDER
========================================================= */

export async function createPurchaseOrder(
  input: CreatePurchaseOrderInput,
  ctx: RequestContext,
) {
  /* -------------------------------------------------------
     VENDOR VALIDATION
  ------------------------------------------------------- */

  if (
    !input.vendorId ||
    !mongoose.isValidObjectId(
      input.vendorId,
    )
  ) {
    throw new Error(
      `Invalid vendor ID: ${input.vendorId}`,
    );
  }

  const vendor =
    await findActiveVendorById(
      input.vendorId,
    );

  if (!vendor) {
    throw new Error(
      `Active vendor not found: ${input.vendorId}`,
    );
  }

  if (vendor.status !== "Active") {
    throw new Error(
      `Vendor "${vendor.name}" is not Active`,
    );
  }

  /* -------------------------------------------------------
     CAMPAIGN (OPTIONAL)
  ------------------------------------------------------- */

  let campaignObjectId: mongoose.Types.ObjectId | null = null;
  if (input.campaignId && mongoose.isValidObjectId(input.campaignId)) {
    campaignObjectId = new mongoose.Types.ObjectId(input.campaignId);
  }

  /* -------------------------------------------------------
     LINE ITEMS (OPTIONAL)
  ------------------------------------------------------- */

  let lineItems: IPurchaseOrderLineItem[] = [];
  if (input.lineItems && input.lineItems.length > 0) {
    lineItems = buildLineItems(input.lineItems);
  }

  /* -------------------------------------------------------
     PRICING FORMULAS & CALCULATIONS
  ------------------------------------------------------- */

  const cardRate = Number(input.cardRate) || 0;
  const negotiatedRate = Number(input.negotiatedRate) || 0;

  // Discount Given = Card Rate - Negotiated Rate
  const discountGiven =
    typeof input.discountGiven === "number"
      ? input.discountGiven
      : Math.max(0, cardRate - negotiatedRate);

  // Discount % = (Discount Given / Card Rate) * 100
  const discountPercent =
    typeof input.discountPercent === "number"
      ? input.discountPercent
      : cardRate > 0
        ? Number(((discountGiven / cardRate) * 100).toFixed(2))
        : 0;

  // Company Cost Price defaults to Negotiated Rate
  const companyCostPrice =
    typeof input.companyCostPrice === "number" && input.companyCostPrice >= 0
      ? input.companyCostPrice
      : negotiatedRate;

  const companySellingPrice = Number(input.companySellingPrice) || 0;

  // Profit Per Unit = Selling Price - Cost Price
  const profitPerUnit =
    typeof input.profitPerUnit === "number"
      ? input.profitPerUnit
      : companySellingPrice - companyCostPrice;

  // Profit Margin % = (Profit Per Unit / Cost Price) * 100
  const profitMarginPercent =
    typeof input.profitMarginPercent === "number"
      ? input.profitMarginPercent
      : companyCostPrice > 0
        ? Number(((profitPerUnit / companyCostPrice) * 100).toFixed(2))
        : 0;

  const validityFrom = input.validityFrom ? new Date(input.validityFrom) : undefined;
  const validityTo = input.validityTo ? new Date(input.validityTo) : undefined;

  let durationDays = Number(input.durationDays) || 30;
  if (
    validityFrom &&
    validityTo &&
    !Number.isNaN(validityFrom.getTime()) &&
    !Number.isNaN(validityTo.getTime())
  ) {
    const diff = Math.floor((validityTo.getTime() - validityFrom.getTime()) / 86400000) + 1;
    if (diff > 0 && !input.durationDays) {
      durationDays = diff;
    }
  }

  let totalAmount = Number(input.totalAmount) || 0;
  if (!totalAmount) {
    if (lineItems.length > 0) {
      totalAmount = calculateTotal(lineItems);
    } else {
      totalAmount = negotiatedRate;
    }
  }

  const poNumber = await generatePONumber();
  const pricingId =
    input.pricingId ||
    `PR-${poNumber.replace(/^MO-PO-/i, "")}`;

  const userId = getUserId(ctx);

  const po = await PurchaseOrder.create({
    poNumber,
    pricingId,
    campaignId: campaignObjectId,
    vendorId: new mongoose.Types.ObjectId(input.vendorId),

    city: input.city || (vendor as any).city || vendor.citiesServed?.[0] || "",
    spaceType: input.spaceType || "Billboard",

    cardRate,
    negotiatedRate,
    discountGiven,
    discountPercent,

    companyCostPrice,
    companySellingPrice,
    profitPerUnit,
    profitMarginPercent,

    durationDays,
    validityFrom,
    validityTo,

    negotiationRounds: Number(input.negotiationRounds) || 1,
    negotiationNotes: input.negotiationNotes || "",
    approvedBy: input.approvedBy || "",

    lineItems,
    totalAmount,
    status: "Draft",

    createdBy: userId,
    updatedBy: userId,
  });

  return getPurchaseOrderById(po._id.toString());
}

/* =========================================================
   UPDATE PURCHASE ORDER
========================================================= */

export async function updatePurchaseOrder(
  id: string,
  input: UpdatePurchaseOrderInput,
  ctx: RequestContext,
) {
  if (!mongoose.isValidObjectId(id)) {
    throw new Error(
      "Invalid purchase order ID",
    );
  }

  const existing =
    await PurchaseOrder.findById(id);

  if (!existing) {
    throw new Error(
      "Purchase order not found",
    );
  }

  if (existing.status !== "Draft") {
    throw new Error(
      "Only Draft purchase orders can be edited",
    );
  }

  /* UPDATE VENDOR */
  if (input.vendorId) {
    if (!mongoose.isValidObjectId(input.vendorId)) {
      throw new Error(`Invalid vendor ID: ${input.vendorId}`);
    }

    const vendor = await findActiveVendorById(input.vendorId);
    if (!vendor || vendor.status !== "Active") {
      throw new Error("Active vendor not found");
    }

    existing.vendorId = new mongoose.Types.ObjectId(input.vendorId);
  }

  if (input.campaignId !== undefined) {
    existing.campaignId =
      input.campaignId && mongoose.isValidObjectId(input.campaignId)
        ? new mongoose.Types.ObjectId(input.campaignId)
        : null;
  }

  if (input.city !== undefined) existing.city = input.city;
  if (input.spaceType !== undefined) existing.spaceType = input.spaceType;
  if (input.pricingId !== undefined) existing.pricingId = input.pricingId;

  if (input.cardRate !== undefined) existing.cardRate = Number(input.cardRate) || 0;
  if (input.negotiatedRate !== undefined) existing.negotiatedRate = Number(input.negotiatedRate) || 0;

  const cardRate = existing.cardRate || 0;
  const negotiatedRate = existing.negotiatedRate || 0;
  const discountGiven = Math.max(0, cardRate - negotiatedRate);
  existing.discountGiven = discountGiven;
  existing.discountPercent =
    cardRate > 0 ? Number(((discountGiven / cardRate) * 100).toFixed(2)) : 0;

  if (input.companyCostPrice !== undefined) {
    existing.companyCostPrice = Number(input.companyCostPrice) || 0;
  } else if (!existing.companyCostPrice) {
    existing.companyCostPrice = negotiatedRate;
  }

  if (input.companySellingPrice !== undefined) {
    existing.companySellingPrice = Number(input.companySellingPrice) || 0;
  }

  const cost = existing.companyCostPrice || 0;
  const sell = existing.companySellingPrice || 0;
  existing.profitPerUnit = sell - cost;
  existing.profitMarginPercent =
    cost > 0 ? Number((((sell - cost) / cost) * 100).toFixed(2)) : 0;

  if (input.durationDays !== undefined) existing.durationDays = Number(input.durationDays) || 30;
  if (input.validityFrom !== undefined) existing.validityFrom = input.validityFrom ? new Date(input.validityFrom) : undefined;
  if (input.validityTo !== undefined) existing.validityTo = input.validityTo ? new Date(input.validityTo) : undefined;
  if (input.negotiationRounds !== undefined) existing.negotiationRounds = Number(input.negotiationRounds) || 1;
  if (input.negotiationNotes !== undefined) existing.negotiationNotes = input.negotiationNotes;
  if (input.approvedBy !== undefined) existing.approvedBy = input.approvedBy;
  if (input.status !== undefined) existing.status = input.status;

  if (input.lineItems) {
    existing.lineItems = buildLineItems(input.lineItems);
    existing.totalAmount = calculateTotal(existing.lineItems);
  } else if (input.totalAmount !== undefined) {
    existing.totalAmount = Number(input.totalAmount) || 0;
  } else if (!existing.totalAmount) {
    existing.totalAmount = negotiatedRate;
  }

  existing.updatedBy = getUserId(ctx);

  await existing.save();

  return getPurchaseOrderById(id);
}

/* =========================================================
   ISSUE PURCHASE ORDER
========================================================= */

export async function issuePurchaseOrder(
  id: string,
  ctx: RequestContext,
) {
  if (!mongoose.isValidObjectId(id)) {
    throw new Error(
      "Invalid purchase order ID",
    );
  }

  const po =
    await PurchaseOrder.findById(id);

  if (!po) {
    throw new Error(
      "Purchase order not found",
    );
  }

  if (po.status !== "Draft") {
    throw new Error(
      `Cannot issue a purchase order with status "${po.status}"`,
    );
  }

  po.status = "Issued";
  po.issuedAt = new Date();
  po.updatedBy = getUserId(ctx);

  await po.save();

  return getPurchaseOrderById(id);
}

/* =========================================================
   CANCEL PURCHASE ORDER
========================================================= */

export async function cancelPurchaseOrder(
  id: string,
  ctx: RequestContext,
) {
  if (!mongoose.isValidObjectId(id)) {
    throw new Error(
      "Invalid purchase order ID",
    );
  }

  const po =
    await PurchaseOrder.findById(id);

  if (!po) {
    throw new Error(
      "Purchase order not found",
    );
  }

  if (po.status === "Cancelled") {
    throw new Error(
      "Purchase order is already cancelled",
    );
  }

  po.status = "Cancelled";
  po.updatedBy = getUserId(ctx);

  await po.save();

  return getPurchaseOrderById(id);
}