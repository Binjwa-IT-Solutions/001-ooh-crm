import type { Request, Response } from 'express';
import { invoiceService } from '../services/invoice.service.js';
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  listInvoicesQuerySchema,
  recordInvoicePaymentSchema,
} from '../validators/invoice.validator.js';
import { UnauthorizedError } from '../../../core/errors/index.js';

export class InvoiceController {
  /** Create a new invoice */
  static async createInvoice(req: Request, res: Response): Promise<void> {
    if (!req.ctx) throw new UnauthorizedError();
    const parsed = createInvoiceSchema.parse(req.body);
    const result = await invoiceService.createInvoice(parsed, req.ctx);
    res.status(201).json({
      success: true,
      message: `${result.type === 'proforma' ? 'Proforma' : 'Sales'} invoice created successfully`,
      data: result,
      invoice: result,
    });
  }

  /** List invoices */
  static async listInvoices(req: Request, res: Response): Promise<void> {
    if (!req.ctx) throw new UnauthorizedError();
    const query = listInvoicesQuerySchema.parse(req.query);
    const result = await invoiceService.listInvoices(query, req.ctx);
    res.status(200).json({
      success: true,
      data: result,
      ...result,
    });
  }

  /** Get single invoice by ID */
  static async getInvoiceById(req: Request, res: Response): Promise<void> {
    if (!req.ctx) throw new UnauthorizedError();
    const id = req.params.id as string;
    const result = await invoiceService.getInvoiceById(id, req.ctx);
    res.status(200).json({
      success: true,
      data: result,
      invoice: result,
    });
  }

  /** Update an invoice */
  static async updateInvoice(req: Request, res: Response): Promise<void> {
    if (!req.ctx) throw new UnauthorizedError();
    const id = req.params.id as string;
    const parsed = updateInvoiceSchema.parse(req.body);
    const result = await invoiceService.updateInvoice(id, parsed, req.ctx);
    res.status(200).json({
      success: true,
      message: 'Invoice updated successfully',
      data: result,
      invoice: result,
    });
  }

  /** Soft delete an invoice */
  static async deleteInvoice(req: Request, res: Response): Promise<void> {
    if (!req.ctx) throw new UnauthorizedError();
    const id = req.params.id as string;
    const result = await invoiceService.deleteInvoice(id, req.ctx);
    res.status(200).json(result);
  }

  /** Duplicate an invoice */
  static async duplicateInvoice(req: Request, res: Response): Promise<void> {
    if (!req.ctx) throw new UnauthorizedError();
    const id = req.params.id as string;
    const result = await invoiceService.duplicateInvoice(id, req.ctx);
    res.status(201).json({
      success: true,
      message: 'Invoice duplicated successfully',
      data: result,
      invoice: result,
    });
  }

  /** Record payment against invoice */
  static async recordPayment(req: Request, res: Response): Promise<void> {
    if (!req.ctx) throw new UnauthorizedError();
    const id = req.params.id as string;
    const parsed = recordInvoicePaymentSchema.parse(req.body);
    const result = await invoiceService.recordInvoicePayment(id, parsed, req.ctx);
    res.status(200).json({
      success: true,
      message: 'Payment recorded successfully against invoice',
      data: result,
    });
  }

  /** Get recent prices for a party and item */
  static async getRecentPartyPrices(req: Request, res: Response): Promise<void> {
    if (!req.ctx) throw new UnauthorizedError();
    const partyId = req.params.partyId as string;
    const itemName = typeof req.query.item === 'string' ? req.query.item : undefined;
    const result = await invoiceService.getRecentPartyPrices(partyId, itemName);
    res.status(200).json({
      success: true,
      data: result,
      prices: result,
    });
  }

  /** Download invoice PDF */
  static async downloadPdf(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const pdfBuffer = await invoiceService.generateInvoicePdf(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="invoice-${id}.pdf"`);
    res.send(pdfBuffer);
  }

  /** Convert Proforma to Sales Invoice */
  static async convertToSalesInvoice(req: Request, res: Response): Promise<void> {
    if (!req.ctx) throw new UnauthorizedError();
    const id = req.params.id as string;
    const result = await invoiceService.convertToSalesInvoice(id, req.ctx);
    res.status(200).json({
      success: true,
      message: 'Proforma converted to Sales Invoice successfully',
      data: result,
      invoice: result,
    });
  }

  /** Public endpoint: Get invoice by public shareToken */
  static async getPublicInvoice(req: Request, res: Response): Promise<void> {
    const token = req.params.token as string;
    const result = await invoiceService.getPublicInvoiceByToken(token);
    res.status(200).json({
      success: true,
      data: result,
      invoice: result,
    });
  }

  /** Public endpoint: Download invoice PDF by public shareToken */
  static async downloadPublicPdf(req: Request, res: Response): Promise<void> {
    const token = req.params.token as string;
    const pdfBuffer = await invoiceService.generatePublicInvoicePdfByToken(token);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="invoice-${token}.pdf"`);
    res.send(pdfBuffer);
  }
}
