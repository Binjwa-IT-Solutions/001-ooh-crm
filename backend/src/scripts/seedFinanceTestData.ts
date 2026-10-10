/**
 * Status-Wise Realistic Test Data Seeder for Finance & Analytics Validation
 * 
 * Safely seeds test records for every supported status across:
 * - Sales Invoices (Draft, Sent, Partially Paid, Paid, Overdue, Cancelled)
 * - Proforma Invoices (Draft, Sent, Cancelled)
 * - Client Payments / Payment In (Unreconciled, Reconciled across UPI, Cheque, Bank Transfer, Card, Cash)
 * - Vendor Payments / Payment Out (Unreconciled, Reconciled across Media Cost, Production Cost, Logistics, Other)
 * - Company Bank Accounts (Active Default Current, Active Secondary Current, Inactive Savings)
 * 
 * Guards against production execution.
 */
import { Types } from 'mongoose';
import { config } from '../config/index.js';
import { connectDatabase, disconnectDatabase } from '../core/db/connect.js';
import { AuthUser } from '../core/auth/auth-model.js';
import { Employee } from '../modules/employees/employees.model.js';
import { Lead } from '../modules/leads/leads.model.js';
import { Vendor } from '../modules/vendors/vendor.model.js';
import Campaign, { CampaignStatus } from '../modules/campaigns/campaign.model.js';
import { Invoice } from '../modules/finance/models/invoice.model.js';
import { PaymentIn } from '../modules/finance/models/paymentIn.model.js';
import { PaymentOut } from '../modules/finance/models/paymentOut.model.js';
import { BankAccount } from '../modules/finance/models/bankAccount.model.js';
import { CampaignFinance } from '../modules/finance/models/campaignFinance.model.js';

export async function seedFinanceValidationData() {
  if (config.isProduction) {
    throw new Error('Safety guard: Refusing to seed test data in production environment!');
  }

  console.log('\n========================================');
  console.log('🚀 Seeding Finance & Analytics Status Data');
  console.log('========================================');

  // 1. Get or create finance user & employee
  let adminUser = await AuthUser.findOne({ email: 'admin@mediaoctus.test' });
  if (!adminUser) {
    adminUser = await AuthUser.findOne({});
  }
  if (!adminUser) {
    throw new Error('No user found in database to attach as creator.');
  }

  let adminEmp = await Employee.findOne({ userId: adminUser._id });
  if (!adminEmp) {
    adminEmp = await Employee.findOne({});
  }
  const creatorId = adminEmp?._id || adminUser._id;

  // 2. Seed / Get realistic Test Parties (Clients / Leads)
  console.log('\n1. Seeding Test Parties / Clients...');
  const testClientsData = [
    {
      company: 'TEST - Tata Motors Commercial Vehicles',
      clientName: 'Tata Motors Ltd',
      mobile: '9820011223',
      email: 'ooh.procurement@tatamotors.test',
      city: 'Mumbai',
      gstNumber: '27AAACT2727Q1ZW',
      panNumber: 'AAACT2727Q',
      billingAddress: 'Bombay House, 24 Homi Mody Street, Fort, Mumbai 400001',
      shippingAddress: 'Plant 1, Pimpri, Pune 411018',
    },
    {
      company: 'TEST - Reliance Retail Brands',
      clientName: 'Reliance Retail Ventures',
      mobile: '9820022334',
      email: 'media.buying@relianceretail.test',
      city: 'Mumbai',
      gstNumber: '27AABCR1234F1Z8',
      panNumber: 'AABCR1234F',
      billingAddress: 'Maker Chambers IV, Nariman Point, Mumbai 400021',
      shippingAddress: 'Reliance Corporate Park, Ghansoli, Navi Mumbai 400701',
    },
    {
      company: 'TEST - Titan Fastrack Lifestyle',
      clientName: 'Titan Company Limited',
      mobile: '9820033445',
      email: 'brand.promotions@titan.test',
      city: 'Bengaluru',
      gstNumber: '29AAACT3456D1Z2',
      panNumber: 'AAACT3456D',
      billingAddress: 'Titan Tower, Electronic City, Bengaluru 560100',
      shippingAddress: 'Indiranagar Flagship Hub, Bengaluru 560038',
    },
  ];

  const clientDocs: any[] = [];
  for (const c of testClientsData) {
    let lead = await Lead.findOne({ email: c.email });
    if (!lead) {
      lead = new Lead({
        companyName: c.company,
        clientName: c.clientName,
        contactPerson: 'Head of Marketing',
        mobile: c.mobile,
        email: c.email,
        city: c.city,
        source: 'Manual',
        status: 'Won',
        budget: 50000000, // ₹5,00,000
        assignedTo: creatorId,
        isClaimed: true,
        claimedBy: creatorId,
      });
      await lead.save();
      console.log(`  + Created client lead: ${c.company}`);
    }
    clientDocs.push(lead);
  }

  // 3. Seed / Get realistic Test Vendors
  console.log('\n2. Seeding Test Vendors...');
  const testVendorsData = [
    {
      name: 'TEST - Apex Hoardings & Outdoor Media',
      vendorType: 'Company',
      registrationStatus: 'Registered',
      gstNumber: '27AAACA9876P1Z4',
      panNumber: 'AAACA9876P',
      bankDetails: {
        accountHolder: 'Apex Hoardings Pvt Ltd',
        bankName: 'ICICI Bank',
        accountNumber: '000405001122',
        ifsc: 'ICIC0000004',
        branch: 'Nariman Point, Mumbai',
      },
    },
    {
      name: 'TEST - Zenith Large Format Print Solutions',
      vendorType: 'Company',
      registrationStatus: 'Registered',
      gstNumber: '27AAACZ1122K1Z9',
      panNumber: 'AAACZ1122K',
      bankDetails: {
        accountHolder: 'Zenith Large Format Print Solutions',
        bankName: 'HDFC Bank',
        accountNumber: '50200011223344',
        ifsc: 'HDFC0000240',
        branch: 'Andheri East, Mumbai',
      },
    },
  ];

  const vendorDocs: any[] = [];
  for (const v of testVendorsData) {
    let vendor = await Vendor.findOne({ name: v.name });
    if (!vendor) {
      vendor = new Vendor({
        name: v.name,
        vendorType: v.vendorType,
        registrationStatus: v.registrationStatus,
        gstNumber: v.gstNumber,
        panNumber: v.panNumber,
        msmeRegistered: false,
        bankDetails: v.bankDetails,
        citiesServed: ['Mumbai', 'Pune'],
        primaryContact: {
          name: 'Rajesh Kumar',
          email: 'rajesh@vendor.test',
          phone: '9820055667',
        },
        status: 'Active',
      });
      await vendor.save();
      console.log(`  + Created test vendor: ${v.name}`);
    }
    vendorDocs.push(vendor);
  }

  // 4. Seed / Get realistic Test Campaign
  console.log('\n3. Seeding Test Campaign...');
  let testCampaign = await Campaign.findOne({ campaignCode: 'CAMP-TEST-FIN-01' });
  if (!testCampaign) {
    testCampaign = new Campaign({
      campaignCode: 'CAMP-TEST-FIN-01',
      name: 'TEST - Brand Visibility Expressway Campaign Q3',
      leadId: clientDocs[0]._id,
      quotationId: new Types.ObjectId(),
      city: 'Mumbai',
      startDate: new Date('2026-09-01'),
      endDate: new Date('2026-11-30'),
      contractedValue: 125000000, // ₹12,50,000 in paise
      status: CampaignStatus.APPROVED,
      assignedManager: creatorId,
    });
    await testCampaign.save();
    console.log(`  + Created test campaign: ${testCampaign.name} (${testCampaign.campaignCode})`);
  }

  // 5. Seed Company Bank Accounts
  console.log('\n4. Seeding Company Bank Accounts...');
  const bankAccountsData = [
    {
      bankName: 'HDFC Bank',
      accountHolderName: 'Media Octus Pvt Ltd',
      accountNumber: '50200088991122',
      ifsc: 'HDFC0000123',
      branch: 'Bandra Kurla Complex, Mumbai',
      accountType: 'Current' as const,
      isDefault: true,
      isActive: true,
      notes: 'TEST - Primary current account for all sales billing & client collections.',
    },
    {
      bankName: 'ICICI Bank',
      accountHolderName: 'Media Octus Pvt Ltd - Operations',
      accountNumber: '000405889900',
      ifsc: 'ICIC0000004',
      branch: 'Fort, Mumbai',
      accountType: 'Current' as const,
      isDefault: false,
      isActive: true,
      notes: 'TEST - Secondary operating account for vendor disbursements & utilities.',
    },
    {
      bankName: 'State Bank of India',
      accountHolderName: 'Media Octus Pvt Ltd - Reserve',
      accountNumber: '330011223344',
      ifsc: 'SBIN0000300',
      branch: 'Nariman Point, Mumbai',
      accountType: 'Savings' as const,
      isDefault: false,
      isActive: false,
      notes: 'TEST - Inactive / Legacy bank account for archive verification.',
    },
  ];

  for (const b of bankAccountsData) {
    let existingBank = await BankAccount.findOne({ accountNumber: b.accountNumber, isDeleted: false });
    if (!existingBank) {
      existingBank = new BankAccount({
        ...b,
        createdBy: creatorId,
      });
      await existingBank.save();
      console.log(`  + Created bank account: ${b.bankName} (${b.accountNumber}) [Active: ${b.isActive}, Default: ${b.isDefault}]`);
    }
  }

  const primaryBank = bankAccountsData[0];

  // 6. Seed Sales Invoices for EVERY supported status
  console.log('\n5. Seeding Sales Invoices for EVERY Status...');
  const salesInvoicesData = [
    {
      code: 'INV-TEST-001',
      invoiceNumber: 'INV-TEST-001',
      partyId: clientDocs[0]._id,
      partyName: clientDocs[0].companyName || clientDocs[0].clientName || 'Tata Motors Ltd',
      billingAddress: 'Bombay House, 24 Homi Mody Street, Fort, Mumbai 400001',
      shippingAddress: 'Western Express Highway Gantry, Andheri, Mumbai',
      gstin: '27AAACT2727Q1ZW',
      placeOfSupply: '27-Maharashtra',
      contactPerson: 'Vikramaditya Rao',
      contactMobile: '9820011223',
      contactEmail: 'ooh.procurement@tatamotors.test',
      campaignId: testCampaign._id,
      invoiceDate: new Date('2026-10-01'),
      dueDate: new Date('2026-10-31'),
      items: [
        {
          name: 'Western Express Highway Billboard (100x20 ft)',
          description: 'Illuminated LED front-lit hoarding display for 30 days',
          hsn: '998361',
          quantity: 1,
          unit: 'Month',
          rate: 10000000, // ₹1,00,000
          taxPercent: 18,
          taxAmount: 1800000, // ₹18,000
          amount: 11800000, // ₹1,18,000
        },
      ],
      subtotal: 10000000,
      taxableAmount: 10000000,
      taxAmount: 1800000,
      discountAmount: 0,
      roundOff: 0,
      totalAmount: 11800000,
      paidAmount: 0,
      balanceAmount: 11800000,
      status: 'Draft' as const,
      notes: 'TEST - Status: Draft Sales Tax Invoice awaiting internal review.',
    },
    {
      code: 'INV-TEST-002',
      invoiceNumber: 'INV-TEST-002',
      partyId: clientDocs[1]._id,
      partyName: clientDocs[1].companyName || clientDocs[1].clientName || 'Reliance Retail',
      billingAddress: 'Maker Chambers IV, Nariman Point, Mumbai 400021',
      shippingAddress: 'Bandra Reclamation Premium Unipole, Mumbai',
      gstin: '27AABCR1234F1Z8',
      placeOfSupply: '27-Maharashtra',
      contactPerson: 'Pooja Singhania',
      contactMobile: '9820022334',
      contactEmail: 'media.buying@relianceretail.test',
      campaignId: testCampaign._id,
      invoiceDate: new Date('2026-09-25'),
      dueDate: new Date('2026-10-25'),
      items: [
        {
          name: 'Bandra Reclamation Premium Unipole (60x30 ft)',
          description: 'High-impact sea-facing digital unipole display',
          hsn: '998361',
          quantity: 1,
          unit: 'Month',
          rate: 20000000, // ₹2,00,000
          taxPercent: 18,
          taxAmount: 3600000, // ₹36,000
          amount: 23600000, // ₹2,36,000
        },
      ],
      subtotal: 20000000,
      taxableAmount: 20000000,
      taxAmount: 3600000,
      discountAmount: 0,
      roundOff: 0,
      totalAmount: 23600000,
      paidAmount: 0,
      balanceAmount: 23600000,
      status: 'Sent' as const,
      notes: 'TEST - Status: Sent Sales Tax Invoice delivered to client.',
    },
    {
      code: 'INV-TEST-003',
      invoiceNumber: 'INV-TEST-003',
      partyId: clientDocs[0]._id,
      partyName: clientDocs[0].companyName || clientDocs[0].clientName || 'Tata Motors Ltd',
      billingAddress: 'Bombay House, 24 Homi Mody Street, Fort, Mumbai 400001',
      shippingAddress: 'Eastern Freeway Double Sided Gantry, Mumbai',
      gstin: '27AAACT2727Q1ZW',
      placeOfSupply: '27-Maharashtra',
      contactPerson: 'Vikramaditya Rao',
      contactMobile: '9820011223',
      contactEmail: 'ooh.procurement@tatamotors.test',
      campaignId: testCampaign._id,
      invoiceDate: new Date('2026-09-15'),
      dueDate: new Date('2026-10-15'),
      items: [
        {
          name: 'Eastern Freeway Double Sided Gantry (80x25 ft)',
          description: 'Dual directional expressway gantry display',
          hsn: '998361',
          quantity: 1,
          unit: 'Month',
          rate: 30000000, // ₹3,00,000
          taxPercent: 18,
          taxAmount: 5400000, // ₹54,000
          amount: 35400000, // ₹3,54,000
        },
      ],
      subtotal: 30000000,
      taxableAmount: 30000000,
      taxAmount: 5400000,
      discountAmount: 0,
      roundOff: 0,
      totalAmount: 35400000,
      amountReceived: 15000000, // ₹1,50,000 received
      balanceAmount: 20400000, // ₹2,04,000 pending
      status: 'Partially Paid' as const,
      notes: 'TEST - Status: Partially Paid Invoice with active client payments.',
    },
    {
      code: 'INV-TEST-004',
      invoiceNumber: 'INV-TEST-004',
      partyId: clientDocs[2]._id,
      partyName: clientDocs[2].companyName || clientDocs[2].clientName || 'Titan Company',
      billingAddress: 'Titan Tower, Electronic City, Bengaluru 560100',
      shippingAddress: 'Koramangala 80 Feet Road Mall Facade, Bengaluru',
      gstin: '29AAACT3456D1Z2',
      placeOfSupply: '29-Karnataka',
      contactPerson: 'Adarsh Nambiar',
      contactMobile: '9820033445',
      contactEmail: 'brand.promotions@titan.test',
      campaignId: testCampaign._id,
      invoiceDate: new Date('2026-09-01'),
      dueDate: new Date('2026-09-30'),
      items: [
        {
          name: 'Koramangala Commercial Hub Mall Facade (50x30 ft)',
          description: 'Premium shopping district lit hoarding display',
          hsn: '998361',
          quantity: 1,
          unit: 'Month',
          rate: 15000000, // ₹1,50,000
          taxPercent: 18,
          taxAmount: 2700000, // ₹27,000
          amount: 17700000, // ₹1,77,000
        },
      ],
      subtotal: 15000000,
      taxableAmount: 15000000,
      taxAmount: 2700000,
      discountAmount: 0,
      roundOff: 0,
      totalAmount: 17700000,
      amountReceived: 17700000, // ₹1,77,000 received
      balanceAmount: 0,
      status: 'Paid' as const,
      notes: 'TEST - Status: Fully Paid Invoice settled in full.',
    },
    {
      code: 'INV-TEST-005',
      invoiceNumber: 'INV-TEST-005',
      partyId: clientDocs[1]._id,
      partyName: clientDocs[1].companyName || clientDocs[1].clientName || 'Reliance Retail',
      billingAddress: 'Maker Chambers IV, Nariman Point, Mumbai 400021',
      shippingAddress: 'Marine Drive Queen Necklace Unipole, Mumbai',
      gstin: '27AABCR1234F1Z8',
      placeOfSupply: '27-Maharashtra',
      contactPerson: 'Pooja Singhania',
      contactMobile: '9820022334',
      contactEmail: 'media.buying@relianceretail.test',
      campaignId: testCampaign._id,
      invoiceDate: new Date('2026-08-01'),
      dueDate: new Date('2026-08-31'), // Past due date
      items: [
        {
          name: 'Marine Drive Promontory Unipole (40x20 ft)',
          description: 'Iconic beachfront backlit display unit',
          hsn: '998361',
          quantity: 1,
          unit: 'Month',
          rate: 35000000, // ₹3,50,000
          taxPercent: 18,
          taxAmount: 6300000, // ₹63,000
          amount: 41300000, // ₹4,13,000
        },
      ],
      subtotal: 35000000,
      taxableAmount: 35000000,
      taxAmount: 6300000,
      discountAmount: 0,
      roundOff: 0,
      totalAmount: 41300000,
      amountReceived: 0,
      balanceAmount: 41300000,
      status: 'Overdue' as const,
      notes: 'TEST - Status: Overdue Invoice exceeding 30-day payment terms.',
    },
    {
      code: 'INV-TEST-006',
      invoiceNumber: 'INV-TEST-006',
      partyId: clientDocs[0]._id,
      partyName: clientDocs[0].companyName || clientDocs[0].clientName || 'Tata Motors Ltd',
      billingAddress: 'Bombay House, 24 Homi Mody Street, Fort, Mumbai 400001',
      shippingAddress: 'Worli Sea Face Directional Arch, Mumbai',
      gstin: '27AAACT2727Q1ZW',
      placeOfSupply: '27-Maharashtra',
      contactPerson: 'Vikramaditya Rao',
      contactMobile: '9820011223',
      contactEmail: 'ooh.procurement@tatamotors.test',
      campaignId: testCampaign._id,
      invoiceDate: new Date('2026-09-10'),
      dueDate: new Date('2026-10-10'),
      items: [
        {
          name: 'Worli Sea Face Directional Arch (30x15 ft)',
          description: 'Traffic intersection directional billboard',
          hsn: '998361',
          quantity: 1,
          unit: 'Month',
          rate: 5000000, // ₹50,000
          taxPercent: 18,
          taxAmount: 900000, // ₹9,000
          amount: 5900000, // ₹59,000
        },
      ],
      subtotal: 5000000,
      taxableAmount: 5000000,
      taxAmount: 900000,
      discountAmount: 0,
      roundOff: 0,
      totalAmount: 5900000,
      amountReceived: 0,
      balanceAmount: 5900000,
      status: 'Cancelled' as const,
      notes: 'TEST - Status: Cancelled Invoice voided due to site re-allocation.',
    },
  ];

  const salesInvoiceDocs: any[] = [];
  for (const inv of salesInvoicesData) {
    let doc = await Invoice.findOne({ invoiceNumber: inv.invoiceNumber });
    if (!doc) {
      doc = new Invoice({
        ...inv,
        type: 'sales_invoice',
        invoicePrefix: 'INV-2026',
        bankDetails: {
          bankName: primaryBank.bankName,
          accountHolderName: primaryBank.accountHolderName,
          accountNumber: primaryBank.accountNumber,
          ifsc: primaryBank.ifsc,
          branch: primaryBank.branch,
        },
        termsAndConditions: '1. Payment due strictly within 30 days.\n2. 18% p.a. interest chargeable on overdue amounts.\n3. Subject to Mumbai Jurisdiction.',
        authorizedSignatory: 'Finance Controller, Media Octus Pvt Ltd',
        createdBy: creatorId,
      });
      await doc.save();
      console.log(`  + Created Sales Invoice: ${inv.invoiceNumber} [Status: ${inv.status}, Total: ₹${inv.totalAmount / 100}]`);
    } else {
      doc.amountReceived = inv.amountReceived ?? 0;
      doc.balanceAmount = inv.balanceAmount ?? inv.totalAmount;
      doc.status = inv.status;
      await doc.save();
    }
    salesInvoiceDocs.push(doc);
  }

  // 7. Seed Proforma Invoices for EVERY supported status
  console.log('\n6. Seeding Proforma Invoices for EVERY Status...');
  const proformaInvoicesData = [
    {
      code: 'PI-TEST-001',
      invoiceNumber: 'PI-TEST-001',
      partyId: clientDocs[1]._id,
      partyName: clientDocs[1].companyName || clientDocs[1].clientName || 'Reliance Retail',
      billingAddress: 'Maker Chambers IV, Nariman Point, Mumbai 400021',
      shippingAddress: 'Navi Mumbai Palm Beach Road Gantry',
      gstin: '27AABCR1234F1Z8',
      placeOfSupply: '27-Maharashtra',
      contactPerson: 'Pooja Singhania',
      contactMobile: '9820022334',
      contactEmail: 'media.buying@relianceretail.test',
      campaignId: testCampaign._id,
      invoiceDate: new Date('2026-10-02'),
      dueDate: new Date('2026-10-16'),
      items: [
        {
          name: 'Palm Beach Road Mega Gantry Display (120x30 ft)',
          description: 'Estimated quotation for Q4 Mega Festival Campaign',
          hsn: '998361',
          quantity: 1,
          unit: 'Month',
          rate: 15000000, // ₹1,50,000
          taxPercent: 18,
          taxAmount: 2700000,
          amount: 17700000,
        },
      ],
      subtotal: 15000000,
      taxableAmount: 15000000,
      taxAmount: 2700000,
      discountAmount: 0,
      roundOff: 0,
      totalAmount: 17700000,
      paidAmount: 0,
      balanceAmount: 17700000,
      status: 'Draft' as const,
      notes: 'TEST - Status: Draft Proforma Invoice prepared for client commercial approval.',
    },
    {
      code: 'PI-TEST-002',
      invoiceNumber: 'PI-TEST-002',
      partyId: clientDocs[0]._id,
      partyName: clientDocs[0].companyName || clientDocs[0].clientName || 'Tata Motors Ltd',
      billingAddress: 'Bombay House, 24 Homi Mody Street, Fort, Mumbai 400001',
      shippingAddress: 'Chhatrapati Shivaji Maharaj Airport T2 Departure Unipole',
      gstin: '27AAACT2727Q1ZW',
      placeOfSupply: '27-Maharashtra',
      contactPerson: 'Vikramaditya Rao',
      contactMobile: '9820011223',
      contactEmail: 'ooh.procurement@tatamotors.test',
      campaignId: testCampaign._id,
      invoiceDate: new Date('2026-09-28'),
      dueDate: new Date('2026-10-12'),
      items: [
        {
          name: 'Airport T2 Departure Overhead Unipole (50x25 ft)',
          description: 'High net-worth passenger route branding proforma',
          hsn: '998361',
          quantity: 1,
          unit: 'Month',
          rate: 25000000, // ₹2,50,000
          taxPercent: 18,
          taxAmount: 4500000,
          amount: 29500000,
        },
      ],
      subtotal: 25000000,
      taxableAmount: 25000000,
      taxAmount: 4500000,
      discountAmount: 0,
      roundOff: 0,
      totalAmount: 29500000,
      paidAmount: 0,
      balanceAmount: 29500000,
      status: 'Sent' as const,
      notes: 'TEST - Status: Sent Proforma Invoice shared with client finance team.',
    },
    {
      code: 'PI-TEST-003',
      invoiceNumber: 'PI-TEST-003',
      partyId: clientDocs[2]._id,
      partyName: clientDocs[2].companyName || clientDocs[2].clientName || 'Titan Company',
      billingAddress: 'Titan Tower, Electronic City, Bengaluru 560100',
      shippingAddress: 'MG Road Metro Station Pillar Branding, Bengaluru',
      gstin: '29AAACT3456D1Z2',
      placeOfSupply: '29-Karnataka',
      contactPerson: 'Adarsh Nambiar',
      contactMobile: '9820033445',
      contactEmail: 'brand.promotions@titan.test',
      campaignId: testCampaign._id,
      invoiceDate: new Date('2026-09-10'),
      dueDate: new Date('2026-09-24'),
      items: [
        {
          name: 'MG Road Metro Station Pillars (6 units)',
          description: 'Transit corridor station pillars estimation',
          hsn: '998361',
          quantity: 6,
          unit: 'Units',
          rate: 1000000, // ₹10,000 each = ₹60,000
          taxPercent: 18,
          taxAmount: 1080000,
          amount: 7080000,
        },
      ],
      subtotal: 6000000,
      taxableAmount: 6000000,
      taxAmount: 1080000,
      discountAmount: 0,
      roundOff: 0,
      totalAmount: 7080000,
      paidAmount: 0,
      balanceAmount: 7080000,
      status: 'Cancelled' as const,
      notes: 'TEST - Status: Cancelled Proforma Invoice superseded by revised schedule.',
    },
  ];

  for (const pi of proformaInvoicesData) {
    let doc = await Invoice.findOne({ invoiceNumber: pi.invoiceNumber });
    if (!doc) {
      doc = new Invoice({
        ...pi,
        type: 'proforma',
        invoicePrefix: 'PI-2026',
        bankDetails: {
          bankName: primaryBank.bankName,
          accountHolderName: primaryBank.accountHolderName,
          accountNumber: primaryBank.accountNumber,
          ifsc: primaryBank.ifsc,
          branch: primaryBank.branch,
        },
        termsAndConditions: '1. This is a commercial proforma estimate.\n2. Formal Tax Invoice issued upon booking confirmation.',
        authorizedSignatory: 'Commercial Lead, Media Octus Pvt Ltd',
        createdBy: creatorId,
      });
      await doc.save();
      console.log(`  + Created Proforma Invoice: ${pi.invoiceNumber} [Status: ${pi.status}, Total: ₹${pi.totalAmount / 100}]`);
    }
  }

  // 8. Seed Client Payments (Payment In) across all payment methods & reconciliation statuses
  console.log('\n7. Seeding Client Payments (Payment In)...');
  const paymentsInData = [
    {
      campaignId: testCampaign._id,
      clientId: clientDocs[0]._id,
      invoiceId: salesInvoiceDocs[2]._id, // INV-TEST-003 Partially Paid
      amount: 15000000, // ₹1,50,000
      receivedAt: new Date('2026-09-20'),
      method: 'bank_transfer' as const,
      transactionId: 'NEFT-HDFC-99881122',
      notes: 'TEST - Part payment 1 for invoice INV-TEST-003 via RTGS/NEFT.',
      reconciled: true,
      reconciledAt: new Date('2026-09-21'),
      reconciledBy: creatorId,
    },
    {
      campaignId: testCampaign._id,
      clientId: clientDocs[2]._id,
      invoiceId: salesInvoiceDocs[3]._id, // INV-TEST-004 Paid
      amount: 17700000, // ₹1,77,000
      receivedAt: new Date('2026-09-18'),
      method: 'cheque' as const,
      transactionId: 'CHQ-882201',
      notes: 'TEST - Full invoice settlement cheque cleared in HDFC Corporate account.',
      reconciled: true,
      reconciledAt: new Date('2026-09-19'),
      reconciledBy: creatorId,
    },
    {
      campaignId: testCampaign._id,
      clientId: clientDocs[1]._id,
      invoiceId: null,
      amount: 5000000, // ₹50,000
      receivedAt: new Date('2026-10-02'),
      method: 'upi' as const,
      transactionId: 'UPI-RAZOR-334411',
      notes: 'TEST - Advance booking token received via corporate UPI QR.',
      reconciled: false,
    },
    {
      campaignId: testCampaign._id,
      clientId: clientDocs[0]._id,
      invoiceId: null,
      amount: 2500000, // ₹25,000
      receivedAt: new Date('2026-10-03'),
      method: 'credit_card' as const,
      transactionId: 'POS-TXN-771122',
      notes: 'TEST - Site lighting expedited utility surcharge paid via corporate card.',
      reconciled: false,
    },
    {
      campaignId: testCampaign._id,
      clientId: clientDocs[2]._id,
      invoiceId: null,
      amount: 1000000, // ₹10,000
      receivedAt: new Date('2026-10-04'),
      method: 'cash' as const,
      transactionId: 'CASH-REC-0091',
      notes: 'TEST - Local site inspection fee deposited into petty cash register.',
      reconciled: false,
    },
  ];

  for (const p of paymentsInData) {
    let existing = await PaymentIn.findOne({ transactionId: p.transactionId });
    if (!existing) {
      existing = new PaymentIn({
        ...p,
        recordedBy: creatorId,
        recordedAt: p.receivedAt,
      });
      await existing.save();
      console.log(`  + Created PaymentIn: ₹${p.amount / 100} [Method: ${p.method}, Reconciled: ${p.reconciled}, Txn: ${p.transactionId}]`);
    }
  }

  // 9. Seed Vendor Payments (Payment Out) across all categories, methods & reconciliation statuses
  console.log('\n8. Seeding Vendor Payments (Payment Out)...');
  const paymentsOutData = [
    {
      campaignId: testCampaign._id,
      vendorId: vendorDocs[0]._id, // Apex Hoardings
      amount: 8000000, // ₹80,000
      paidAt: new Date('2026-09-22'),
      method: 'bank_transfer' as const,
      category: 'media_cost' as const,
      transactionId: 'NEFT-OUT-110022',
      vendorInvoice: 'V-APEX-901',
      notes: 'TEST - Structure rental and site rights for Western Express Highway billboard.',
      reconciled: true,
      reconciledAt: new Date('2026-09-23'),
      reconciledBy: creatorId,
    },
    {
      campaignId: testCampaign._id,
      vendorId: vendorDocs[1]._id, // Zenith Print
      amount: 3500000, // ₹35,000
      paidAt: new Date('2026-09-26'),
      method: 'cheque' as const,
      category: 'production_cost' as const,
      transactionId: 'CHQ-OUT-445501',
      vendorInvoice: 'V-ZEN-402',
      notes: 'TEST - Large format UV star vinyl flex printing and eyeleting charges.',
      reconciled: false,
    },
    {
      campaignId: testCampaign._id,
      vendorId: vendorDocs[0]._id,
      amount: 1500000, // ₹15,000
      paidAt: new Date('2026-09-29'),
      method: 'upi' as const,
      category: 'logistics' as const,
      transactionId: 'UPI-OUT-889901',
      vendorInvoice: 'V-MOUNT-11',
      notes: 'TEST - Crane hoist and mounting team night installation charges.',
      reconciled: true,
      reconciledAt: new Date('2026-09-30'),
      reconciledBy: creatorId,
    },
    {
      campaignId: testCampaign._id,
      vendorId: vendorDocs[1]._id,
      amount: 500000, // ₹5,000
      paidAt: new Date('2026-10-02'),
      method: 'cash' as const,
      category: 'other' as const,
      transactionId: 'CASH-OUT-0021',
      vendorInvoice: 'V-MNC-33',
      notes: 'TEST - Local municipal electricity meter inspection & connection charge.',
      reconciled: false,
    },
  ];

  for (const p of paymentsOutData) {
    let existing = await PaymentOut.findOne({ transactionId: p.transactionId });
    if (!existing) {
      existing = new PaymentOut({
        ...p,
        recordedBy: creatorId,
        recordedAt: p.paidAt,
      });
      await existing.save();
      console.log(`  + Created PaymentOut: ₹${p.amount / 100} [Category: ${p.category}, Method: ${p.method}, Reconciled: ${p.reconciled}]`);
    }
  }

  // 10. Update Campaign Finance summary rollups
  console.log('\n9. Updating Campaign Finance rollups...');
  let campFinance = await CampaignFinance.findOne({ campaignId: testCampaign._id });
  const totalIn = paymentsInData.reduce((sum, p) => sum + p.amount, 0); // ₹4,12,000
  const totalOut = paymentsOutData.reduce((sum, p) => sum + p.amount, 0); // ₹1,35,000
  const contractedVal = testCampaign.contractedValue; // ₹12,50,000

  if (!campFinance) {
    campFinance = new CampaignFinance({
      campaignId: testCampaign._id,
      contractedValue: contractedVal,
      revenue: totalIn,
      expenses: totalOut,
      profit: totalIn - totalOut,
      margin: totalIn > 0 ? ((totalIn - totalOut) / totalIn) * 100 : 0,
      calculatedAt: new Date(),
    });
  } else {
    campFinance.revenue = totalIn;
    campFinance.expenses = totalOut;
    campFinance.profit = totalIn - totalOut;
    campFinance.margin = totalIn > 0 ? ((totalIn - totalOut) / totalIn) * 100 : 0;
    campFinance.calculatedAt = new Date();
  }
  await campFinance.save();
  console.log(`  + Campaign Finance updated: Total In: ₹${totalIn / 100}, Total Out: ₹${totalOut / 100}, Net Margin: ₹${(totalIn - totalOut) / 100}`);

  console.log('\n========================================');
  console.log('✅ Finance Status Test Data Seed Complete!');
  console.log('========================================\n');
}

// Standalone execution runner
if (process.argv[1]?.endsWith('seedFinanceTestData.ts') || process.argv[1]?.endsWith('seedFinanceTestData.js')) {
  (async () => {
    try {
      await connectDatabase();
      await seedFinanceValidationData();
      await disconnectDatabase();
      process.exit(0);
    } catch (err) {
      console.error('[seedFinanceTestData] Failed:', err);
      process.exit(1);
    }
  })();
}
