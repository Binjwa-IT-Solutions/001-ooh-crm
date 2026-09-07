import { Request, Response, NextFunction } from 'express';
import { holidayService } from '../services/holiday.service.js';
import { holidaySchema } from '../validators/holiday.validator.js';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await holidayService.list(req.ctx!);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = holidaySchema.parse(req.body);
    const result = await holidayService.create(parsed, req.ctx!);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = holidaySchema.parse(req.body);
    const result = await holidayService.update(req.params.id as string, parsed, req.ctx!);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function deleteHoliday(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await holidayService.delete(req.params.id as string, req.ctx!);
    res.json({ message: 'Holiday deleted successfully', holiday: result });
  } catch (err) {
    next(err);
  }
}
