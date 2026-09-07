import cors from 'cors';
import express, { Request, Response } from 'express';
import { config } from './config/index.js';
import './core/context.js';
import { auditMiddleware } from './core/audit/index.js';
import authRoutes from './core/auth/auth-routes.js';
import fileRoutes from './core/files/files-routes.js';
import { errorHandler, notFoundHandler } from './core/http/error-middleware.js';
import notificationRoutes from './core/notifications/notifications-routes.js';
import employeeRoutes from './modules/employees/employees.routes.js';
import { attendanceRoutes } from './modules/HR/routes/attendance.routes.js';
import leaveTypeRoutes, {
  employeeLeaveBalanceRouter,
  leaveBalancesRouter,
} from './modules/HR/leaveTypes/leaveTypes.routes.js';
import { leaveRoutes } from './modules/HR/routes/leave.routes.js';
import { holidayRoutes } from './modules/HR/routes/holiday.routes.js';


const app = express();

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      
      const isAllowed = 
        config.cors.origins.includes('*') || 
        config.cors.origins.includes(origin) ||
        /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+):\d+$/.test(origin);
        
      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

/**
 * Global audit log. Mounted before the routes so it can hook the response, but
 * it reads `req.ctx` at finish time — by which point requireAuth has run.
 * Every successful create/update/delete is recorded without module authors
 * doing anything.
 */
if (config.audit.enabled) {
  app.use(auditMiddleware);
}

// Health check — used by the deployment and by the frontend to detect a dead API.
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    env: config.nodeEnv,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// --- Core ---------------------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/files', fileRoutes);

import { leadRoutes } from './modules/leads/leads.routes.js';

import vendorRoutes from './modules/vendors/vendor.routes.js';
import siteRoutes from './modules/sites/site.routes.js';
import campaignRoutes from './modules/campaigns/campaign.routes.js';
import bookingRoutes from './modules/bookings/booking.routes.js';
import taskRoutes from './modules/tasks/task.routes.js';
import escalationRoutes from './modules/escalations/escalation.routes.js';
import purchaseOrderRoutes from "./modules/purchase-orders/purchase-order.routes.js";


import quotationsRoutes, { publicQuotationsRoutes } from './modules/quotations/quotations.routes.js';

// --- Modules ------------------------------------------------------------------
// G1 — the reference module. Copy its structure.
app.use('/api/employees', employeeRoutes);
app.use('/api/leads', leadRoutes);

app.use('/api/vendors', vendorRoutes);
app.use('/api/sites', siteRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/tasks',taskRoutes);
app.use('/api', escalationRoutes);

app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/quotations', quotationsRoutes);
app.use('/q', publicQuotationsRoutes);

//attendance
app.use('/api/attendance', attendanceRoutes);

import { reportsRoutes } from './modules/HR/routes/reports.routes.js';
app.use('/api/reports', reportsRoutes);

// G3 — Leave Types, Quotas & Balances. The legacy leave router is retained
// only for later migration work and is not mounted as a second G3 API.
app.use('/api/leave-types', leaveTypeRoutes);
app.use('/api/leave-balances', leaveBalancesRouter);
app.use('/api/employees', employeeLeaveBalanceRouter);
app.use('/api/leave-requests', leaveRoutes);
app.use('/api/holidays', holidayRoutes);

import candidateRoutes from './modules/candidates/candidates.routes.js';
app.use('/api/candidates', candidateRoutes);


// 404 then the central error handler — both must stay last.
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
