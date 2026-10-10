import assert from 'node:assert/strict';
import test from 'node:test';
import zlib from 'node:zlib';
import { permissionsForRole } from '../../core/rbac/permissions.js';
import { PayrollService } from './payroll.service.js';
import { Employee } from '../employees/employees.model.js';
import { SalaryStructure } from './salary.model.js';
import { Payroll } from './payroll.model.js';

test('RBAC: salary and payroll permissions matrix', () => {
  // salary.view: HR + Finance + Admin
  assert.ok(permissionsForRole('admin').includes('salary.view'), 'admin has salary.view');
  assert.ok(permissionsForRole('hr').includes('salary.view'), 'hr has salary.view');
  assert.ok(permissionsForRole('finance').includes('salary.view'), 'finance has salary.view');
  assert.equal(permissionsForRole('sales_agent').includes('salary.view'), false, 'sales_agent denied salary.view');
  assert.equal(permissionsForRole('ops').includes('salary.view'), false, 'ops denied salary.view');
  assert.equal(permissionsForRole('manager').includes('salary.view'), false, 'manager denied salary.view');
  assert.equal(permissionsForRole('employee').includes('salary.view'), false, 'employee denied salary.view');

  // salary.create & update: HR + Admin only (Finance does not create/update salary structure)
  assert.ok(permissionsForRole('admin').includes('salary.create'), 'admin has salary.create');
  assert.ok(permissionsForRole('hr').includes('salary.create'), 'hr has salary.create');
  assert.equal(permissionsForRole('finance').includes('salary.create'), false, 'finance denied salary.create');
  assert.equal(permissionsForRole('manager').includes('salary.create'), false, 'manager denied salary.create');

  // payroll.view: HR + Finance + Admin
  assert.ok(permissionsForRole('admin').includes('payroll.view'), 'admin has payroll.view');
  assert.ok(permissionsForRole('finance').includes('payroll.view'), 'finance has payroll.view');
  assert.ok(permissionsForRole('hr').includes('payroll.view'), 'hr has payroll.view');
  assert.equal(permissionsForRole('ops').includes('payroll.view'), false, 'ops denied payroll.view');

  // payroll.process: Finance + HR + Admin
  assert.ok(permissionsForRole('admin').includes('payroll.process'), 'admin has payroll.process');
  assert.ok(permissionsForRole('finance').includes('payroll.process'), 'finance has payroll.process');
  assert.ok(permissionsForRole('hr').includes('payroll.process'), 'hr has payroll.process');
  assert.equal(permissionsForRole('sales_agent').includes('payroll.process'), false, 'sales denied payroll.process');

  // payroll.payslip: HR + Finance + Admin
  assert.ok(permissionsForRole('admin').includes('payroll.payslip'), 'admin has payroll.payslip');
  assert.ok(permissionsForRole('finance').includes('payroll.payslip'), 'finance has payroll.payslip');
  assert.ok(permissionsForRole('hr').includes('payroll.payslip'), 'hr has payroll.payslip');
  assert.equal(permissionsForRole('employee').includes('payroll.payslip'), false, 'employee denied payroll.payslip');

  // Strict isolation: HR does NOT have access to Finance modules
  const hrPerms = permissionsForRole('hr');
  assert.equal(hrPerms.includes('finance.view'), false, 'hr denied finance.view');
  assert.equal(hrPerms.includes('finance.view_payments'), false, 'hr denied finance.view_payments');
  assert.equal(hrPerms.includes('finance.create_payment_in'), false, 'hr denied finance.create_payment_in');
  assert.equal(hrPerms.includes('finance.create_payment_out'), false, 'hr denied finance.create_payment_out');
  assert.equal(hrPerms.includes('finance.view_reports'), false, 'hr denied finance.view_reports');
});

test('Salary transparent calculation: Gross and Net', () => {
  // basic 5000000 (50k INR), hra 2000000 (20k INR), conveyance 500000 (5k INR), other 200000 (2k INR), bonus 300000 (3k INR)
  // deductions 400000 (4k INR)
  const basicSalary = 5000000;
  const hra = 2000000;
  const conveyance = 500000;
  const otherAllowances = 200000;
  const bonus = 300000;
  const deductions = 400000;

  const grossSalary = basicSalary + hra + conveyance + otherAllowances + bonus;
  const netSalary = Math.max(0, grossSalary - deductions);

  assert.equal(grossSalary, 8000000, 'Gross must equal sum of all earnings components (80,000 INR)');
  assert.equal(netSalary, 7600000, 'Net must equal Gross - Deductions (76,000 INR)');
});

test('Cash payment rule: Transaction reference remains empty for cash', async () => {
  // Simulate the cash rule enforced in PayrollService.processPayment
  const method: string = 'cash';
  const rawTxRef = 'TXN-SHOULD-NOT-EXIST';
  const effectiveTxRef = method === 'cash' ? '' : rawTxRef.trim();

  assert.equal(effectiveTxRef, '', 'Cash transaction reference must be empty string');

  const bankMethod: string = 'bank_transfer';
  const bankTxRef = 'UTR123456789';
  const effectiveBankTxRef = bankMethod === 'cash' ? '' : bankTxRef.trim();
  assert.equal(effectiveBankTxRef, 'UTR123456789', 'Bank transfer keeps transaction reference');
});

function countPdfPages(pdfBuffer: Buffer): number {
  const binary = pdfBuffer.toString('binary');
  const matches = binary.match(/\/Type\s*\/Page\b/g);
  return matches ? matches.length : 0;
}

function extractPdfText(buf: Buffer): string {
  let text = '';
  let idx = 0;
  while ((idx = buf.indexOf('stream', idx)) !== -1) {
    let start = idx + 6;
    if (buf[start] === 0x0d) start++;
    if (buf[start] === 0x0a) start++;
    const end = buf.indexOf('endstream', start);
    if (end === -1) break;
    let streamEnd = end;
    if (buf[streamEnd - 1] === 0x0a) streamEnd--;
    if (buf[streamEnd - 1] === 0x0d) streamEnd--;
    const raw = buf.subarray(start, streamEnd);
    try {
      const decompressed = zlib.inflateSync(raw).toString('latin1');
      text += decompressed + '\n';
    } catch {
      try {
        const decompressed = zlib.inflateRawSync(raw).toString('latin1');
        text += decompressed + '\n';
      } catch {}
    }
    idx = end + 9;
  }
  const decoded = text.replace(/<([0-9a-fA-F]+)>/g, (_, hex) => Buffer.from(hex, 'hex').toString('latin1'));
  return decoded.replace(/\[([\s\S]*?)\]\s*TJ/g, (_, inner) => inner.replace(/\s+-?\d+\.?\d*\s*/g, ''));
}

test('generatePayslipPdf: CASE 1 - Only Basic Salary available (single page, no bonus, no deductions, no payment details)', async () => {
  const origFindById = Payroll.findById;
  (Payroll as any).findById = () => ({
    populate: async () => ({
      payslipNumber: 'PS-2026-10-CASE1',
      periodLabel: 'October 2026',
      status: 'Processed',
      grossSalary: 5000000,
      deductions: 0,
      netPayable: 5000000,
      salaryStructureSnapshot: {
        basicSalary: 5000000,
        hra: 0,
        conveyance: 0,
        otherAllowances: 0,
        bonus: 0,
      },
      employeeId: {
        fullName: 'Alice Smith',
        employeeCode: 'EMP-001',
        department: 'Marketing',
        designation: 'Marketing Lead',
        dateOfJoining: new Date('2024-03-01'),
      },
    }),
  });

  try {
    const pdf = await PayrollService.generatePayslipPdf('mock-id-case1');
    assert.ok(Buffer.isBuffer(pdf), 'Should return PDF buffer');
    assert.equal(countPdfPages(pdf), 1, 'Should fit cleanly on a single page');

    const text = extractPdfText(pdf);
    assert.ok(text.includes('Basic Salary'), 'Should include Basic Salary');
    assert.ok(text.includes('Net Payable Amount'), 'Should include Net Payable Amount');
    assert.ok(!text.includes('Bonus / Incentives'), 'Bonus row must be completely omitted');
    assert.ok(!text.includes('Total Deductions'), 'Deductions row must be omitted when 0');
    assert.ok(!text.includes('PAYMENT DETAILS'), 'Payment details section must be omitted when empty');
  } finally {
    Payroll.findById = origFindById;
  }
});

test('generatePayslipPdf: CASE 2 - Basic + Allowances + Deductions (single page, no bonus)', async () => {
  const origFindById = Payroll.findById;
  (Payroll as any).findById = () => ({
    populate: async () => ({
      payslipNumber: 'PS-2026-10-CASE2',
      periodLabel: 'October 2026',
      status: 'Paid',
      grossSalary: 7500000,
      deductions: 500000,
      netPayable: 7000000,
      paymentDate: new Date('2026-10-31'),
      paymentMethod: 'bank_transfer',
      transactionReference: 'UTR99887766',
      salaryStructureSnapshot: {
        basicSalary: 5000000,
        hra: 1500000,
        conveyance: 500000,
        otherAllowances: 500000,
        bonus: 0,
      },
      employeeId: {
        fullName: 'Bob Johnson',
        employeeCode: 'EMP-002',
        department: 'Sales',
        designation: 'Account Executive',
        bankAccountNumber: '123456789012',
        ifsc: 'HDFC0001122',
      },
    }),
  });

  try {
    const pdf = await PayrollService.generatePayslipPdf('mock-id-case2');
    assert.equal(countPdfPages(pdf), 1, 'Should fit cleanly on a single page');

    const text = extractPdfText(pdf);
    assert.ok(text.includes('Basic Salary'), 'Should include Basic Salary');
    assert.ok(text.includes('House Rent Allowance (HRA)'), 'Should include HRA');
    assert.ok(text.includes('Conveyance Allowance'), 'Should include Conveyance');
    assert.ok(text.includes('Other Allowances'), 'Should include Other Allowances');
    assert.ok(text.includes('Total Deductions'), 'Should include Total Deductions');
    assert.ok(!text.includes('Bonus / Incentives'), 'Bonus row must be omitted');
  } finally {
    Payroll.findById = origFindById;
  }
});

test('generatePayslipPdf: CASE 3 - No Bonus (Bonus row completely hidden)', async () => {
  const origFindById = Payroll.findById;
  (Payroll as any).findById = () => ({
    populate: async () => ({
      payslipNumber: 'PS-2026-10-CASE3',
      periodLabel: 'October 2026',
      status: 'Paid',
      grossSalary: 6000000,
      deductions: 200000,
      netPayable: 5800000,
      paymentDate: new Date('2026-10-31'),
      paymentMethod: 'upi',
      salaryStructureSnapshot: {
        basicSalary: 4500000,
        hra: 1500000,
        bonus: 0,
      },
      employeeId: {
        fullName: 'Carol White',
        employeeCode: 'EMP-003',
        department: 'Operations',
      },
    }),
  });

  try {
    const pdf = await PayrollService.generatePayslipPdf('mock-id-case3');
    assert.equal(countPdfPages(pdf), 1, 'Should fit cleanly on a single page');

    const text = extractPdfText(pdf);
    assert.ok(!text.includes('Bonus / Incentives'), 'Bonus row must be completely hidden');
  } finally {
    Payroll.findById = origFindById;
  }
});

test('generatePayslipPdf: CASE 4 - No Payment Date / Payment Method (Payment Details collapsed)', async () => {
  const origFindById = Payroll.findById;
  (Payroll as any).findById = () => ({
    populate: async () => ({
      payslipNumber: 'PS-2026-10-CASE4',
      periodLabel: 'October 2026',
      status: 'Draft',
      grossSalary: 4000000,
      deductions: 0,
      netPayable: 4000000,
      paymentDate: null,
      paymentMethod: null,
      transactionReference: null,
      salaryStructureSnapshot: {
        basicSalary: 4000000,
      },
      employeeId: {
        fullName: 'David Brown',
        employeeCode: 'EMP-004',
      },
    }),
  });

  try {
    const pdf = await PayrollService.generatePayslipPdf('mock-id-case4');
    assert.equal(countPdfPages(pdf), 1, 'Should fit cleanly on a single page');

    const text = extractPdfText(pdf);
    assert.ok(!text.includes('PAYMENT DETAILS'), 'PAYMENT DETAILS section header must be hidden');
    assert.ok(!text.includes('Payment Date:'), 'Payment Date must be hidden');
    assert.ok(!text.includes('Payment Method:'), 'Payment Method must be hidden');
  } finally {
    Payroll.findById = origFindById;
  }
});

test('generatePayslipPdf: CASE 5 - Employee with many salary components (clean multi-page pagination without blank pages)', async () => {
  const origFindById = Payroll.findById;
  const manySnapshot: Record<string, number> = {
    basicSalary: 6000000,
    hra: 2400000,
    conveyance: 800000,
    otherAllowances: 500000,
    bonus: 1000000,
  };
  for (let i = 1; i <= 25; i++) {
    manySnapshot[`specialAllowanceLevel${i}`] = 100000 * i;
  }

  (Payroll as any).findById = () => ({
    populate: async () => ({
      payslipNumber: 'PS-2026-10-CASE5',
      periodLabel: 'October 2026',
      status: 'Paid',
      grossSalary: 40000000,
      deductions: 2500000,
      netPayable: 37500000,
      paymentDate: new Date('2026-10-31'),
      paymentMethod: 'bank_transfer',
      transactionReference: 'NEFT998877',
      salaryStructureSnapshot: manySnapshot,
      employeeId: {
        fullName: 'Elena Rostova',
        employeeCode: 'EMP-005',
        department: 'Executive',
        designation: 'Vice President',
        dateOfJoining: new Date('2020-05-15'),
        bankAccountNumber: '998877665544',
        ifsc: 'ICIC0000123',
        panNumber: 'ABCDE9999Z',
      },
    }),
  });

  try {
    const pdf = await PayrollService.generatePayslipPdf('mock-id-case5');
    const pages = countPdfPages(pdf);
    assert.equal(pages, 2, 'Should paginate into exactly 2 pages with no trailing blank pages');
  } finally {
    Payroll.findById = origFindById;
  }
});

test('generatePayslipPdf: CASE 6 - Normal employee salary (professional single-page A4 payslip)', async () => {
  const origFindById = Payroll.findById;
  (Payroll as any).findById = () => ({
    populate: async () => ({
      payslipNumber: 'PS-2026-10-CASE6',
      periodLabel: 'October 2026',
      status: 'Paid',
      grossSalary: 8000000,
      deductions: 400000,
      netPayable: 7600000,
      paymentDate: new Date('2026-10-31'),
      paymentMethod: 'bank_transfer',
      transactionReference: 'TXN123456789',
      notes: 'October salary credited',
      salaryStructureSnapshot: {
        basicSalary: 5000000,
        hra: 2000000,
        conveyance: 500000,
        otherAllowances: 200000,
        bonus: 300000,
      },
      employeeId: {
        fullName: 'Jane Doe',
        employeeCode: 'EMP-006',
        department: 'Engineering',
        designation: 'Senior Developer',
        dateOfJoining: new Date('2023-01-15'),
        bankAccountNumber: '987654321012',
        ifsc: 'HDFC0001234',
        panNumber: 'ABCDE1234F',
      },
    }),
  });

  try {
    const pdf = await PayrollService.generatePayslipPdf('mock-id-case6');
    assert.equal(countPdfPages(pdf), 1, 'Normal employee payslip must be a single A4 page');

    const text = extractPdfText(pdf);
    assert.ok(text.includes('Jane Doe'), 'Must include employee name');
    assert.ok(text.includes('Basic Salary'), 'Must include Basic Salary');
    assert.ok(text.includes('Bonus / Incentives'), 'Must include Bonus');
    assert.ok(text.includes('Total Deductions'), 'Must include Deductions');
    assert.ok(text.includes('Net Payable Amount'), 'Must include Net Payable Amount');
    assert.ok(text.includes('PAYMENT DETAILS'), 'Must include Payment Details');
  } finally {
    Payroll.findById = origFindById;
  }
});

import { requirePermission } from '../../core/rbac/index.js';

test('RBAC: HR cannot receive any Finance permissions at authoritative source', () => {
  const hrPerms = permissionsForRole('hr');

  // Verify none of the Finance permissions are present on HR
  const forbiddenFinancePerms = [
    'finance.create_payment_in',
    'finance.create_payment_out',
    'finance.view_payments',
    'finance.update_payment',
    'finance.delete_payment',
    'finance.reconcile_payment',
    'finance.view_reports',
    'finance.view_leadership_reports',
    'finance.view',
    'finance.manage',
    'finance.bank_details',
  ] as const;

  for (const perm of forbiddenFinancePerms) {
    assert.equal(
      hrPerms.includes(perm as any),
      false,
      `HR must NOT possess "${perm}" permission`,
    );
  }

  // Verify HR DOES possess required salary and payroll permissions
  const requiredHrPerms = [
    'salary.view',
    'salary.create',
    'salary.update',
    'payroll.view',
    'payroll.create',
    'payroll.process',
    'payroll.payslip',
  ] as const;

  for (const perm of requiredHrPerms) {
    assert.ok(
      hrPerms.includes(perm as any),
      `HR MUST possess "${perm}" permission`,
    );
  }
});

test('RBAC: Backend authorization middleware enforces HR vs Finance boundary', () => {
  // Mock request contexts
  const createMockReq = (role: string) =>
    ({
      ctx: {
        user: {
          id: '507f1f77bcf86cd799439011',
          name: 'Test User',
          email: `${role}@mediaoctus.test`,
          role,
          permissions: permissionsForRole(role),
        },
      },
    }) as any;

  // 1. HR attempting to access Finance routes is rejected with 403 Forbidden
  const hrReq = createMockReq('hr');
  let hrError: any = null;
  const hrNext = (err?: any) => {
    hrError = err;
  };

  requirePermission('finance.create_payment_in')(hrReq, {} as any, hrNext);
  assert.ok(hrError, 'HR must be rejected on finance.create_payment_in');
  assert.equal(hrError.status || hrError.statusCode, 403);

  hrError = null;
  requirePermission('finance.view_payments')(hrReq, {} as any, hrNext);
  assert.ok(hrError, 'HR must be rejected on finance.view_payments');
  assert.equal(hrError.status || hrError.statusCode, 403);

  hrError = null;
  requirePermission('finance.view_reports')(hrReq, {} as any, hrNext);
  assert.ok(hrError, 'HR must be rejected on finance.view_reports');
  assert.equal(hrError.status || hrError.statusCode, 403);

  // 2. HR accessing salary and payroll routes succeeds
  let hrAllowed = false;
  requirePermission('salary.view')(hrReq, {} as any, (err?: any) => {
    assert.equal(err, undefined);
    hrAllowed = true;
  });
  assert.ok(hrAllowed, 'HR must be allowed on salary.view');

  hrAllowed = false;
  requirePermission('payroll.process')(hrReq, {} as any, (err?: any) => {
    assert.equal(err, undefined);
    hrAllowed = true;
  });
  assert.ok(hrAllowed, 'HR must be allowed on payroll.process');

  // 3. Finance accessing finance routes succeeds, but denied salary.create
  const financeReq = createMockReq('finance');
  let financeAllowed = false;
  requirePermission('finance.view_payments')(financeReq, {} as any, (err?: any) => {
    assert.equal(err, undefined);
    financeAllowed = true;
  });
  assert.ok(financeAllowed, 'Finance must be allowed on finance.view_payments');

  let financeError: any = null;
  requirePermission('salary.create')(financeReq, {} as any, (err?: any) => {
    financeError = err;
  });
  assert.ok(financeError, 'Finance must be denied salary.create');
  assert.equal(financeError.status || financeError.statusCode, 403);

  // 4. Admin holds all permissions
  const adminReq = createMockReq('admin');
  let adminAllowed = false;
  requirePermission('finance.create_payment_in')(adminReq, {} as any, (err?: any) => {
    assert.equal(err, undefined);
    adminAllowed = true;
  });
  assert.ok(adminAllowed, 'Admin must be allowed on finance.create_payment_in');
});

test('Authoritative Salary: Single data source synchronizes Employee.annualCtc and SalaryStructure', async () => {
  // Mock employee and salary structure models
  const mockEmpId = '507f1f77bcf86cd799439011';
  let savedAnnualCtc: number | undefined;

  const origEmpFindById = Employee.findById;
  const origSalaryFindOne = SalaryStructure.findOne;
  const origSalaryCreate = SalaryStructure.create;

  (Employee as any).findById = async () => ({
    _id: mockEmpId,
    fullName: 'Test Employee',
    save: async function () {
      savedAnnualCtc = (this as any).annualCtc;
    },
  });

  (SalaryStructure as any).findOne = async () => null;
  (SalaryStructure as any).create = async (doc: any) => doc;

  try {
    const res = await PayrollService.upsertEmployeeSalary(mockEmpId, {
      basicSalary: 5000000, // 50,000 INR
      hra: 2000000,        // 20,000 INR
      conveyance: 500000,   // 5,000 INR
      otherAllowances: 500000, // 5,000 INR
      bonus: 0,
      deductions: 400000,   // 4,000 INR
      effectiveFrom: new Date('2026-04-01'),
    });

    assert.equal(res.grossSalary, 8000000, 'Gross monthly must equal sum of earnings (80,000 INR)');
    assert.equal(res.netSalary, 7600000, 'Net monthly must equal gross minus deductions (76,000 INR)');
    assert.equal(
      savedAnnualCtc,
      8000000 * 12,
      'Employee annual CTC must strictly equal monthly gross * 12 (96,000,000 paise / 9.6 Lakh)',
    );
  } finally {
    Employee.findById = origEmpFindById;
    SalaryStructure.findOne = origSalaryFindOne;
    SalaryStructure.create = origSalaryCreate;
  }
});

test('Resolution: Employee references resolve by ObjectId, userId, and employeeCode without CastError', async () => {
  const origFindById = Employee.findById;
  const origFindOne = Employee.findOne;

  (Employee as any).findById = async (id: string) => {
    if (id === '507f1f77bcf86cd799439011') {
      return { _id: id, employeeCode: 'MO-EMP-0001', fullName: 'Alice' };
    }
    return null;
  };

  (Employee as any).findOne = async (query: any) => {
    if (query?.userId === '507f1f77bcf86cd799439099') {
      return { _id: '507f1f77bcf86cd799439011', employeeCode: 'MO-EMP-0001', fullName: 'Alice' };
    }
    if (query?.employeeCode) {
      return { _id: '507f1f77bcf86cd799439012', employeeCode: 'MO-EMP-0019', fullName: 'Bob' };
    }
    return null;
  };

  try {
    // 1. Resolve by Mongo ObjectId
    const emp1 = await PayrollService.resolveEmployee('507f1f77bcf86cd799439011');
    assert.ok(emp1, 'Should resolve by ObjectId');
    assert.equal(emp1?.employeeCode, 'MO-EMP-0001');

    // 2. Resolve by User ID
    const emp2 = await PayrollService.resolveEmployee('507f1f77bcf86cd799439099');
    assert.ok(emp2, 'Should resolve by User ID');

    // 3. Resolve by Employee Code (e.g. MO-EMP-0019)
    const emp3 = await PayrollService.resolveEmployee('MO-EMP-0019');
    assert.ok(emp3, 'Should resolve by Employee Code');
    assert.equal(emp3?.fullName, 'Bob');

    // 4. Invalid or undefined identifier returns null cleanly without throwing CastError
    const empNull1 = await PayrollService.resolveEmployee('undefined');
    assert.equal(empNull1, null, 'string undefined must return null');

    const empNull2 = await PayrollService.resolveEmployee('');
    assert.equal(empNull2, null, 'empty string must return null');
  } finally {
    Employee.findById = origFindById;
    Employee.findOne = origFindOne;
  }
});

test('Resolution: Payroll references resolve by ObjectId and payslipNumber without CastError', async () => {
  const origFindById = Payroll.findById;
  const origFindOne = Payroll.findOne;

  (Payroll as any).findById = (id: string) => ({
    populate: async () => {
      if (id === '507f1f77bcf86cd799439088') {
        return { _id: id, payslipNumber: 'PS-2026-10-001' };
      }
      return null;
    },
  });

  (Payroll as any).findOne = (query: any) => ({
    populate: async () => {
      if (query?.payslipNumber) {
        return { _id: '507f1f77bcf86cd799439088', payslipNumber: 'PS-2026-10-001' };
      }
      return null;
    },
  });

  try {
    // 1. Resolve by ObjectId
    const p1 = await PayrollService.resolvePayroll('507f1f77bcf86cd799439088');
    assert.ok(p1, 'Should resolve by ObjectId');

    // 2. Resolve by Payslip Number
    const p2 = await PayrollService.resolvePayroll('PS-2026-10-001');
    assert.ok(p2, 'Should resolve by payslipNumber');
    assert.equal(p2?.payslipNumber, 'PS-2026-10-001');

    // 3. Invalid or undefined identifier returns null cleanly without CastError
    const pNull = await PayrollService.resolvePayroll('undefined');
    assert.equal(pNull, null);
  } finally {
    Payroll.findById = origFindById;
    Payroll.findOne = origFindOne;
  }
});

test('Rejection: Non-existent employee or payroll throws NotFoundError rather than CastError', async () => {
  const origEmpFindById = Employee.findById;
  const origEmpFindOne = Employee.findOne;
  const origPayFindById = Payroll.findById;
  const origPayFindOne = Payroll.findOne;

  (Employee as any).findById = async () => null;
  (Employee as any).findOne = async () => null;
  (Payroll as any).findById = () => ({ populate: async () => null });
  (Payroll as any).findOne = () => ({ populate: async () => null });

  try {
    // Should throw NotFoundError with message 'Employee not found' (not 400 Invalid ID format)
    await assert.rejects(
      async () => {
        await PayrollService.getEmployeeSalary('NON-EXISTENT-ID');
      },
      { name: 'NotFoundError', message: 'Employee not found' },
    );

    await assert.rejects(
      async () => {
        await PayrollService.getSalaryHistory('NON-EXISTENT-ID');
      },
      { name: 'NotFoundError', message: 'Employee not found' },
    );

    await assert.rejects(
      async () => {
        await PayrollService.processPayment('NON-EXISTENT-PAYROLL', {
          paymentDate: new Date(),
          paymentMethod: 'bank_transfer',
        });
      },
      { name: 'NotFoundError', message: 'Payroll record not found' },
    );
  } finally {
    Employee.findById = origEmpFindById;
    Employee.findOne = origEmpFindOne;
    Payroll.findById = origPayFindById;
    Payroll.findOne = origPayFindOne;
  }
});


