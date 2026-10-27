import test from 'node:test';
import assert from 'node:assert/strict';
import { connectDatabase, disconnectDatabase } from '../../core/db/connect.js';
import { dashboardService } from './dashboard.service.js';

test('dashboardService: RBAC data isolation', async (t) => {
  test.before(async () => {
    await connectDatabase({ isTestConnection: true });
  });

  test.after(async () => {
    await disconnectDatabase();
  });

  await t.test('user with no finance permissions receives null financial metrics', async () => {
    const permissions = ['attendance.self', 'leave.self', 'employees.self'];
    const overview = await dashboardService.getOverview(permissions, 'employee');

    assert.equal(overview.financialOverview, null, 'Financial overview must be null');
    assert.equal(overview.expectedFromClients, null, 'Expected clients must be null');
    assert.equal(overview.moneyToBePaidToVendors, null, 'Vendor payables must be null');
    assert.equal(overview.moneyMovement, null, 'Money movement must be null');
    assert.equal(overview.trends, null, 'Trends must be null');
  });

  await t.test('user with finance.view permission receives financial metrics', async () => {
    const permissions = ['finance.view', 'finance.view_payments', 'finance.view_reports', 'leads.view', 'campaigns.view'];
    const overview = await dashboardService.getOverview(permissions, 'finance');

    assert.ok(overview.financialOverview !== null, 'Financial overview must not be null');
    assert.ok(typeof overview.financialOverview.totalClientPaymentsReceived === 'number');
    assert.ok(typeof overview.financialOverview.totalVendorPaymentsMade === 'number');
    assert.ok(typeof overview.financialOverview.clientOutstandingReceivables === 'number');
    assert.ok(typeof overview.financialOverview.netProfit === 'number');
    assert.ok(Array.isArray(overview.moneyMovement));
    assert.ok(Array.isArray(overview.expectedFromClients));
    assert.ok(Array.isArray(overview.moneyToBePaidToVendors));
  });
});
