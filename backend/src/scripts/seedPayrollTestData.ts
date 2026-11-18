import { connectDatabase, disconnectDatabase } from '../core/db/connect.js';
import { Employee } from '../modules/employees/employees.model.js';
import { SalaryStructure } from '../modules/payroll/salary.model.js';
import { Payroll } from '../modules/payroll/payroll.model.js';
import { PayrollService } from '../modules/payroll/payroll.service.js';

async function seedPayroll() {
  console.log('--- Connecting to database ---');
  await connectDatabase();

  const employees = await Employee.find({ status: { $in: ['Active', 'On Notice'] } });
  console.log(`Found ${employees.length} active employees in Employee Master.`);

  if (employees.length === 0) {
    console.log('No employees found. Run `npm run seed` first.');
    await disconnectDatabase();
    return;
  }

  // 1. Configure realistic salary structures for employees
  const sampleSalaries = [
    { basic: 55000, hra: 22000, conv: 5000, other: 3000, bonus: 5000, ded: 3500 },
    { basic: 45000, hra: 18000, conv: 4000, other: 2000, bonus: 2000, ded: 2500 },
    { basic: 75000, hra: 30000, conv: 5000, other: 5000, bonus: 5000, ded: 5000 },
    { basic: 60000, hra: 24000, conv: 5000, other: 3000, bonus: 4000, ded: 4000 },
    { basic: 40000, hra: 16000, conv: 3000, other: 2000, bonus: 1000, ded: 2000 },
  ];

  let salaryConfiguredCount = 0;
  for (let i = 0; i < employees.length; i++) {
    const emp = employees[i];
    const s = sampleSalaries[i % sampleSalaries.length];

    const basicSalary = s.basic * 100; // in paise
    const hra = s.hra * 100;
    const conveyance = s.conv * 100;
    const otherAllowances = s.other * 100;
    const bonus = s.bonus * 100;
    const deductions = s.ded * 100;
    const grossSalary = basicSalary + hra + conveyance + otherAllowances + bonus;
    const netSalary = grossSalary - deductions;

    const existingSalary = await SalaryStructure.findOne({ employeeId: emp._id });
    if (!existingSalary) {
      await SalaryStructure.create({
        employeeId: emp._id,
        effectiveFrom: new Date('2026-04-01'),
        basicSalary,
        hra,
        conveyance,
        otherAllowances,
        bonus,
        grossSalary,
        deductions,
        netSalary,
        notes: 'Annual compensation package FY 2026-27',
        history: [],
      });
      salaryConfiguredCount++;
      console.log(`✓ Configured salary for ${emp.fullName} (${emp.employeeCode}): Net ₹${s.basic + s.hra + s.conv + s.other + s.bonus - s.ded}`);
    } else {
      console.log(`- Salary already configured for ${emp.fullName} (${emp.employeeCode})`);
    }
  }

  // 2. Generate payroll records for October 2026
  console.log('\n--- Generating Payroll for October 2026 ---');
  const genResult = await PayrollService.generatePayroll({
    salaryMonth: 10,
    salaryYear: 2026,
  });
  console.log(`Generated: ${genResult.generated}, Skipped (already exist): ${genResult.skipped}, Unconfigured: ${genResult.notConfigured}`);

  // 3. Mark sample payments as Paid with receipts
  const octPayrolls = await Payroll.find({ salaryMonth: 10, salaryYear: 2026 }).sort({ createdAt: 1 });

  if (octPayrolls.length > 0) {
    // Record 1: Bank Transfer
    if (octPayrolls[0] && octPayrolls[0].status === 'Pending') {
      octPayrolls[0].status = 'Paid';
      octPayrolls[0].paymentDate = new Date('2026-10-05');
      octPayrolls[0].paymentMethod = 'bank_transfer';
      octPayrolls[0].transactionReference = 'HDFC-NEFT-9082341829';
      octPayrolls[0].notes = 'Corporate salary transfer NEFT Batch #102';
      octPayrolls[0].paidAt = new Date('2026-10-05T10:30:00Z');
      await octPayrolls[0].save();
      console.log(`✓ Paid Record 1 (${octPayrolls[0].payslipNumber}): Bank Transfer with UTR`);
    }

    // Record 2: UPI
    if (octPayrolls[1] && octPayrolls[1].status === 'Pending') {
      octPayrolls[1].status = 'Paid';
      octPayrolls[1].paymentDate = new Date('2026-10-05');
      octPayrolls[1].paymentMethod = 'upi';
      octPayrolls[1].transactionReference = 'UPI/OCT26/7782194';
      octPayrolls[1].notes = 'Disbursed via instant corporate UPI';
      octPayrolls[1].paidAt = new Date('2026-10-05T11:00:00Z');
      await octPayrolls[1].save();
      console.log(`✓ Paid Record 2 (${octPayrolls[1].payslipNumber}): UPI transfer`);
    }

    // Record 3: Cash (Rule: Transaction reference MUST remain empty)
    if (octPayrolls[2] && octPayrolls[2].status === 'Pending') {
      octPayrolls[2].status = 'Paid';
      octPayrolls[2].paymentDate = new Date('2026-10-06');
      octPayrolls[2].paymentMethod = 'cash';
      octPayrolls[2].transactionReference = ''; // Empty string strictly!
      octPayrolls[2].notes = 'Petty cash disbursement with employee voucher signed';
      octPayrolls[2].paidAt = new Date('2026-10-06T14:00:00Z');
      await octPayrolls[2].save();
      console.log(`✓ Paid Record 3 (${octPayrolls[2].payslipNumber}): Cash payment (empty txn reference enforced)`);
    }
  }

  console.log('\n--- Demo Data Seeding Complete ---');
  await disconnectDatabase();
}

seedPayroll().catch((err) => {
  console.error('Error seeding payroll demo data:', err);
  process.exit(1);
});
