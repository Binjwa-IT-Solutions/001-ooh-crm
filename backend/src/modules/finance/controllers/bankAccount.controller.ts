import type { Request, Response } from 'express';
import { bankAccountService } from '../services/bankAccount.service.js';
import { UnauthorizedError } from '../../../core/errors/index.js';

export const bankAccountController = {
  async getBankAccounts(req: Request, res: Response) {
    if (!req.ctx) throw new UnauthorizedError();
    const accounts = await bankAccountService.getBankAccounts(req.ctx);
    res.json({ success: true, data: accounts });
  },

  async createBankAccount(req: Request, res: Response) {
    if (!req.ctx) throw new UnauthorizedError();
    const account = await bankAccountService.createBankAccount(req.body, req.ctx);
    res.status(201).json({ success: true, data: account });
  },

  async updateBankAccount(req: Request, res: Response) {
    if (!req.ctx) throw new UnauthorizedError();
    const account = await bankAccountService.updateBankAccount(req.params.id as string, req.body, req.ctx);
    res.json({ success: true, data: account });
  },

  async setDefaultBankAccount(req: Request, res: Response) {
    if (!req.ctx) throw new UnauthorizedError();
    const account = await bankAccountService.setDefaultBankAccount(req.params.id as string, req.ctx);
    res.json({ success: true, data: account });
  },

  async deleteBankAccount(req: Request, res: Response) {
    if (!req.ctx) throw new UnauthorizedError();
    const result = await bankAccountService.deleteBankAccount(req.params.id as string, req.ctx);
    res.json(result);
  },
};

