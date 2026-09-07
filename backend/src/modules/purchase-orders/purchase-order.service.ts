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
  items: CreatePurchaseOrderInput["lineItems"],
): IPurchaseOrderLineItem[] {
  if (!items || items.length === 0) {
    throw new Error(
      "At least one line item is required",
    );
  }

  return items.map((item) => {
    if (!mongoose.isValidObjectId(item.siteId)) {
      throw new Error(
        `Invalid site ID: ${item.siteId}`,
      );
    }

    const from = new Date(item.from);
    const to = new Date(item.to);

    const days = calculateDays(from, to);

    if (
      typeof item.negotiatedRatePerDay !==
        "number" ||
      item.negotiatedRatePerDay < 0
    ) {
      throw new Error(
        "Negotiated rate per day must be a valid non-negative number",
      );
    }

    const amount =
      item.negotiatedRatePerDay * days;

    return {
      siteId: new mongoose.Types.ObjectId(
        item.siteId,
      ),
      from,
      to,
      negotiatedRatePerDay:
        item.negotiatedRatePerDay,
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
      total + item.amount,
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
      "code name city type baseCostPerDay",
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
        "code name city type baseCostPerDay",
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
     CAMPAIGN VALIDATION
  ------------------------------------------------------- */

  if (
    !input.campaignId ||
    !mongoose.isValidObjectId(
      input.campaignId,
    )
  ) {
    throw new Error(
      `Invalid campaign ID: ${input.campaignId}`,
    );
  }

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

  /*
   * Find vendor and make sure it is Active.
   */
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
     SITE VALIDATION
  ------------------------------------------------------- */

  for (const item of input.lineItems) {
    if (
      !mongoose.isValidObjectId(
        item.siteId,
      )
    ) {
      throw new Error(
        `Invalid site ID: ${item.siteId}`,
      );
    }

    const sites =
      await getSitesByIds([
        item.siteId,
      ]);

    const site = sites[0];

    if (!site) {
      throw new Error(
        `Site not found: ${item.siteId}`,
      );
    }

    if (site.status !== "Active") {
      throw new Error(
        `Site ${site.code} is inactive`,
      );
    }
  }

  /* -------------------------------------------------------
     BUILD LINE ITEMS
  ------------------------------------------------------- */

  const lineItems =
    buildLineItems(
      input.lineItems,
    );

  /* -------------------------------------------------------
     CALCULATE TOTAL
  ------------------------------------------------------- */

  const totalAmount =
    calculateTotal(lineItems);

  /* -------------------------------------------------------
     GENERATE PO NUMBER
  ------------------------------------------------------- */

  const poNumber =
    await generatePONumber();

  /* -------------------------------------------------------
     USER
  ------------------------------------------------------- */

  const userId =
    getUserId(ctx);

  /* -------------------------------------------------------
     CREATE DRAFT
  ------------------------------------------------------- */

  const po =
    await PurchaseOrder.create({
      poNumber,

      campaignId:
        new mongoose.Types.ObjectId(
          input.campaignId,
        ),

      vendorId:
        new mongoose.Types.ObjectId(
          input.vendorId,
        ),

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

  /* -------------------------------------------------------
     UPDATE VENDOR
  ------------------------------------------------------- */

  if (input.vendorId) {
    if (
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

    existing.vendorId =
      new mongoose.Types.ObjectId(
        input.vendorId,
      );
  }

  /* -------------------------------------------------------
     UPDATE LINE ITEMS
  ------------------------------------------------------- */

  if (input.lineItems) {
    const lineItems =
      buildLineItems(
        input.lineItems,
      );

    for (const item of lineItems) {
      const sites =
        await getSitesByIds([
          String(item.siteId),
        ]);

      const site = sites[0];

      if (!site) {
        throw new Error(
          `Site not found: ${item.siteId}`,
        );
      }

      if (site.status !== "Active") {
        throw new Error(
          `Site ${site.code} is inactive`,
        );
      }
    }

    existing.lineItems =
      lineItems;

    existing.totalAmount =
      calculateTotal(lineItems);
  }

  /* -------------------------------------------------------
     UPDATED BY
  ------------------------------------------------------- */

  existing.updatedBy =
    getUserId(ctx);

  await existing.save();

  return getPurchaseOrderById(existing._id.toString());
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
      "Only Draft purchase orders can be issued",
    );
  }

  /* -------------------------------------------------------
     RECALCULATE TOTAL
  ------------------------------------------------------- */

  let total = 0;

  po.lineItems.forEach(
    (item) => {
      const days =
        calculateDays(
          item.from,
          item.to,
        );

      const amount =
        item.negotiatedRatePerDay *
        days;

      item.days = days;
      item.amount = amount;

      total += amount;
    },
  );

  po.totalAmount = total;

  po.status = "Issued";

  po.issuedAt = new Date();

  po.updatedBy =
    getUserId(ctx);

  await po.save();

  return getPurchaseOrderById(po._id.toString());
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
    return getPurchaseOrderById(po._id.toString());
  }

  if (
    po.status !== "Draft" &&
    po.status !== "Issued"
  ) {
    throw new Error(
      `Cannot cancel purchase order with status ${po.status}`,
    );
  }

  po.status = "Cancelled";

  po.updatedBy =
    getUserId(ctx);

  await po.save();

  return getPurchaseOrderById(po._id.toString());
}