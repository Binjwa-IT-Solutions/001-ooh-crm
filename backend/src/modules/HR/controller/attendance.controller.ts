// src/modules/attendance/attendance.controller.ts
import { Request, Response, NextFunction } from 'express';
import * as service from '../services/attendance.service.js';
import { checkInSchema, checkOutSchema } from '../validators/attendance.validator.js';

export async function checkIn(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = checkInSchema.parse(req.body);
    const record = await service.checkIn(parsed, req.ctx!);
    res.status(200).json(record);
  } catch (err) {
    next(err);
  }
}

export async function checkOut(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = checkOutSchema.parse(req.body);
    const record = await service.checkOut(parsed, req.ctx!);
    res.status(200).json(record);
  } catch (err) {
    next(err);
  }
}

export async function getMine(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getMyAttendance(req.ctx!, req.query);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getMineSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const month = parseInt(req.query.month as string, 10);
    const year = parseInt(req.query.year as string, 10);
    if (isNaN(month) || isNaN(year)) {
      throw Object.assign(new Error('Valid month and year are required'), { status: 400 });
    }
    const data = await service.getMyAttendanceSummary(req.ctx!, month, year);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getTeam(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getTeamAttendance(req.ctx!, req.query);
    res.json(data);
  } catch (err) {
    next(err);
  }
}