import { Request, Response, NextFunction } from 'express';
import * as service from '../services/reports.service.js';

export async function getDailySummary(req: Request, res: Response, next: NextFunction) {
  try {
    const date = (req.query.date as string) || new Date().toISOString();
    const data = await service.getDailySummary(date, req.ctx!);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getLateReport(req: Request, res: Response, next: NextFunction) {
  try {
    const fromDate = req.query.fromDate as string;
    const toDate = req.query.toDate as string;
    
    if (!fromDate || !toDate) {
      return res.status(400).json({ error: { message: 'fromDate and toDate are required' } });
    }

    const data = await service.getLateReport(fromDate, toDate, req.ctx!);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getMonthlyRegister(req: Request, res: Response, next: NextFunction) {
  try {
    const fromMonth = parseInt((req.query.fromMonth || req.query.month) as string, 10);
    const fromYear = parseInt((req.query.fromYear || req.query.year) as string, 10);
    const toMonth = parseInt((req.query.toMonth || req.query.month) as string, 10);
    const toYear = parseInt((req.query.toYear || req.query.year) as string, 10);

    if (isNaN(fromMonth) || isNaN(fromYear) || isNaN(toMonth) || isNaN(toYear)) {
      return res.status(400).json({ error: { message: 'Valid month and year parameters are required' } });
    }

    const data = await service.getMonthlyRegister(fromMonth, fromYear, toMonth, toYear, req.ctx!);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getAbsenceReport(req: Request, res: Response, next: NextFunction) {
  try {
    const fromDate = req.query.fromDate as string;
    const toDate = req.query.toDate as string;
    
    if (!fromDate || !toDate) {
      return res.status(400).json({ error: { message: 'fromDate and toDate are required' } });
    }

    const data = await service.getAbsenceReport(fromDate, toDate, req.ctx!);
    res.json(data);
  } catch (err) {
    next(err);
  }
}
