// @ts-ignore
import assert from 'node:assert/strict';
// @ts-ignore
import { after, before, beforeEach, describe, it } from 'node:test';
import { connectDatabase, disconnectDatabase, assertTestDatabase } from '../../core/db/connect.js';
import { type RequestContext } from '../../core/context.js';
import { AuthUser } from '../../core/auth/auth-model.js';
import { Employee } from '../employees/employees.model.js';
import { Campaign, CampaignStatus } from '../campaigns/campaign.model.js';
import { Lead } from '../leads/leads.model.js';
import { Invoice } from './models/invoice.model.js';
import { PaymentIn } from './models/paymentIn.model.js';
import { invoiceService } from './services/invoice.service.js';

describe('Track F: Invoice & Billing Module Integration Tests', () => {
  let adminUser: any;
  let adminEmp: any;
  let adminCtx: RequestContext;
  let testLead: any;
  let testCampaign: any;

  before(async () => {
    await connectDatabase({ isTestConnection: true });
  });

  after(async () => {
    await disconnectDatabase();
  });

  beforeEach(async () => {
    assertTestDatabase();
    await Invoice.deleteMany({});
    await PaymentIn.deleteMany({});
    await Lead.deleteMany({});
    await Campaign.deleteMany({});
    await Employee.deleteMany({});
    await AuthUser.deleteMany({});

    adminUser = await AuthUser.create({
      email: 'finance.admin@mediaoctus.com',
      passwordHash: 'hash123',
      role: 'admin',
      name: 'Finance Admin',
      status: 'Active',
    });

    adminEmp = await Employee.create({
      employeeCode: 'MO-EMP-FIN1',
      fullName: 'Finance Admin',
      workEmail: 'finance.admin@mediaoctus.com',
      department: 'Finance',
      designation: 'Finance Head',
      userId: adminUser._id,
      status: 'Active',
      dateOfJoining: new Date(),
    });

    adminCtx = {
      user: {
        id: String(adminEmp._id),
        email: adminUser.email,
        name: adminUser.name,
        role: adminUser.role,
        permissions: ['finance.manage', 'finance.view_payments', 'finance.create_payment_in', 'finance.delete_payment'] as any,
      },
    };

    testLead = await Lead.create({
      companyName: 'Acme Retail Ltd',
      contactPerson: 'John Doe',
      mobile: '9876543210',
      email: 'john@acme.com',
      companyAddress: 'Unit 402, Trade Tower, Bandra, Mumbai',
      city: 'Mumbai',
      source: 'Website',
      status: 'Won',
    });

    testCampaign = await Campaign.create({
      name: 'Acme Summer OOH Campaign',
      campaignCode: 'CAMP-ACME-01',
      leadId: testLead._id,
      city: 'Mumbai',
      status: CampaignStatus.IN_PROGRESS,
      contractedValue: 50000000,
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
  });

  it('1. Successfully creates a Sales Invoice with automated tax & line item calculations', async () => {
    const invoice = await invoiceService.createInvoice(
      {
        type: 'sales_invoice',
        partyId: String(testLead._id),
        partyName: 'Acme Retail Ltd',
        billingAddress: 'Unit 402, Trade Tower, Mumbai',
        shippingAddress: 'Unit 402, Trade Tower, Mumbai',
        gstin: '27AABCU9603R1ZM',
        placeOfSupply: 'Maharashtra (27)',
        campaignId: String(testCampaign._id),
        invoiceDate: new Date().toISOString(),
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        items: [
          {
            name: 'Bandra Flyover Billboard Hoarding',
            description: 'Size 40x20 ft Frontlit',
            hsn: '998361',
            quantity: 2,
            unit: 'Nos',
            rate: 1000000, // ₹10,000 in paise per unit
            taxPercent: 18,
          },
          {
            name: 'High Quality Vinyl Printing & Mounting',
            description: '1600 sq ft',
            hsn: '9988',
            quantity: 1,
            unit: 'Sq Ft',
            rate: 500000, // ₹5,000 in paise
            taxPercent: 18,
          },
        ],
        discount: 100000, // ₹1,000 discount in paise
        additionalCharges: 50000, // ₹500 additional charge in paise
        status: 'Draft',
      },
      adminCtx
    );

    assert.ok(invoice.invoiceNumber.startsWith('INV-'));
    // Subtotal: 2 * 10,000 + 1 * 5,000 = ₹25,000 = 2500000 paise
    assert.equal(invoice.subtotal, 2500000);
    // Tax: 18% of 20,000 (360000) + 18% of 5,000 (90000) = 450000 paise
    assert.equal(invoice.taxAmount, 450000);
    // Taxable: 2500000 - 100000 + 50000 = 2450000 paise
    assert.equal(invoice.taxableAmount, 2450000);
    // Grand Total: 2450000 + 450000 = 2900000 paise (₹29,000)
    assert.equal(invoice.totalAmount, 2900000);
    assert.equal(invoice.amountReceived, 0);
    assert.equal(invoice.balanceAmount, 2900000);
    assert.equal(invoice.status, 'Draft');
  });

  it('2. Successfully creates a Proforma Invoice with "PI" prefix', async () => {
    const proforma = await invoiceService.createInvoice(
      {
        type: 'proforma',
        partyName: 'Apex Brands',
        billingAddress: 'Andheri East, Mumbai',
        invoiceDate: new Date().toISOString(),
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        items: [
          {
            name: 'Airport Digital LED Display',
            quantity: 1,
            unit: 'Month',
            rate: 2000000, // ₹20,000 in paise
            taxPercent: 18,
          },
        ],
        status: 'Draft',
      },
      adminCtx
    );

    assert.ok(proforma.invoiceNumber.startsWith('PI-'));
    assert.equal(proforma.type, 'proforma');
    assert.equal(proforma.totalAmount, 2360000); // 20000 + 18% = 23600
  });

  it('3. Duplicates an existing Proforma Invoice with a new number', async () => {
    const original = await invoiceService.createInvoice(
      {
        type: 'proforma',
        partyName: 'Apex Brands',
        invoiceDate: new Date().toISOString(),
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        items: [{ name: 'Display Screen', quantity: 1, rate: 1000000, taxPercent: 18 }],
      },
      adminCtx
    );

    const dup = await invoiceService.duplicateInvoice(original.id, adminCtx);

    assert.notEqual(dup.id, original.id);
    assert.notEqual(dup.invoiceNumber, original.invoiceNumber);
    assert.equal(dup.partyName, original.partyName);
    assert.equal(dup.totalAmount, original.totalAmount);
    assert.equal(dup.status, 'Draft');
  });

  it('4. Records a client payment against invoice and updates balance & status', async () => {
    const invoice = await invoiceService.createInvoice(
      {
        type: 'sales_invoice',
        partyId: String(testLead._id),
        partyName: 'Acme Retail Ltd',
        campaignId: String(testCampaign._id),
        invoiceDate: new Date().toISOString(),
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        items: [{ name: 'Metro Pillar Branding', quantity: 1, rate: 10000000, taxPercent: 18 }], // ₹1,18,000 total (11800000 paise)
        status: 'Sent',
      },
      adminCtx
    );

    assert.equal(invoice.totalAmount, 11800000);

    // Partial Payment of ₹50,000 (5000000 paise)
    const partialRes = await invoiceService.recordInvoicePayment(
      invoice.id,
      {
        amount: 5000000,
        receivedAt: new Date().toISOString(),
        method: 'bank_transfer',
        transactionId: 'TXN-99881',
        notes: 'First installment',
      },
      adminCtx
    );

    assert.equal(partialRes.invoice.amountReceived, 5000000);
    assert.equal(partialRes.invoice.balanceAmount, 6800000);
    assert.equal(partialRes.invoice.status, 'Partially Paid');

    // Remaining Payment of ₹68,000 (6800000 paise)
    const finalRes = await invoiceService.recordInvoicePayment(
      invoice.id,
      {
        amount: 6800000,
        receivedAt: new Date().toISOString(),
        method: 'bank_transfer',
        transactionId: 'TXN-99882',
        notes: 'Final settlement',
      },
      adminCtx
    );

    assert.equal(finalRes.invoice.amountReceived, 11800000);
    assert.equal(finalRes.invoice.balanceAmount, 0);
    assert.equal(finalRes.invoice.status, 'Paid');

    // Verify linked PaymentIn records
    const full = await invoiceService.getInvoiceById(invoice.id, adminCtx);
    assert.equal(full.payments?.length, 2);
  });

  it('5. Retrieves recent historical prices for a party and item', async () => {
    await invoiceService.createInvoice(
      {
        type: 'sales_invoice',
        partyId: String(testLead._id),
        partyName: 'Acme Retail Ltd',
        invoiceDate: new Date().toISOString(),
        dueDate: new Date().toISOString(),
        items: [{ name: 'Bus Shelter Advertising', quantity: 5, rate: 800000, taxPercent: 18 }],
        status: 'Paid',
      },
      adminCtx
    );

    const prices = await invoiceService.getRecentPartyPrices(String(testLead._id), 'Bus Shelter');
    assert.ok(prices.length >= 1);
    assert.equal(prices[0].rate, 800000);
    assert.equal(prices[0].itemName, 'Bus Shelter Advertising');
  });

  it('6. Generates valid PDF Buffer with Media Octus brand and invoice metadata', async () => {
    const invoice = await invoiceService.createInvoice(
      {
        type: 'sales_invoice',
        partyId: String(testLead._id),
        partyName: 'Acme Retail Ltd',
        billingAddress: 'Bandra West, Mumbai',
        gstin: '27AABCU9603R1ZM',
        invoiceDate: new Date().toISOString(),
        dueDate: new Date().toISOString(),
        items: [{ name: 'Expressway Unipole Display', quantity: 1, rate: 2500000, taxPercent: 18 }],
        bankDetails: {
          bankName: 'HDFC Bank',
          accountNumber: '50200012345678',
          ifsc: 'HDFC0000123',
          branch: 'Bandra Mumbai',
        },
      },
      adminCtx
    );

    const pdf = await invoiceService.generateInvoicePdf(invoice.id);
    assert.ok(Buffer.isBuffer(pdf));
    assert.ok(pdf.length > 500); // Standard A4 PDF size
  });

  it('7. Soft deletes invoice and prevents deletion if client payments are attached', async () => {
    const invoice = await invoiceService.createInvoice(
      {
        type: 'proforma',
        partyName: 'Test Delete Party',
        invoiceDate: new Date().toISOString(),
        dueDate: new Date().toISOString(),
        items: [{ name: 'Test Site', quantity: 1, rate: 100000, taxPercent: 18 }],
      },
      adminCtx
    );

    const delRes = await invoiceService.deleteInvoice(invoice.id, adminCtx);
    assert.equal(delRes.success, true);

    const check = await Invoice.findById(invoice.id);
    assert.equal(check?.isDeleted, true);
  });

  it('8. Successfully converts Proforma to Sales Invoice without duplicate number collisions', async () => {
    // Create a proforma
    const proforma = await invoiceService.createInvoice(
      {
        type: 'proforma',
        partyName: 'Conversion Test Party',
        invoiceDate: new Date().toISOString(),
        dueDate: new Date().toISOString(),
        items: [{ name: 'Billboard Display', quantity: 1, rate: 500000, taxPercent: 18 }],
      },
      adminCtx
    );

    assert.equal(proforma.type, 'proforma');
    assert.ok(proforma.invoiceNumber.startsWith('PI-'));

    // Convert proforma to sales invoice
    const converted = await invoiceService.convertToSalesInvoice(proforma.id, adminCtx);
    assert.equal(converted.type, 'sales_invoice');
    assert.ok(converted.invoiceNumber.startsWith('INV-'));
    assert.equal(converted.status, 'Sent');
  });

  it('9. Verifies line-item discount calculation (Test Case 1 & Test Case 2) and custom tax percentages', async () => {
    // Test Case 1: Qty = 1, Rate = ₹10,000, Discount = ₹1,000, Tax = 18%
    // Taxable = ₹9,000, Tax = ₹1,620, Total = ₹10,620
    const inv1 = await invoiceService.createInvoice(
      {
        type: 'sales_invoice',
        partyName: 'Discount Client 1',
        invoiceDate: new Date().toISOString(),
        dueDate: new Date().toISOString(),
        items: [
          {
            name: 'Item A',
            quantity: 1,
            unit: 'Nos',
            rate: 1000000, // ₹10,000 in paise
            discount: 100000, // ₹1,000 discount in paise
            taxPercent: 18,
          },
        ],
      },
      adminCtx
    );

    assert.equal(inv1.subtotal, 1000000); // Gross: ₹10,000
    assert.equal(inv1.items[0].discount, 100000);
    assert.equal(inv1.taxableAmount, 900000); // ₹9,000
    assert.equal(inv1.taxAmount, 162000); // 18% of ₹9,000 = ₹1,620
    assert.equal(inv1.totalAmount, 1062000); // ₹10,620

    // Test Case 2: Qty = 2, Rate = ₹5,000, Discount = ₹500, Tax = 12%
    // Gross: 2 * 5,000 = ₹10,000. Discount = ₹500. Taxable = ₹9,500. Tax = 12% of 9,500 = ₹1,140. Total = ₹10,640.
    const inv2 = await invoiceService.createInvoice(
      {
        type: 'sales_invoice',
        partyName: 'Discount Client 2',
        invoiceDate: new Date().toISOString(),
        dueDate: new Date().toISOString(),
        items: [
          {
            name: 'Item B',
            quantity: 2,
            unit: 'Nos',
            rate: 500000, // ₹5,000 in paise
            discount: 50000, // ₹500 in paise
            taxPercent: 12, // Custom tax % = 12%
          },
        ],
      },
      adminCtx
    );

    assert.equal(inv2.subtotal, 1000000); // Gross: ₹10,000
    assert.equal(inv2.taxableAmount, 950000); // ₹9,500
    assert.equal(inv2.taxAmount, 114000); // 12% of ₹9,500 = ₹1,140
    assert.equal(inv2.totalAmount, 1064000); // ₹10,640

    // Custom tax 5% and 0%
    const inv3 = await invoiceService.createInvoice(
      {
        type: 'sales_invoice',
        partyName: 'Custom Tax Client',
        invoiceDate: new Date().toISOString(),
        dueDate: new Date().toISOString(),
        items: [
          {
            name: 'Zero Tax Item',
            quantity: 1,
            rate: 100000, // ₹1,000
            taxPercent: 0,
          },
          {
            name: '5% Tax Item',
            quantity: 1,
            rate: 200000, // ₹2,000
            taxPercent: 5,
          },
        ],
      },
      adminCtx
    );

    // Item 1: ₹1,000 tax = 0. Item 2: ₹2,000 tax = 5% of 2,000 = ₹100.
    assert.equal(inv3.subtotal, 300000);
    assert.equal(inv3.taxAmount, 10000); // ₹100 in paise
    assert.equal(inv3.totalAmount, 310000); // ₹3,100 in paise
  });

  it('10. Generates sequential invoice and proforma invoice numbers (INV-TEST-001, PI-TEST-001)', async () => {
    // Clear invoices to test clean sequence starting at 001
    await Invoice.deleteMany({});

    const inv1 = await invoiceService.createInvoice(
      {
        type: 'sales_invoice',
        partyName: 'Sequence Client 1',
        invoiceDate: new Date().toISOString(),
        dueDate: new Date().toISOString(),
        items: [{ name: 'Item', quantity: 1, rate: 100000, taxPercent: 18 }],
      },
      adminCtx
    );
    assert.equal(inv1.invoiceNumber, 'INV-TEST-001');

    const inv2 = await invoiceService.createInvoice(
      {
        type: 'sales_invoice',
        partyName: 'Sequence Client 2',
        invoiceDate: new Date().toISOString(),
        dueDate: new Date().toISOString(),
        items: [{ name: 'Item', quantity: 1, rate: 100000, taxPercent: 18 }],
      },
      adminCtx
    );
    assert.equal(inv2.invoiceNumber, 'INV-TEST-002');

    const pi1 = await invoiceService.createInvoice(
      {
        type: 'proforma',
        partyName: 'Sequence PI 1',
        invoiceDate: new Date().toISOString(),
        dueDate: new Date().toISOString(),
        items: [{ name: 'Item', quantity: 1, rate: 100000, taxPercent: 18 }],
      },
      adminCtx
    );
    assert.equal(pi1.invoiceNumber, 'PI-TEST-001');

    const pi2 = await invoiceService.createInvoice(
      {
        type: 'proforma',
        partyName: 'Sequence PI 2',
        invoiceDate: new Date().toISOString(),
        dueDate: new Date().toISOString(),
        items: [{ name: 'Item', quantity: 1, rate: 100000, taxPercent: 18 }],
      },
      adminCtx
    );
    assert.equal(pi2.invoiceNumber, 'PI-TEST-002');
  });

  it('11. Generates PDF without errors when optional fields are empty', async () => {
    const minimalInv = await invoiceService.createInvoice(
      {
        type: 'sales_invoice',
        partyName: 'Minimal Info Ltd',
        invoiceDate: new Date().toISOString(),
        dueDate: new Date().toISOString(),
        // optional fields omitted: no billingAddress, shippingAddress, gstin, placeOfSupply, bankDetails, notes, terms
        items: [
          {
            name: 'Simple Billboard',
            quantity: 1,
            rate: 500000,
            taxPercent: 18,
          },
        ],
      },
      adminCtx
    );

    const pdf = await invoiceService.generateInvoicePdf(minimalInv.id);
    assert.ok(Buffer.isBuffer(pdf));
    assert.ok(pdf.length > 500);
  });
});
