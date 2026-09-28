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

export async function exportReport(req: Request, res: Response, next: NextFunction) {
  try {
    const reportType = (req.query.reportType as any) || 'monthly';
    const date = req.query.date as string;
    const fromDate = req.query.fromDate as string;
    const toDate = req.query.toDate as string;
    const fromMonth = req.query.fromMonth ? parseInt(req.query.fromMonth as string, 10) : undefined;
    const fromYear = req.query.fromYear ? parseInt(req.query.fromYear as string, 10) : undefined;
    const toMonth = req.query.toMonth ? parseInt(req.query.toMonth as string, 10) : undefined;
    const toYear = req.query.toYear ? parseInt(req.query.toYear as string, 10) : undefined;
    const department = req.query.department as string;

    const { filename, csv } = await service.exportAttendanceCsv(
      { reportType, date, fromDate, toDate, fromMonth, fromYear, toMonth, toYear, department },
      req.ctx!,
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csv);
  } catch (err) {
    next(err);
  }
}
