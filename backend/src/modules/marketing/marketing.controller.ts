import { Request, Response } from 'express';
import { MarketingService } from './marketing.service.js';
import {
  createDailyLogSchema,
  listDailyLogsSchema,
  createMarketingTaskSchema,
  updateTaskStatusSchema,
  updateMarketingTaskSchema,
  setBudgetSchema,
  createSpendSchema,
  createMarketingLeadSchema,
  updateLeadStageSchema,
} from './marketing.validator.js';

export class MarketingController {
  // 1. Daily Logs
  static async submitDailyLog(req: Request, res: Response) {
    const input = createDailyLogSchema.parse(req.body);
    const log = await MarketingService.submitDailyLog(input, req.ctx!);
    res.status(201).json(log);
  }

  static async listDailyLogs(req: Request, res: Response) {
    const filters = listDailyLogsSchema.parse(req.query);
    const logs = await MarketingService.listDailyLogs(filters, req.ctx!);
    res.status(200).json({ data: logs });
  }

  static async getManagerDailySummary(req: Request, res: Response) {
    const dateStr = (req.query.date as string) || '';
    const summary = await MarketingService.getManagerDailySummary(dateStr);
    res.status(200).json({ data: summary });
  }

  // 2. Tasks & Content
  static async createTask(req: Request, res: Response) {
    const input = createMarketingTaskSchema.parse(req.body);
    const task = await MarketingService.createTask(input, req.ctx!);
    res.status(201).json(task);
  }

  static async listTasks(req: Request, res: Response) {
    const status = req.query.status as string | undefined;
    const assignedTo = req.query.assignedTo as string | undefined;
    const isContent = req.query.isContent === 'true' ? true : req.query.isContent === 'false' ? false : undefined;

    const tasks = await MarketingService.listTasks({ status, assignedTo, isContent }, req.ctx!);
    res.status(200).json({ data: tasks });
  }

  static async updateTaskStatus(req: Request, res: Response) {
    const { status } = updateTaskStatusSchema.parse(req.body);
    const task = await MarketingService.updateTaskStatus(req.params.id as string, status, req.ctx!);
    res.status(200).json(task);
  }

  static async updateTask(req: Request, res: Response) {
    const input = updateMarketingTaskSchema.parse(req.body);
    const task = await MarketingService.updateTask(req.params.id as string, input);
    res.status(200).json(task);
  }

  static async getTeamMembers(_req: Request, res: Response) {
    const members = await MarketingService.getTeamMembers();
    res.status(200).json({ data: members });
  }

  // 3. Budget & Spend
  static async setBudget(req: Request, res: Response) {
    const input = setBudgetSchema.parse(req.body);
    const budget = await MarketingService.setBudget(input, req.ctx!);
    res.status(200).json(budget);
  }

  static async getBudget(req: Request, res: Response) {
    const month = (req.params.month as string) || new Date().toISOString().slice(0, 7);
    const budget = await MarketingService.getBudget(month);
    res.status(200).json(budget || { month, plannedAmount: 150000, period: 'Monthly' });
  }

  static async recordSpend(req: Request, res: Response) {
    const input = createSpendSchema.parse(req.body);
    const spend = await MarketingService.recordSpend(input, req.ctx!);
    res.status(201).json(spend);
  }

  static async listSpends(req: Request, res: Response) {
    const month = req.query.month as string | undefined;
    const spends = await MarketingService.listSpends(month);
    res.status(200).json({ data: spends });
  }

  // 4. Leads & Attribution
  static async createLead(req: Request, res: Response) {
    const input = createMarketingLeadSchema.parse(req.body);
    const lead = await MarketingService.createLead(input, req.ctx!);
    res.status(201).json(lead);
  }

  static async listLeads(req: Request, res: Response) {
    const stage = req.query.stage as string | undefined;
    const leads = await MarketingService.listLeads(stage);
    res.status(200).json({ data: leads });
  }

  static async updateLeadStage(req: Request, res: Response) {
    const input = updateLeadStageSchema.parse(req.body);
    const lead = await MarketingService.updateLeadStage(req.params.id as string, input);
    res.status(200).json(lead);
  }

  // 5. Dashboard Overview
  static async getOverview(req: Request, res: Response) {
    const month = req.query.month as string | undefined;
    const overview = await MarketingService.getDashboardOverview(month);
    res.status(200).json(overview);
  }
}
