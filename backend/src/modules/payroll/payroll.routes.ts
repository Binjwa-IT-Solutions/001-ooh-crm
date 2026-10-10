import { Router } from 'express';
import { requireAuth } from '../../core/auth/auth-middleware.js';
import { asyncHandler } from '../../core/http/asyncHandler.js';
import { requirePermission } from '../../core/rbac/index.js';
import { PayrollController } from './payroll.controller.js';

const router = Router();

router.use(requireAuth);

// ============================================================================
// Employee Salary Management
// ============================================================================
router.get(
  '/salaries',
  requirePermission('salary.view'),
  asyncHandler(PayrollController.listAllEmployeeSalaries),
);

router.get(
  '/salary/:id',
  requirePermission('salary.view'),
  asyncHandler(PayrollController.getEmployeeSalary),
);

router.post(
  '/salary/:id',
  requirePermission('salary.create'),
  asyncHandler(PayrollController.upsertEmployeeSalary),
);

router.patch(
  '/salary/:id',
  requirePermission('salary.update'),
  asyncHandler(PayrollController.upsertEmployeeSalary),
);

router.get(
  '/salary/:id/history',
  requirePermission('salary.view'),
  asyncHandler(PayrollController.getSalaryHistory),
);

// ============================================================================
// Payroll Period & Salary Payments
// ============================================================================
router.get(
  '/',
  requirePermission('payroll.view'),
  asyncHandler(PayrollController.listPayroll),
);

router.post(
  '/generate',
  requirePermission('payroll.create'),
  asyncHandler(PayrollController.generatePayroll),
);

router.get(
  '/:id',
  requirePermission('payroll.view'),
  asyncHandler(PayrollController.getPayrollById),
);

router.post(
  '/:id/pay',
  requirePermission('payroll.process'),
  asyncHandler(PayrollController.processPayment),
);

router.get(
  '/:id/payslip.pdf',
  requirePermission('payroll.payslip'),
  asyncHandler(PayrollController.downloadPayslipPdf),
);

export default router;
