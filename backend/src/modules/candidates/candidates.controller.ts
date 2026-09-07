import type { Request, Response } from 'express';
import { candidateService } from './candidates.service.js';
import { createCandidateSchema, updateCandidateSchema, listCandidatesSchema } from './candidates.validator.js';

export const candidatesController = {
  async create(req: Request, res: Response) {
    const input = createCandidateSchema.parse(req.body);
    const candidate = await candidateService.create(input, req.file, req.ctx!);
    res.status(201).json({ data: candidate });
  },

  async list(req: Request, res: Response) {
    const query = listCandidatesSchema.parse(req.query);
    const result = await candidateService.list(query, req.ctx!);
    res.json(result);
  },

  async getById(req: Request, res: Response) {
    const id = req.params.id as string;
    const candidate = await candidateService.getById(id, req.ctx!);
    res.json({ data: candidate });
  },

  async update(req: Request, res: Response) {
    const id = req.params.id as string;
    const input = updateCandidateSchema.parse(req.body);
    const candidate = await candidateService.update(id, input, req.ctx!);
    res.json({ data: candidate });
  },
};
