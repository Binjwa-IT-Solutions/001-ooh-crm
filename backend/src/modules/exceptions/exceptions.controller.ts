import { Request, Response } from 'express';
import { ExceptionsService } from './exceptions.service.js';
import type { ExceptionFilters, ExceptionSeverity } from './exception.types.js';

export class ExceptionsController {
  /**
   * GET /api/exceptions - List all unresolved operational exceptions.
   */
  static async list(req: Request, res: Response): Promise<void> {
    const {
      type,
      city,
      campaignId,
      severity,
      from,
      to,
      search,
      includeAcknowledged,
    } = req.query;

    const filters: ExceptionFilters = {
      type: type ? String(type) : undefined,
      city: city ? String(city) : undefined,
      campaignId: campaignId ? String(campaignId) : undefined,
      severity: severity ? (String(severity) as ExceptionSeverity) : undefined,
      from: from ? new Date(String(from)) : undefined,
      to: to ? new Date(String(to)) : undefined,
      search: search ? String(search) : undefined,
      includeAcknowledged: includeAcknowledged === 'true',
    };

    const items = await ExceptionsService.getExceptions(filters);

    res.status(200).json({
      data: items,
      meta: {
        total: items.length,
        highSeverityCount: items.filter((i) => i.severity === 'HIGH').length,
        mediumSeverityCount: items.filter((i) => i.severity === 'MEDIUM').length,
      },
    });
  }

  /**
   * GET /api/exceptions/count - Fast lightweight counter for navigation badge.
   */
  static async count(_req: Request, res: Response): Promise<void> {
    const summary = await ExceptionsService.getCountSummary();
    res.status(200).json({ data: summary });
  }

  /**
   * PATCH /api/exceptions/:id/acknowledge - Mark an exception as acknowledged.
   */
  static async acknowledge(req: Request, res: Response): Promise<void> {
    const exceptionKey = decodeURIComponent(String(req.params.id));
    const { exceptionType, entityId, notes } = req.body || {};
    const userId = req.ctx?.user?.id || '600000000000000000000001';

    await ExceptionsService.acknowledge(
      exceptionKey,
      exceptionType || 'unknown',
      entityId || exceptionKey,
      userId,
      notes,
    );

    res.status(200).json({
      success: true,
      message: 'Exception acknowledged. It will be hidden from the default active view.',
    });
  }
}
