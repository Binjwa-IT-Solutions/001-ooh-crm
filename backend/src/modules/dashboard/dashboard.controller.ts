import type { Request, Response } from 'express';
import { dashboardService } from './dashboard.service.js';

export const dashboardController = {
  async getOverview(req: Request, res: Response) {
    const permissions = req.ctx?.user?.permissions ?? [];
    const role = req.ctx?.user?.role ?? 'employee';

    const overview = await dashboardService.getOverview(permissions, role);

    return res.status(200).json({
      success: true,
      data: overview,
    });
  },
};
