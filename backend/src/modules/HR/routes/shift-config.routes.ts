import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../../../core/auth/auth-middleware.js';
import { requirePermission } from '../../../core/rbac/index.js';
import ShiftConfig from '../models/shift-config.model.js';
import { z } from 'zod';

export const shiftConfigRoutes = Router();

shiftConfigRoutes.use(requireAuth);

const shiftConfigSchema = z.object({
  department: z.string().trim().min(1, 'Department is required'),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid startTime format (HH:mm)'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid endTime format (HH:mm)'),
  graceMinutes: z.coerce.number().min(0).default(15),
  halfDayThresholdHours: z.coerce.number().min(1).max(12).default(4),
});

// GET /api/shift-configs — List all shift configurations (HR, Admin, Managers, Employees)
shiftConfigRoutes.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const configs = await ShiftConfig.find().sort({ department: 1 });
    res.json(configs);
  } catch (err) {
    next(err);
  }
});

// GET /api/shift-configs/:department — Get single department shift config
shiftConfigRoutes.get('/:department', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await ShiftConfig.findOne({ department: req.params.department });
    if (!config) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Shift config not found for department' } });
    }
    res.json(config);
  } catch (err) {
    next(err);
  }
});

// POST /api/shift-configs — Create or upsert shift config (HR, Admin)
shiftConfigRoutes.post('/', requirePermission('employees.manage'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = shiftConfigSchema.parse(req.body);
    const config = await ShiftConfig.findOneAndUpdate(
      { department: parsed.department },
      parsed,
      { upsert: true, returnDocument: 'after' }
    );
    res.status(200).json(config);
  } catch (err) {
    next(err);
  }
});

// PUT /api/shift-configs/:department — Update department shift config (HR, Admin)
shiftConfigRoutes.put('/:department', requirePermission('employees.manage'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = shiftConfigSchema.partial().parse(req.body);
    const config = await ShiftConfig.findOneAndUpdate(
      { department: req.params.department },
      parsed,
      { returnDocument: 'after' }
    );
    if (!config) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Shift config not found for department' } });
    }
    res.status(200).json(config);
  } catch (err) {
    next(err);
  }
});
