import { Request, Response } from 'express';
import { LeadsService } from './leads.service.js';
import {
  createLeadSchema,
  updateLeadSchema,
  listLeadsSchema,
  leadQualificationSchema,
  intakeLeadSchema,
  changeStatusSchema,
  logFollowUpSchema,
  managerApprovalSchema,
} from './leads.validator.js';

export class LeadsController {
  static async listAgents(_req: Request, res: Response) {
    const agents = await LeadsService.listAgents();
    res.status(200).json({ agents });
  }

  static async list(req: Request, res: Response) {
    const filters = listLeadsSchema.parse(req.query);
    const { leads, total } = await LeadsService.listLeads(filters, req.ctx!);

    res.status(200).json({
      data: leads,
      meta: {
        total,
        page: filters.page,
        limit: filters.limit,
      },
    });
  }

  static async get(req: Request, res: Response) {
    const lead = await LeadsService.getLead(req.params.id as string, req.ctx!);
    res.status(200).json(lead);
  }

  static async create(req: Request, res: Response) {
    const data = createLeadSchema.parse(req.body);
    const lead = await LeadsService.createLead(data, req.ctx!);
    res.status(201).json(lead);
  }

  static async intake(req: Request, res: Response) {
    const payload = intakeLeadSchema.parse(req.body);
    const source = (req.query.source as string) || payload.source || 'Website';
    const lead = await LeadsService.intakeLead(source, payload);
    res.status(201).json({ status: 'ok', leadId: lead._id, leadStatus: lead.status });
  }

  static async update(req: Request, res: Response) {
    const data = updateLeadSchema.parse(req.body);
    const lead = await LeadsService.updateLead(req.params.id as string, data, req.ctx!);
    res.status(200).json(lead);
  }

  static async changeStatus(req: Request, res: Response) {
    const data = changeStatusSchema.parse(req.body);
    const lead = await LeadsService.changeStatus(req.params.id as string, data, req.ctx!);
    res.status(200).json(lead);
  }

  static async claim(req: Request, res: Response) {
    const lead = await LeadsService.claimLead(req.params.id as string, req.ctx!);
    res.status(200).json(lead);
  }

  static async qualify(req: Request, res: Response) {
    const data = leadQualificationSchema.parse(req.body);
    const lead = await LeadsService.qualifyLead(req.params.id as string, data, req.ctx!);
    res.status(200).json(lead);
  }

  static async logCall(req: Request, res: Response) {
    const data = logFollowUpSchema.parse(req.body);
    const lead = await LeadsService.logFollowUpLead(req.params.id as string, data, req.ctx!);
    res.status(200).json(lead);
  }

  static async logFollowUp(req: Request, res: Response) {
    const data = logFollowUpSchema.parse(req.body);
    const lead = await LeadsService.logFollowUpLead(req.params.id as string, data, req.ctx!);
    res.status(200).json(lead);
  }

  static async managerApprove(req: Request, res: Response) {
    const data = managerApprovalSchema.parse(req.body);
    const lead = await LeadsService.managerApproveLead(req.params.id as string, data, req.ctx!);
    res.status(200).json(lead);
  }

  static async getActivity(req: Request, res: Response) {
    const activity = await LeadsService.getActivity(req.params.id as string, req.ctx!);
    res.status(200).json(activity);
  }
}
