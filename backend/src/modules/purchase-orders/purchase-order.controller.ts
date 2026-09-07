import type { Request, Response, NextFunction } from "express";

import {
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  purchaseOrderListQuerySchema,
} from "./purchase-order.validator.js";

import * as purchaseOrderService from "./purchase-order.service.js";

export async function list(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const query = purchaseOrderListQuerySchema.parse(req.query);
    const data = await purchaseOrderService.listPurchaseOrders(query);

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function campaignOptions(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await purchaseOrderService.listCampaignOptionsForPO();

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function vendorOptions(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await purchaseOrderService.listVendorOptionsForPO();

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function getById(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await purchaseOrderService.getPurchaseOrderById(
      String(req.params.id),
    );

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function create(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const input = createPurchaseOrderSchema.parse(req.body);

    const data = await purchaseOrderService.createPurchaseOrder(
      input,
      req.ctx!,
    );

    res.status(201).json({
      success: true,
      message: "Purchase order created successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function update(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const input = updatePurchaseOrderSchema.parse(req.body);

    const data = await purchaseOrderService.updatePurchaseOrder(
      String(req.params.id),
      input,
      req.ctx!,
    );

    res.status(200).json({
      success: true,
      message: "Purchase order updated successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function issue(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await purchaseOrderService.issuePurchaseOrder(
      String(req.params.id),
      req.ctx!,
    );

    res.status(200).json({
      success: true,
      message: "Purchase order issued successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function cancel(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await purchaseOrderService.cancelPurchaseOrder(
      String(req.params.id),
      req.ctx!,
    );

    res.status(200).json({
      success: true,
      message: "Purchase order cancelled successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
}