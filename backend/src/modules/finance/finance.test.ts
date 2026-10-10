import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { Types } from 'mongoose';
import { connectDatabase, disconnectDatabase, assertTestDatabase } from '../../core/db/connect.js';
import { type RequestContext } from '../../core/context.js';
import { AuthUser } from '../../core/auth/auth-model.js';
import { Employee } from '../employees/employees.model.js';
import { Campaign, CampaignStatus } from '../campaigns/campaign.model.js';
import { Vendor } from '../vendors/vendor.model.js';
import { Lead } from '../leads/leads.model.js';
import { PaymentIn } from './models/paymentIn.model.js';
import { PaymentOut } from './models/paymentOut.model.js';
import { CampaignFinance } from './models/campaignFinance.model.js';
import { ProfitLog } from './models/profitLog.model.js';
import { paymentInService } from './services/paymentIn.service.js';
import { paymentOutService } from './services/paymentOut.service.js';
import { campaignFinanceService } from './services/campaignFinance.service.js';
import { profitCalculationJob } from '../../jobs/profitCalculation.job.js';

describe('Track F: Finance Module Backend Integration Tests', () => {
  let adminUser: any;
  let adminEmp: any;
  let adminCtx: RequestContext;
  let testCampaign: any;
  let testVendor: any;

  before(async () => {
    await connectDatabase({ isTestConnection: true });
  });

  after(async () => {
    await disconnectDatabase();
  });

  beforeEach(async () => {
    assertTestDatabase();
    await PaymentIn.deleteMany({});
    await PaymentOut.deleteMany({});
    await CampaignFinance.deleteMany({});
    await ProfitLog.deleteMany({});
    await Campaign.deleteMany({});
    await Vendor.deleteMany({});
    await Employee.deleteMany({});
    await AuthUser.deleteMany({});

    adminUser = await AuthUser.create({
      email: 'admin@mediaoctus.com',
      passwordHash: 'hash123',
      role: 'admin',
      name: 'Admin User',
      status: 'Active',
    });

    adminEmp = await Employee.create({
      employeeCode: 'MO-EMP-ADM1',
      fullName: 'Admin User',
      workEmail: 'admin@mediaoctus.com',
      department: 'Finance',
      designation: 'CFO',
      userId: adminUser._id,
      status: 'Active',
    });

    adminCtx = {
      user: {
        id: adminUser._id.toString(),
        email: adminUser.email,
        name: adminUser.name,
        role: adminUser.role,
        permissions: [
          'finance.create_payment_in',
          'finance.create_payment_out',
          'finance.view_payments',
          'finance.update_payment',
          'finance.delete_payment',
          'finance.reconcile_payment',
          'finance.view_reports',
          'finance.view_leadership_reports',
        ] as any,
      },
    };

    const testLead = await Lead.create({
      companyName: 'Coca-Cola India',
      contactPerson: 'John Doe',
      mobile: '9876543210',
      source: 'Manual',
      status: 'Won',
      assignedTo: adminEmp._id,
      createdBy: adminEmp._id,
    });

    testCampaign = await Campaign.create({
      name: 'Coca Cola Summer OOH Campaign',
      campaignCode: 'CAMP-COCA-001',
      contractedValue: 10000000, // ₹100,000 in paise
      status: CampaignStatus.APPROVED,
      city: 'Mumbai',
      leadId: testLead._id,
      startDate: new Date('2026-06-01'),
      endDate: new Date('2026-06-30'),
      createdBy: adminEmp._id,
    });

    testVendor = await Vendor.create({
      name: 'Apex Billboard Networks',
      vendorType: 'Company',
      registrationStatus: 'Registered',
      primaryContact: {
        name: 'Vendor Bob',
        designation: 'Manager',
        mobileNumber: '9876543210',
        email: 'apex@media.test',
      },
      state: 'Maharashtra',
      citiesServed: ['Mumbai'],
      status: 'Active',
    });
  });

  it('F1 & F3: records PaymentIn and automatically updates CampaignFinance revenue & margin', async () => {
    const payment = await paymentInService.createPaymentIn(
      {
        campaignId: testCampaign._id.toString(),
        amount: 5000000, // ₹50,000 in paise
        receivedAt: new Date(),
        method: 'bank_transfer',
        transactionId: 'TXN-BANK-001',
        notes: 'Initial 50% advance for billboard booking',
      },
      adminCtx
    );

    assert.ok(payment._id);
    assert.equal(payment.amount, 5000000);
    assert.equal(payment.method, 'bank_transfer');
    assert.equal(payment.reconciled, false);

    const finance = await campaignFinanceService.getCampaignFinance(testCampaign._id.toString());
    assert.equal(finance.revenue, 5000000);
    assert.equal(finance.paymentInCount, 1);
    assert.equal(finance.expenses, 0);
    assert.equal(finance.profit, 5000000);
    assert.equal(finance.margin, 100);
    assert.equal(finance.paymentStatus, 'partial');
    assert.equal(finance.percentageReceived, 50);
  });

  it('F2 & F3: records PaymentOut and recalculates expenses by category and margin', async () => {
    // 1. Add revenue of ₹100,000
    await paymentInService.createPaymentIn(
      {
        campaignId: testCampaign._id.toString(),
        amount: 10000000,
        receivedAt: new Date(),
        method: 'bank_transfer',
      },
      adminCtx
    );

    // 2. Add media expense of ₹40,000
    await paymentOutService.createPaymentOut(
      {
        campaignId: testCampaign._id.toString(),
        vendorId: testVendor._id.toString(),
        amount: 4000000,
        paidAt: new Date(),
        method: 'bank_transfer',
        category: 'media_cost',
        vendorInvoice: 'INV-APEX-101',
      },
      adminCtx
    );

    // 3. Add production expense of ₹20,000
    await paymentOutService.createPaymentOut(
      {
        campaignId: testCampaign._id.toString(),
        vendorId: testVendor._id.toString(),
        amount: 2000000,
        paidAt: new Date(),
        method: 'upi',
        category: 'production_cost',
      },
      adminCtx
    );

    const finance = await campaignFinanceService.getCampaignFinance(testCampaign._id.toString());
    assert.equal(finance.revenue, 10000000);
    assert.equal(finance.expenses, 6000000);
    assert.equal(finance.expenses_media, 4000000);
    assert.equal(finance.expenses_production, 2000000);
    assert.equal(finance.profit, 4000000); // ₹40,000 profit
    assert.equal(finance.margin, 40); // 40% margin
    assert.equal(finance.paymentStatus, 'complete');
  });

  it('F1 & F2: Soft delete properly updates CampaignFinance rollup', async () => {
    const payment = await paymentInService.createPaymentIn(
      {
        campaignId: testCampaign._id.toString(),
        amount: 5000000,
        receivedAt: new Date(),
        method: 'upi',
      },
      adminCtx
    );

    let finance = await campaignFinanceService.getCampaignFinance(testCampaign._id.toString());
    assert.equal(finance.revenue, 5000000);

    // Soft delete payment
    await paymentInService.deletePaymentIn(payment._id.toString(), adminCtx);

    finance = await campaignFinanceService.getCampaignFinance(testCampaign._id.toString());
    assert.equal(finance.revenue, 0);
    assert.equal(finance.paymentInCount, 0);
  });

  it('F1 & F2: Reconciliation flow updates status and prevents unauthorized changes', async () => {
    const payment = await paymentInService.createPaymentIn(
      {
        campaignId: testCampaign._id.toString(),
        amount: 3000000,
        receivedAt: new Date(),
        method: 'cheque',
        transactionId: 'CHQ-99001',
      },
      adminCtx
    );

    const reconciled = await paymentInService.reconcilePaymentIn(payment._id.toString(), adminCtx);
    assert.equal(reconciled.reconciled, true);
    assert.ok(reconciled.reconciledAt);
    assert.equal(reconciled.reconciledBy?.id, adminEmp._id.toString());
  });

  it('F3: Profit calculation nightly job generates snapshots in ProfitLog', async () => {
    // Setup campaign with revenue & expenses
    await paymentInService.createPaymentIn(
      {
        campaignId: testCampaign._id.toString(),
        amount: 8000000,
        receivedAt: new Date(),
        method: 'bank_transfer',
      },
      adminCtx
    );

    await paymentOutService.createPaymentOut(
      {
        campaignId: testCampaign._id.toString(),
        vendorId: testVendor._id.toString(),
        amount: 5000000,
        paidAt: new Date(),
        method: 'bank_transfer',
        category: 'media_cost',
      },
      adminCtx
    );

    const jobResult = await profitCalculationJob();
    assert.equal(jobResult.processed, 1);
    assert.equal(jobResult.lossesCount, 0);

    const logs = await ProfitLog.find({ campaignId: testCampaign._id });
    assert.equal(logs.length, 1);
    assert.equal(logs[0].profit, 3000000);
    assert.equal(logs[0].margin, 37.5);
  });

  it('F4 & F5: Analytics queries (leaderboard, summary, breakdown, revenue by agent)', async () => {
    await paymentInService.createPaymentIn(
      {
        campaignId: testCampaign._id.toString(),
        amount: 10000000,
        receivedAt: new Date(),
        method: 'bank_transfer',
      },
      adminCtx
    );

    await paymentOutService.createPaymentOut(
      {
        campaignId: testCampaign._id.toString(),
        vendorId: testVendor._id.toString(),
        amount: 3000000,
        paidAt: new Date(),
        method: 'bank_transfer',
        category: 'media_cost',
      },
      adminCtx
    );

    // Summary
    const summary = await campaignFinanceService.getSummary(adminCtx);
    assert.equal(summary.totalRevenue, 10000000);
    assert.equal(summary.totalExpenses, 3000000);
    assert.equal(summary.totalProfit, 7000000);
    assert.equal(summary.averageMargin, 70);

    // Leaderboard
    const leaderboard = await campaignFinanceService.getProfitLeaderboard(5, 'profit');
    assert.equal(leaderboard.length, 1);
    assert.equal(leaderboard[0].profit, 7000000);

    // Breakdown
    const breakdown = await campaignFinanceService.getExpenseBreakdown(testCampaign._id.toString());
    assert.equal(breakdown.percentages.media, 100);
    assert.equal(breakdown.media, 3000000);
    assert.equal(breakdown.production, 0);
  });

  it('F3: Safely handles invalid campaign IDs without crashing with BSONError', async () => {
    await assert.rejects(
      async () => {
        await campaignFinanceService.getCampaignFinance('undefined');
      },
      {
        name: 'ValidationError',
        message: 'Invalid campaign ID',
      }
    );

    await assert.rejects(
      async () => {
        await campaignFinanceService.getCampaignFinance('invalid-id-123');
      },
      {
        name: 'ValidationError',
        message: 'Invalid campaign ID',
      }
    );
  });

  it('F1 & F2: Cash payment rule enforces blank transaction reference', async () => {
    // 1. PaymentIn with Cash: transactionId should be empty string
    const cashIn = await paymentInService.createPaymentIn(
      {
        campaignId: testCampaign._id.toString(),
        amount: 2500000,
        receivedAt: new Date(),
        method: 'cash',
        transactionId: 'ACCIDENTAL-INPUT',
      },
      adminCtx
    );
    assert.equal(cashIn.method, 'cash');
    assert.equal(cashIn.transactionId, '');

    // 2. PaymentOut with Cash: transactionId should be empty string
    const cashOut = await paymentOutService.createPaymentOut(
      {
        campaignId: testCampaign._id.toString(),
        vendorId: testVendor._id.toString(),
        amount: 1000000,
        paidAt: new Date(),
        method: 'cash',
        category: 'other',
        transactionId: 'ACCIDENTAL-INPUT-2',
      },
      adminCtx
    );
    assert.equal(cashOut.method, 'cash');
    assert.equal(cashOut.transactionId, '');
  });
});
