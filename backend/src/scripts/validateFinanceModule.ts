/**
 * Comprehensive Finance & Analytics Status & UI Logic Validator
 */
import { connectDatabase, disconnectDatabase } from '../core/db/connect.js';
import { AuthUser } from '../core/auth/auth-model.js';
import { invoiceService } from '../modules/finance/services/invoice.service.js';
import { bankAccountService } from '../modules/finance/services/bankAccount.service.js';
import { paymentInService } from '../modules/finance/services/paymentIn.service.js';
import { paymentOutService } from '../modules/finance/services/paymentOut.service.js';
import { campaignFinanceService } from '../modules/finance/services/campaignFinance.service.js';
import { Invoice } from '../modules/finance/models/invoice.model.js';

async function validateFinance() {
  console.log('\n==================================================');
  console.log('🧪 Starting Finance & Analytics Validation Suite');
  console.log('==================================================\n');

  await connectDatabase();

  const user = await AuthUser.findOne({ email: 'admin@mediaoctus.test' }) || await AuthUser.findOne({});
  if (!user) throw new Error('No user found');

  const ctx: any = {
    user: {
      id: String(user._id),
      email: user.email,
      roles: ['admin', 'finance'],
      permissions: ['finance.manage', 'finance.view_payments'],
    },
  };

  const results: Record<string, { pass: boolean; details: string }> = {};

  // 1. Sales Invoices Status Coverage
  console.log('1. Validating Sales Invoices Status Coverage...');
  const salesStatuses = ['Draft', 'Sent', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled'] as const;
  for (const status of salesStatuses) {
    const list = await invoiceService.listInvoices({ type: 'sales_invoice', status, page: 1, pageSize: 50 }, ctx);
    const found = list.invoices.some((i) => i.status === status);
    results[`Sales Invoice Status [${status}]`] = {
      pass: found,
      details: `Found ${list.invoices.length} invoices with status "${status}"`,
    };
    console.log(`  ${found ? '✅' : '❌'} Status: ${status} — ${list.invoices.length} records`);
  }

  // 2. Proforma Invoices Status Coverage
  console.log('\n2. Validating Proforma Invoices Status Coverage...');
  const proformaStatuses = ['Draft', 'Sent', 'Cancelled'] as const;
  for (const status of proformaStatuses) {
    const list = await invoiceService.listInvoices({ type: 'proforma', status, page: 1, pageSize: 50 }, ctx);
    const found = list.invoices.some((i) => i.status === status);
    results[`Proforma Invoice Status [${status}]`] = {
      pass: found,
      details: `Found ${list.invoices.length} proformas with status "${status}"`,
    };
    console.log(`  ${found ? '✅' : '❌'} Status: ${status} — ${list.invoices.length} records`);
  }

  // 3. Bank Accounts Management & Statuses
  console.log('\n3. Validating Bank Accounts...');
  const bankAccounts = await bankAccountService.getBankAccounts(ctx);
  const activeBank = bankAccounts.find((b) => b.isActive && b.isDefault);
  const inactiveBank = bankAccounts.find((b) => !b.isActive);
  results['Bank Account - Active & Default'] = {
    pass: !!activeBank,
    details: activeBank ? `Default active: ${activeBank.bankName} (${activeBank.accountNumber})` : 'Not found',
  };
  results['Bank Account - Inactive'] = {
    pass: !!inactiveBank,
    details: inactiveBank ? `Inactive archive: ${inactiveBank.bankName} (${inactiveBank.accountNumber})` : 'Not found',
  };
  console.log(`  ${activeBank ? '✅' : '❌'} Active Default Bank: ${activeBank?.bankName}`);
  console.log(`  ${inactiveBank ? '✅' : '❌'} Inactive Bank Account: ${inactiveBank?.bankName}`);

  // 4. Mathematical Precision & Auto-Calculations
  console.log('\n4. Validating Automatic Calculations...');
  const testInv = await Invoice.findOne({ invoiceNumber: 'INV-TEST-003' });
  if (testInv) {
    const item = testInv.items[0];
    const expectedTax = Math.round((item.rate * item.quantity * item.taxPercent) / 100);
    const expectedTotal = item.rate * item.quantity + expectedTax;
    const expectedBalance = testInv.totalAmount - (testInv.amountReceived || 0);

    const calcPass = Number(item.taxAmount) === Number(expectedTax) && Number(item.amount) === Number(expectedTotal) && Number(testInv.balanceAmount) === Number(expectedBalance);
    results['Integer Paise Auto-Calculations'] = {
      pass: calcPass,
      details: `Tax: ₹${testInv.taxAmount / 100} (exp ₹${expectedTax / 100}), Total: ₹${testInv.totalAmount / 100} (exp ₹${expectedTotal / 100}), Received: ₹${(testInv.amountReceived || 0) / 100}, Balance: ₹${testInv.balanceAmount / 100} (exp ₹${expectedBalance / 100})`,
    };
    console.log(`  ${calcPass ? '✅' : '❌'} Calculation Check on INV-TEST-003: ItemTax=${item.taxAmount}, ExpTax=${expectedTax}, ItemAmt=${item.amount}, ExpAmt=${expectedTotal}, Balance=${testInv.balanceAmount}, ExpBalance=${expectedBalance}`);
  }

  // 5. PDF Generation & Branding
  console.log('\n5. Validating PDF Generation...');
  const salesDoc = await Invoice.findOne({ invoiceNumber: 'INV-TEST-001' });
  const proformaDoc = await Invoice.findOne({ invoiceNumber: 'PI-TEST-001' });

  if (salesDoc) {
    const salesPdf = await invoiceService.generateInvoicePdf(String(salesDoc._id));
    const hasHeader = salesPdf.toString('latin1').includes('PDF');
    results['Sales Invoice PDF Generation'] = {
      pass: salesPdf.length > 1000 && hasHeader,
      details: `Generated Tax Invoice PDF (${salesPdf.length} bytes)`,
    };
    console.log(`  ${hasHeader ? '✅' : '❌'} Sales Invoice PDF: ${salesPdf.length} bytes`);
  }

  if (proformaDoc) {
    const proformaPdf = await invoiceService.generateInvoicePdf(String(proformaDoc._id));
    const hasHeader = proformaPdf.toString('latin1').includes('PDF');
    results['Proforma Invoice PDF Generation'] = {
      pass: proformaPdf.length > 1000 && hasHeader,
      details: `Generated Proforma Invoice PDF (${proformaPdf.length} bytes)`,
    };
    console.log(`  ${hasHeader ? '✅' : '❌'} Proforma Invoice PDF: ${proformaPdf.length} bytes`);
  }

  // 6. Public Share Link & Token Access
  console.log('\n6. Validating Public Share Access...');
  if (salesDoc) {
    // Generate token if not present
    const updated = await invoiceService.getInvoiceById(String(salesDoc._id), ctx);
    const token = updated.shareToken;
    if (token) {
      const publicInv = await invoiceService.getPublicInvoiceByToken(token);
      const publicPdf = await invoiceService.generatePublicInvoicePdfByToken(token);
      const sharePass = publicInv.invoiceNumber === salesDoc.invoiceNumber && publicPdf.length > 1000;
      results['Public Invoice Share Token'] = {
        pass: sharePass,
        details: `Public token ${token} verified without authentication`,
      };
      console.log(`  ${sharePass ? '✅' : '❌'} Public Token Sharing: Validated for ${publicInv.invoiceNumber}`);
    }
  }

  // 7. Client Payments (Payment In)
  console.log('\n7. Validating Client Payments Ledger (Payment In)...');
  const paymentsInRes = await paymentInService.listPaymentsIn({ page: 1, pageSize: 100 }, ctx);
  const reconciledIn = paymentsInRes.payments.filter((p) => p.reconciled).length;
  const unreconciledIn = paymentsInRes.payments.filter((p) => !p.reconciled).length;
  results['Payment In - Reconciled & Unreconciled'] = {
    pass: reconciledIn > 0 && unreconciledIn > 0,
    details: `${paymentsInRes.payments.length} total payments (Reconciled: ${reconciledIn}, Pending: ${unreconciledIn}, Total: ₹${paymentsInRes.totalAmount / 100})`,
  };
  console.log(`  ✅ Payments In: ${paymentsInRes.payments.length} txns (Reconciled: ${reconciledIn}, Pending: ${unreconciledIn}, Total: ₹${paymentsInRes.totalAmount / 100})`);

  // 8. Vendor Payments (Payment Out)
  console.log('\n8. Validating Vendor Payments Ledger (Payment Out)...');
  const paymentsOutRes = await paymentOutService.listPaymentsOut({ page: 1, pageSize: 100 }, ctx);
  const reconciledOut = paymentsOutRes.payments.filter((p) => p.reconciled).length;
  const categories = new Set(paymentsOutRes.payments.map((p) => p.category));
  results['Payment Out - Categories & Reconciliation'] = {
    pass: reconciledOut > 0 && categories.size >= 3,
    details: `${paymentsOutRes.payments.length} vendor payments across categories: ${Array.from(categories).join(', ')}`,
  };
  console.log(`  ✅ Payments Out: ${paymentsOutRes.payments.length} txns across categories: ${Array.from(categories).join(', ')} (Total: ₹${paymentsOutRes.totalAmount / 100})`);

  // 9. Campaign Finance Rollups
  console.log('\n9. Validating Campaign Finance Rollups...');
  const financeSummary = await campaignFinanceService.getSummary(ctx);
  results['Campaign Finance Profitability Matrix'] = {
    pass: !!financeSummary,
    details: `Total Revenue: ₹${financeSummary.totalRevenue / 100}, Expenses: ₹${financeSummary.totalExpenses / 100}, Profit: ₹${financeSummary.totalProfit / 100} (${financeSummary.averageMargin.toFixed(1)}%)`,
  };
  console.log(`  ✅ Financial Summary: Revenue ₹${financeSummary.totalRevenue / 100}, Expenses ₹${financeSummary.totalExpenses / 100}, Profit ₹${financeSummary.totalProfit / 100} (${financeSummary.averageMargin.toFixed(1)}%)`);

  console.log('\n==================================================');
  console.log('📊 Validation Summary');
  console.log('==================================================');
  let allPassed = true;
  for (const [name, res] of Object.entries(results)) {
    if (!res.pass) allPassed = false;
    console.log(`${res.pass ? '✅ PASS' : '❌ FAIL'}: ${name} — ${res.details}`);
  }

  await disconnectDatabase();

  if (!allPassed) {
    process.exit(1);
  }
}

validateFinance().catch((err) => {
  console.error('Validation error:', err);
  process.exit(1);
});
