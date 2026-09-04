import { Request, Response } from 'express';
import { QuotationsService } from './quotations.service.js';
import {
  createQuotationSchema,
  listQuotationsSchema,
  rejectQuotationSchema,
  sendQuotationSchema,
  updateQuotationSchema,
} from './quotations.validator.js';

export class QuotationsController {
  static async list(req: Request, res: Response): Promise<void> {
    const filters = listQuotationsSchema.parse(req.query);
    const { quotations, total } = await QuotationsService.list(filters, req.ctx!);
    res.status(200).json({
      quotations,
      meta: { total, page: filters.page, limit: filters.limit },
    });
  }

  static async get(req: Request, res: Response): Promise<void> {
    const quotation = await QuotationsService.get(req.params.id as string, req.ctx!);
    res.status(200).json({ quotation });
  }

  static async create(req: Request, res: Response): Promise<void> {
    const data = createQuotationSchema.parse(req.body);
    const quotation = await QuotationsService.create(data, req.ctx!);
    res.status(201).json({ quotation });
  }

  static async update(req: Request, res: Response): Promise<void> {
    const data = updateQuotationSchema.parse(req.body);
    const quotation = await QuotationsService.update(req.params.id as string, data, req.ctx!);
    res.status(200).json({ quotation });
  }

  static async generatePdf(req: Request, res: Response): Promise<void> {
    const result = await QuotationsService.generatePdf(req.params.id as string, req.ctx!);
    res.status(200).json(result);
  }

  static async getPdf(req: Request, res: Response): Promise<void> {
    const result = await QuotationsService.getPdfUrl(req.params.id as string, req.ctx!);
    res.status(200).json(result);
  }

  static async uploadPdf(req: Request, res: Response): Promise<void> {
    const result = await QuotationsService.uploadCustomPdf(
      req.params.id as string,
      req.file,
      req.ctx!,
    );
    res.status(200).json(result);
  }

  static async send(req: Request, res: Response): Promise<void> {
    const input = sendQuotationSchema.parse(req.body);
    const result = await QuotationsService.send(
      req.params.id as string,
      input.sentTo,
      input.message,
      req.ctx!,
    );
    res.status(200).json(result);
  }

  // --- Public Handlers (No Auth Required) ---

  static async getPublicByToken(req: Request, res: Response): Promise<void> {
    const token = req.params.token as string;
    const proposal = await QuotationsService.getPublicByToken(token);
    res.status(200).json({ proposal });
  }

  static async acceptPublic(req: Request, res: Response): Promise<void> {
    const token = req.params.token as string;
    const proposal = await QuotationsService.acceptPublic(token);
    res.status(200).json({ proposal });
  }

  static async rejectPublic(req: Request, res: Response): Promise<void> {
    const token = req.params.token as string;
    const { rejectionReason } = rejectQuotationSchema.parse(req.body);
    const proposal = await QuotationsService.rejectPublic(token, rejectionReason);
    res.status(200).json({ proposal });
  }
}
