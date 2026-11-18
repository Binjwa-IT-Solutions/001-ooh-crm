import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { paymentInService } from '../services/paymentIn.service.js';
import { paymentOutService } from '../services/paymentOut.service.js';
import { campaignFinanceService } from '../services/campaignFinance.service.js';
import { profitCalculationJob } from '../../../jobs/profitCalculation.job.js';
import {
  createPaymentInSchema,
  updatePaymentInSchema,
  listPaymentsInQuerySchema,
  createPaymentOutSchema,
  updatePaymentOutSchema,
  listPaymentsOutQuerySchema,
  profitLeaderboardQuerySchema,
  lowMarginQuerySchema,
  revenueByAgentQuerySchema,
  profitTrendsQuerySchema,
  expenseBreakdownQuerySchema,
} from '../validators/finance.validator.js';
import { UnauthorizedError, ValidationError } from '../../../core/errors/index.js';

export class FinanceController {
  // ==========================================================================
  // F1: PaymentIn (Client Payments)
  // ==========================================================================

  static async createPaymentIn(req: Request, res: Response) {
    if (!req.ctx) throw new UnauthorizedError();
    const input = createPaymentInSchema.parse(req.body);
    const result = await paymentInService.createPaymentIn(input, req.ctx);
    res.status(201).json({ message: 'Client payment recorded', payment: result });
  }

  static async listPaymentsIn(req: Request, res: Response) {
    if (!req.ctx) throw new UnauthorizedError();
    const query = listPaymentsInQuerySchema.parse(req.query);
    const result = await paymentInService.listPaymentsIn(query, req.ctx);
    res.status(200).json(result);
  }

  static async getPaymentInById(req: Request, res: Response) {
    if (!req.ctx) throw new UnauthorizedError();
    const id = req.params.id as string;
    const result = await paymentInService.getPaymentInById(id, req.ctx);
    res.status(200).json({ payment: result });
  }

  static async updatePaymentIn(req: Request, res: Response) {
    if (!req.ctx) throw new UnauthorizedError();
    const id = req.params.id as string;
    const input = updatePaymentInSchema.parse(req.body);
    const result = await paymentInService.updatePaymentIn(id, input, req.ctx);
    res.status(200).json({ message: 'Payment updated', payment: result });
  }

  static async deletePaymentIn(req: Request, res: Response) {
    if (!req.ctx) throw new UnauthorizedError();
    const id = req.params.id as string;
    const result = await paymentInService.deletePaymentIn(id, req.ctx);
    res.status(200).json(result);
  }

  static async reconcilePaymentIn(req: Request, res: Response) {
    if (!req.ctx) throw new UnauthorizedError();
    const id = req.params.id as string;
    const result = await paymentInService.reconcilePaymentIn(id, req.ctx);
    res.status(200).json({ message: 'Payment reconciled', payment: result });
  }

  // ==========================================================================
  // F2: PaymentOut (Vendor Payments)
  // ==========================================================================

  static async createPaymentOut(req: Request, res: Response) {
    if (!req.ctx) throw new UnauthorizedError();
    const input = createPaymentOutSchema.parse(req.body);
    const result = await paymentOutService.createPaymentOut(input, req.ctx);
    res.status(201).json({ message: 'Vendor payment recorded', payment: result });
  }

  static async listPaymentsOut(req: Request, res: Response) {
    if (!req.ctx) throw new UnauthorizedError();
    const query = listPaymentsOutQuerySchema.parse(req.query);
    const result = await paymentOutService.listPaymentsOut(query, req.ctx);
    res.status(200).json(result);
  }

  static async getPaymentOutById(req: Request, res: Response) {
    if (!req.ctx) throw new UnauthorizedError();
    const id = req.params.id as string;
    const result = await paymentOutService.getPaymentOutById(id, req.ctx);
    res.status(200).json({ payment: result });
  }

  static async updatePaymentOut(req: Request, res: Response) {
    if (!req.ctx) throw new UnauthorizedError();
    const id = req.params.id as string;
    const input = updatePaymentOutSchema.parse(req.body);
    const result = await paymentOutService.updatePaymentOut(id, input, req.ctx);
    res.status(200).json({ message: 'Payment updated', payment: result });
  }

  static async deletePaymentOut(req: Request, res: Response) {
    if (!req.ctx) throw new UnauthorizedError();
    const id = req.params.id as string;
    const result = await paymentOutService.deletePaymentOut(id, req.ctx);
    res.status(200).json(result);
  }

  static async reconcilePaymentOut(req: Request, res: Response) {
    if (!req.ctx) throw new UnauthorizedError();
    const id = req.params.id as string;
    const result = await paymentOutService.reconcilePaymentOut(id, req.ctx);
    res.status(200).json({ message: 'Payment reconciled', payment: result });
  }

  // ==========================================================================
  // F3 / F4 / F5: Reports, Analytics & Dashboards
  // ==========================================================================

  static async getCampaignFinance(req: Request, res: Response) {
    if (!req.ctx) throw new UnauthorizedError();
    const campaignId = req.params.campaignId as string;
    if (!campaignId || !Types.ObjectId.isValid(campaignId)) {
      throw new ValidationError('Invalid campaign ID');
    }
    const result = await campaignFinanceService.getCampaignFinance(campaignId);
    res.status(200).json({ finance: result });
  }

  static async getProfitLeaderboard(req: Request, res: Response) {
    if (!req.ctx) throw new UnauthorizedError();
    const query = profitLeaderboardQuerySchema.parse(req.query);
    const result = await campaignFinanceService.getProfitLeaderboard(query.limit, query.sortBy);
    res.status(200).json({ leaderboard: result });
  }

  static async getLowMarginCampaigns(req: Request, res: Response) {
    if (!req.ctx) throw new UnauthorizedError();
    const query = lowMarginQuerySchema.parse(req.query);
    const result = await campaignFinanceService.getLowMarginCampaigns(query.threshold);
    res.status(200).json({ lowMarginCampaigns: result });
  }

  static async getRevenueByAgent(req: Request, res: Response) {
    if (!req.ctx) throw new UnauthorizedError();
    const query = revenueByAgentQuerySchema.parse(req.query);
    const result = await campaignFinanceService.getRevenueByAgent(query.fromDate, query.toDate);
    res.status(200).json({ revenueByAgent: result });
  }

  static async getSummary(req: Request, res: Response) {
    if (!req.ctx) throw new UnauthorizedError();
    const result = await campaignFinanceService.getSummary(req.ctx);
    res.status(200).json(result);
  }

  static async getProfitTrends(req: Request, res: Response) {
    if (!req.ctx) throw new UnauthorizedError();
    const query = profitTrendsQuerySchema.parse(req.query);
    const result = await campaignFinanceService.getProfitTrends(query.campaignId, query.days);
    res.status(200).json({ trends: result });
  }

  static async getExpenseBreakdown(req: Request, res: Response) {
    if (!req.ctx) throw new UnauthorizedError();
    const query = expenseBreakdownQuerySchema.parse(req.query);
    const result = await campaignFinanceService.getExpenseBreakdown(query.campaignId);
    res.status(200).json(result);
  }

  static async runRollupJob(req: Request, res: Response) {
    if (!req.ctx) throw new UnauthorizedError();
    const result = await profitCalculationJob();
    res.status(200).json({ message: 'Rollup calculation completed', ...result });
  }
}
