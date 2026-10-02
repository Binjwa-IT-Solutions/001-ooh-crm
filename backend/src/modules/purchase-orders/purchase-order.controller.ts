import type { Request, Response, NextFunction } from "express";
import {
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  purchaseOrderListQuerySchema,
  documentSchema,
  paymentSchema,
} from "./purchase-order.validator.js";
import * as service from "./purchase-order.service.js";

const id = (req: Request) => String(req.params.id);

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.listPurchaseOrders(
      purchaseOrderListQuerySchema.parse(req.query),
    );
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({
      success: true,
      data: await service.getPurchaseOrderById(id(req)),
    });
  } catch (e) {
    next(e);
  }
}

export async function campaignOptions(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    res.json({
      success: true,
      data: await service.listCampaignOptionsForPO(),
    });
  } catch (e) {
    next(e);
  }
}

export async function vendorOptions(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    res.json({
      success: true,
      data: await service.listVendorOptionsForPO(),
    });
  } catch (e) {
    next(e);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.createPurchaseOrder(
      createPurchaseOrderSchema.parse(req.body),
      req.ctx!,
    );

    res.status(201).json({
      success: true,
      message: "Purchase order created",
      data,
    });
  } catch (e) {
    next(e);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.updatePurchaseOrder(
      id(req),
      updatePurchaseOrderSchema.parse(req.body),
      req.ctx!,
    );

    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

export async function issue(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({
      success: true,
      data: await service.issuePurchaseOrder(id(req), req.ctx!),
    });
  } catch (e) {
    next(e);
  }
}

export async function cancel(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({
      success: true,
      data: await service.cancelPurchaseOrder(id(req), req.ctx!),
    });
  } catch (e) {
    next(e);
  }
}

export async function document(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await service.addDocument(
      id(req),
      documentSchema.parse(req.body),
    );

    res.json({
      success: true,
      message: "Document updated",
      data,
    });
  } catch (e) {
    next(e);
  }
}

export async function payment(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await service.addPayment(
      id(req),
      paymentSchema.parse(req.body),
    );

    res.json({
      success: true,
      message: "Payment and invoice updated",
      data,
    });
  } catch (e) {
    next(e);
  }
}