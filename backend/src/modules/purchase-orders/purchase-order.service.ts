import mongoose from "mongoose";
import { PurchaseOrder } from "./purchase-order.model.js";
import type {
  CreatePurchaseOrderInput,
  UpdatePurchaseOrderInput,
  PurchaseOrderListQuery,
  DocumentInput,
  PaymentInput,
} from "./purchase-order.validator.js";

function days(from?: string, to?: string) {
  if (!from || !to) return 1;

  const a = new Date(from).getTime();
  const b = new Date(to).getTime();

  if (b < a) throw new Error("Invalid date range");

  return Math.floor((b - a) / 86400000) + 1;
}

async function poNumber() {
  const year = new Date().getFullYear();

  const count = await PurchaseOrder.countDocuments({
    poNumber: { $regex: `^MO-PO-${year}-` },
  });

  return `MO-PO-${year}-${String(count + 1).padStart(4, "0")}`;
}

export async function listPurchaseOrders(
  query: PurchaseOrderListQuery = {},
) {
  const filter: any = {};

  if (query.status) filter.status = query.status;
  if (query.vendorId) filter.vendorId = query.vendorId;
  if (query.campaignId) filter.campaignId = query.campaignId;

  if (query.city)
    filter.city = { $regex: query.city, $options: "i" };

  if (query.search) {
    filter.$or = [
      { poNumber: { $regex: query.search, $options: "i" } },
      { pricingId: { $regex: query.search, $options: "i" } },
      { city: { $regex: query.search, $options: "i" } },
    ];
  }

  return PurchaseOrder.find(filter)
    .populate("vendorId", "name city state contactPerson mobile email")
    .populate("campaignId", "name campaignCode city startDate endDate")
    .sort({ createdAt: -1 })
    .lean();
}

export async function getPurchaseOrderById(id: string) {
  if (!mongoose.isValidObjectId(id))
    throw new Error("Invalid purchase order ID");

  const po = await PurchaseOrder.findById(id)
    .populate("vendorId")
    .populate("campaignId")
    .populate("lineItems.siteId")
    .lean();

  if (!po) throw new Error("Purchase order not found");

  return po;
}

export async function listCampaignOptionsForPO() {
  const Campaign = mongoose.model("Campaign");

  return Campaign.find(
    {},
    "_id name campaignCode city status startDate endDate",
  )
    .sort({ createdAt: -1 })
    .lean();
}

export async function listVendorOptionsForPO() {
  const Vendor = mongoose.model("Vendor");

  return Vendor.find(
    {},
    "_id name city state status contactPerson mobile address gstNumber gstin citiesServed",
  )
    .sort({ name: 1 })
    .lean();
}

export async function createPurchaseOrder(
  input: CreatePurchaseOrderInput,
  ctx: any,
) {
  const items = (input.lineItems || []).map((item) => {
    const itemDays = item.days || days(item.from, item.to);
    const rate = item.rate ?? item.ratePerDay ?? 0;
    const qty = item.qty ?? 1;
    const discount = item.discount ?? 0;
    const amount = item.amount ?? Math.max(0, qty * rate - discount);

    return {
      ...item,
      siteId: item.siteId
        ? new mongoose.Types.ObjectId(item.siteId)
        : undefined,
      from: item.from ? new Date(item.from) : undefined,
      to: item.to ? new Date(item.to) : undefined,
      days: itemDays,
      ratePerDay: rate,
      rate,
      qty,
      discount,
      amount,
    };
  });

  const totalAmount =
    input.totalAmount ??
    items.reduce((sum, item) => sum + (item.amount || 0), 0);

  const finalPoNumber = input.poNumber?.trim() || (await poNumber());
  const status = input.status || "Draft";

  const po = await PurchaseOrder.create({
    ...input,
    bankDetails: input.bankDetails || undefined,
    poNumber: finalPoNumber,
    poDate: input.poDate ? new Date(input.poDate) : new Date(),
    campaignId: input.campaignId && mongoose.isValidObjectId(input.campaignId)
      ? new mongoose.Types.ObjectId(input.campaignId)
      : null,
    campaignName: input.campaignName,
    vendorId: input.vendorId && mongoose.isValidObjectId(input.vendorId)
      ? new mongoose.Types.ObjectId(input.vendorId)
      : undefined,
    vendorName: input.vendorName,
    lineItems: items,
    totalAmount,
    status,
    issuedAt: status === "Issued" ? new Date() : undefined,
    createdBy: ctx?.user?.id,
    updatedBy: ctx?.user?.id,
  });

  return getPurchaseOrderById(String((po as any)._id || (po as any).id));
}

export async function updatePurchaseOrder(
  id: string,
  input: UpdatePurchaseOrderInput,
  ctx: any,
) {
  const po = await PurchaseOrder.findById(id);

  if (!po) throw new Error("Purchase order not found");
  if (po.status !== "Draft")
    throw new Error("Only Draft PO can be edited");

  Object.assign(po, input);

  if (input.vendorId !== undefined) {
    po.vendorId = input.vendorId && mongoose.isValidObjectId(input.vendorId)
      ? new mongoose.Types.ObjectId(input.vendorId)
      : undefined;
  }
  if (input.vendorName !== undefined) po.vendorName = input.vendorName;

  if (input.campaignId !== undefined) {
    po.campaignId = input.campaignId && mongoose.isValidObjectId(input.campaignId)
      ? new mongoose.Types.ObjectId(input.campaignId)
      : null;
  }
  if (input.campaignName !== undefined) po.campaignName = input.campaignName;
  if (input.bankDetails !== undefined) po.bankDetails = input.bankDetails || undefined;

  po.updatedBy = ctx?.user?.id;
  await po.save();

  return getPurchaseOrderById(id);
}

export async function issuePurchaseOrder(id: string, ctx: any) {
  const po = await PurchaseOrder.findById(id);

  if (!po) throw new Error("Purchase order not found");
  if (po.status !== "Draft")
    throw new Error("Only Draft PO can be issued");

  po.status = "Issued";
  po.issuedAt = new Date();
  po.updatedBy = ctx?.user?.id;

  await po.save();

  return getPurchaseOrderById(id);
}

export async function cancelPurchaseOrder(id: string, ctx: any) {
  const po = await PurchaseOrder.findById(id);

  if (!po) throw new Error("Purchase order not found");

  po.status = "Cancelled";
  po.updatedBy = ctx?.user?.id;

  await po.save();

  return getPurchaseOrderById(id);
}

export async function addDocument(
  id: string,
  input: DocumentInput,
) {
  const po = await PurchaseOrder.findById(id);

  if (!po) throw new Error("Purchase order not found");

  Object.assign(po, input);
  await po.save();

  return getPurchaseOrderById(id);
}

export async function addPayment(
  id: string,
  input: PaymentInput,
) {
  const po = await PurchaseOrder.findById(id);

  if (!po) throw new Error("Purchase order not found");

  if (input.invoiceNumber !== undefined) po.invoiceNumber = input.invoiceNumber;
  if (input.invoiceDate !== undefined) {
    po.invoiceDate = input.invoiceDate ? new Date(input.invoiceDate) : new Date();
  }
  if (input.paidAmount !== undefined) po.paidAmount = input.paidAmount;
  if (input.paymentDate !== undefined) {
    po.paymentDate = input.paymentDate ? new Date(input.paymentDate) : new Date();
  }
  if (input.paymentTerms !== undefined) po.paymentTerms = input.paymentTerms;
  if (input.dueDate !== undefined) po.dueDate = input.dueDate ? new Date(input.dueDate) : undefined;
  if (input.paymentMethod !== undefined) po.paymentMethod = input.paymentMethod;
  if (input.gstApplicable !== undefined) po.gstApplicable = input.gstApplicable;
  if (input.accountsStatus !== undefined) po.accountsStatus = input.accountsStatus;
  if (input.accountsComments !== undefined) po.accountsComments = input.accountsComments;

  const currentPaid = po.paidAmount ?? 0;
  const currentTotal = po.totalAmount ?? 0;
  po.paymentStatus =
    currentPaid >= currentTotal && currentTotal > 0
      ? "Paid"
      : currentPaid > 0
        ? "Partial"
        : "Pending";

  await po.save();

  return getPurchaseOrderById(id);
}