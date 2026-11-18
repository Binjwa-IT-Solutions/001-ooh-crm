import { Router } from 'express';
import { requireAuth } from '../../../core/auth/auth-middleware.js';
import { requirePermission } from '../../../core/rbac/index.js';
import { FinanceController } from '../controllers/finance.controller.js';
import { InvoiceController } from '../controllers/invoice.controller.js';
import { bankAccountController } from '../controllers/bankAccount.controller.js';

const router = Router();

// ============================================================================
// Public Unauthenticated Invoice Access (for WhatsApp / Email Client Sharing)
// ============================================================================
router.get('/invoices/public/:token', InvoiceController.getPublicInvoice);
router.get('/invoices/public/:token/pdf', InvoiceController.downloadPublicPdf);

// ============================================================================
// Sales & Proforma Invoices
// ============================================================================
router.post(
  '/invoices',
  requireAuth,
  requirePermission('finance.manage'),
  InvoiceController.createInvoice
);

router.get(
  '/invoices',
  requireAuth,
  requirePermission('finance.view_payments'),
  InvoiceController.listInvoices
);

router.get(
  '/invoices/:id',
  requireAuth,
  requirePermission('finance.view_payments'),
  InvoiceController.getInvoiceById
);

router.patch(
  '/invoices/:id',
  requireAuth,
  requirePermission('finance.manage'),
  InvoiceController.updateInvoice
);

router.delete(
  '/invoices/:id',
  requireAuth,
  requirePermission('finance.delete_payment'),
  InvoiceController.deleteInvoice
);

router.post(
  '/invoices/:id/duplicate',
  requireAuth,
  requirePermission('finance.manage'),
  InvoiceController.duplicateInvoice
);

router.post(
  '/invoices/:id/convert',
  requireAuth,
  requirePermission('finance.manage'),
  InvoiceController.convertToSalesInvoice
);

router.post(
  '/invoices/:id/payments',
  requireAuth,
  requirePermission('finance.create_payment_in'),
  InvoiceController.recordPayment
);

router.get(
  '/invoices/:id/pdf',
  requireAuth,
  requirePermission('finance.view_payments'),
  InvoiceController.downloadPdf
);

router.get(
  '/parties/:partyId/recent-prices',
  requireAuth,
  requirePermission('finance.view_payments'),
  InvoiceController.getRecentPartyPrices
);

// ============================================================================
// Bank Accounts
// ============================================================================
router.get(
  '/bank-accounts',
  requireAuth,
  requirePermission('finance.view_payments'),
  bankAccountController.getBankAccounts
);

router.post(
  '/bank-accounts',
  requireAuth,
  requirePermission('finance.manage'),
  bankAccountController.createBankAccount
);

router.patch(
  '/bank-accounts/:id',
  requireAuth,
  requirePermission('finance.manage'),
  bankAccountController.updateBankAccount
);

router.patch(
  '/bank-accounts/:id/default',
  requireAuth,
  requirePermission('finance.manage'),
  bankAccountController.setDefaultBankAccount
);

router.delete(
  '/bank-accounts/:id',
  requireAuth,
  requirePermission('finance.manage'),
  bankAccountController.deleteBankAccount
);

// ============================================================================
// F1: Payments In (Client Payments)
// ============================================================================
router.post(
  '/payments-in',
  requireAuth,
  requirePermission('finance.create_payment_in'),
  FinanceController.createPaymentIn
);

router.get(
  '/payments-in',
  requireAuth,
  requirePermission('finance.view_payments'),
  FinanceController.listPaymentsIn
);

router.get(
  '/payments-in/:id',
  requireAuth,
  requirePermission('finance.view_payments'),
  FinanceController.getPaymentInById
);

router.patch(
  '/payments-in/:id',
  requireAuth,
  requirePermission('finance.update_payment'),
  FinanceController.updatePaymentIn
);

router.delete(
  '/payments-in/:id',
  requireAuth,
  requirePermission('finance.delete_payment'),
  FinanceController.deletePaymentIn
);

router.patch(
  '/payments-in/:id/reconcile',
  requireAuth,
  requirePermission('finance.reconcile_payment'),
  FinanceController.reconcilePaymentIn
);

// ============================================================================
// F2: Payments Out (Vendor Payments)
// ============================================================================
router.post(
  '/payments-out',
  requireAuth,
  requirePermission('finance.create_payment_out'),
  FinanceController.createPaymentOut
);

router.get(
  '/payments-out',
  requireAuth,
  requirePermission('finance.view_payments'),
  FinanceController.listPaymentsOut
);

router.get(
  '/payments-out/:id',
  requireAuth,
  requirePermission('finance.view_payments'),
  FinanceController.getPaymentOutById
);

router.patch(
  '/payments-out/:id',
  requireAuth,
  requirePermission('finance.update_payment'),
  FinanceController.updatePaymentOut
);

router.delete(
  '/payments-out/:id',
  requireAuth,
  requirePermission('finance.delete_payment'),
  FinanceController.deletePaymentOut
);

router.patch(
  '/payments-out/:id/reconcile',
  requireAuth,
  requirePermission('finance.reconcile_payment'),
  FinanceController.reconcilePaymentOut
);

// ============================================================================
// F3 / F4 / F5: Reports, Analytics & Dashboards
// ============================================================================
router.get(
  '/campaigns/:campaignId/finance',
  requireAuth,
  requirePermission('finance.view_reports'),
  FinanceController.getCampaignFinance
);

router.get(
  '/profit-leaderboard',
  requireAuth,
  requirePermission('finance.view_reports'),
  FinanceController.getProfitLeaderboard
);

router.get(
  '/low-margin-campaigns',
  requireAuth,
  requirePermission('finance.view_reports'),
  FinanceController.getLowMarginCampaigns
);

router.get(
  '/revenue-by-agent',
  requireAuth,
  requirePermission('finance.view_reports'),
  FinanceController.getRevenueByAgent
);

router.get(
  '/summary',
  requireAuth,
  requirePermission('finance.view_reports'),
  FinanceController.getSummary
);

router.get(
  '/profit-trends',
  requireAuth,
  requirePermission('finance.view_reports'),
  FinanceController.getProfitTrends
);

router.get(
  '/expense-breakdown',
  requireAuth,
  requirePermission('finance.view_reports'),
  FinanceController.getExpenseBreakdown
);

router.post(
  '/jobs/run-rollup',
  requireAuth,
  requirePermission('finance.manage'),
  FinanceController.runRollupJob
);

export default router;
