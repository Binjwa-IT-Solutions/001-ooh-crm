import { Types } from 'mongoose';
import { formattedSequence } from '../../core/db/sequence.js';
import { NotFoundError, ConflictError, ValidationError } from '../../core/errors/index.js';
import { formatPaise, renderPdf, DEFAULT_BRAND } from '../../core/pdf/index.js';
import { Employee, type IEmployee } from '../employees/employees.model.js';
import { AuthUser } from '../../core/auth/auth-model.js';
import { SalaryStructure, type ISalaryStructure } from './salary.model.js';
import {
  Payroll,
  type IPayroll,
  type SalaryPaymentMethod,
  PAYROLL_STATUSES,
} from './payroll.model.js';
import type {
  UpsertSalaryInput,
  GeneratePayrollInput,
  ProcessPaymentInput,
  ListPayrollQuery,
} from './payroll.validator.js';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export class PayrollService {
  /**
   * Authoritatively resolves an employee record by either:
   * 1. MongoDB Employee _id
   * 2. User ID (Employee.userId)
   * 3. Employee Code (Employee.employeeCode, e.g. "MO-EMP-0019")
   */
  static async resolveEmployee(identifier: string): Promise<IEmployee | null> {
    if (!identifier || typeof identifier !== 'string') return null;
    const trimmed = identifier.trim();
    if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return null;

    try {
      const byId = await Employee.findById(trimmed);
      if (byId) return byId;
    } catch {
      // Ignored if trimmed is not a valid ObjectId
    }

    try {
      const byUser = await Employee.findOne({ userId: trimmed, deletedAt: null });
      if (byUser) return byUser;
    } catch {
      // Ignored if trimmed is not a valid ObjectId
    }

    try {
      const byCode = await Employee.findOne({
        employeeCode: { $regex: new RegExp(`^${trimmed}$`, 'i') },
        deletedAt: null,
      });
      if (byCode) return byCode;
    } catch {
      // Ignored
    }

    return null;
  }

  /**
   * Authoritatively resolves a payroll record by either:
   * 1. MongoDB Payroll _id
   * 2. Payslip Number (payslipNumber, e.g. "PS-2026-10-001")
   */
  static async resolvePayroll(identifier: string): Promise<IPayroll | null> {
    if (!identifier || typeof identifier !== 'string') return null;
    const trimmed = identifier.trim();
    if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return null;

    try {
      const byId = await Payroll.findById(trimmed).populate('employeeId');
      if (byId) return byId;
    } catch {
      // Ignored if trimmed is not a valid ObjectId
    }

    try {
      const byNumber = await Payroll.findOne({
        payslipNumber: { $regex: new RegExp(`^${trimmed}$`, 'i') },
      }).populate('employeeId');
      if (byNumber) return byNumber;
    } catch {
      // Ignored
    }

    return null;
  }

  /**
   * Retrieves salary structure for an employee along with employee master info.
   */
  static async getEmployeeSalary(employeeId: string): Promise<{
    employee: IEmployee;
    salary: ISalaryStructure | null;
  }> {
    const employee = await PayrollService.resolveEmployee(employeeId);
    if (!employee) {
      throw new NotFoundError('Employee not found');
    }

    const salary = await SalaryStructure.findOne({ employeeId: employee._id });
    return { employee, salary };
  }

  /**
   * Lists all employees with their configured salary structures.
   */
  static async listAllEmployeeSalaries(params: {
    search?: string;
    department?: string;
  } = {}): Promise<Array<{
    employee: IEmployee;
    salary: ISalaryStructure | null;
  }>> {
    const filter: Record<string, unknown> = { status: { $in: ['Active', 'On Notice'] } };
    if (params.department && params.department !== 'all') {
      filter.department = params.department;
    }
    if (params.search?.trim()) {
      const q = params.search.trim();
      filter.$or = [
        { fullName: { $regex: q, $options: 'i' } },
        { employeeCode: { $regex: q, $options: 'i' } },
      ];
    }
    const employees = await Employee.find(filter).sort({ fullName: 1 });
    const employeeIds = employees.map((e) => e._id);
    const structures = await SalaryStructure.find({ employeeId: { $in: employeeIds } });
    const structureMap = new Map<string, ISalaryStructure>();
    for (const s of structures) {
      structureMap.set(String(s.employeeId), s);
    }
    return employees.map((emp) => {
      const empObj = emp.toObject ? emp.toObject() : emp;
      return {
        employee: {
          ...empObj,
          id: String(emp._id),
          _id: String(emp._id),
        } as unknown as IEmployee,
        salary: structureMap.get(String(emp._id)) || null,
      };
    });
  }

  /**
   * Creates or updates the salary structure for an employee.
   * If an existing salary structure is changed, preserves history.
   */
  static async upsertEmployeeSalary(
    employeeId: string,
    data: UpsertSalaryInput,
    userId?: string,
  ): Promise<ISalaryStructure> {
    const employee = await PayrollService.resolveEmployee(employeeId);
    if (!employee) {
      throw new NotFoundError('Employee not found');
    }

    const basicSalary = Math.round(Number(data.basicSalary));
    const hra = Math.round(Number(data.hra || 0));
    const conveyance = Math.round(Number(data.conveyance || 0));
    const otherAllowances = Math.round(Number(data.otherAllowances || 0));
    const bonus = Math.round(Number(data.bonus || 0));
    const deductions = Math.round(Number(data.deductions || 0));

    const grossSalary = basicSalary + hra + conveyance + otherAllowances + bonus;
    const netSalary = Math.max(0, grossSalary - deductions);

    let updaterName: string | undefined;
    if (userId) {
      const u = await AuthUser.findById(userId).select('name');
      updaterName = u?.name;
    }

    // Keep employee annual CTC in sync with monthly gross salary * 12
    employee.annualCtc = grossSalary * 12;
    await employee.save();

    const existing = await SalaryStructure.findOne({ employeeId: employee._id });

    if (!existing) {
      // Create new salary structure (no previous history to record)
      return SalaryStructure.create({
        employeeId: employee._id,
        effectiveFrom: data.effectiveFrom || new Date(),
        basicSalary,
        hra,
        conveyance,
        otherAllowances,
        bonus,
        grossSalary,
        deductions,
        netSalary,
        notes: data.notes?.trim() || '',
        updatedBy: userId ? new Types.ObjectId(userId) : null,
        history: [],
      });
    }

    // Check if any financial amount or effective date actually changed
    const hasChanged =
      existing.basicSalary !== basicSalary ||
      existing.hra !== hra ||
      existing.conveyance !== conveyance ||
      existing.otherAllowances !== otherAllowances ||
      existing.bonus !== bonus ||
      existing.deductions !== deductions ||
      (data.effectiveFrom &&
        new Date(existing.effectiveFrom).getTime() !== new Date(data.effectiveFrom).getTime());

    if (hasChanged) {
      // Archive current structure to history
      existing.history.push({
        effectiveFrom: existing.effectiveFrom,
        basicSalary: existing.basicSalary,
        hra: existing.hra,
        conveyance: existing.conveyance,
        otherAllowances: existing.otherAllowances,
        bonus: existing.bonus,
        grossSalary: existing.grossSalary,
        deductions: existing.deductions,
        netSalary: existing.netSalary,
        notes: existing.notes,
        updatedBy: existing.updatedBy,
        updatedByName: updaterName,
        createdAt: new Date(),
      });
    }

    existing.basicSalary = basicSalary;
    existing.hra = hra;
    existing.conveyance = conveyance;
    existing.otherAllowances = otherAllowances;
    existing.bonus = bonus;
    existing.grossSalary = grossSalary;
    existing.deductions = deductions;
    existing.netSalary = netSalary;
    if (data.effectiveFrom) {
      existing.effectiveFrom = data.effectiveFrom;
    }
    if (data.notes !== undefined) {
      existing.notes = data.notes.trim();
    }
    existing.updatedBy = userId ? new Types.ObjectId(userId) : null;

    return existing.save();
  }

  /**
   * Retrieves salary history for an employee.
   */
  static async getSalaryHistory(employeeId: string) {
    const employee = await PayrollService.resolveEmployee(employeeId);
    if (!employee) {
      throw new NotFoundError('Employee not found');
    }
    const salary = await SalaryStructure.findOne({ employeeId: employee._id }).populate(
      'history.updatedBy',
      'name email',
    );
    if (!salary) {
      return [];
    }
    return salary.history;
  }

  /**
   * Lists payroll records with filtering, searching, and pagination.
   */
  static async listPayroll(query: ListPayrollQuery): Promise<{
    items: IPayroll[];
    total: number;
    page: number;
    limit: number;
    pages: number;
    summary: {
      totalGross: number;
      totalDeductions: number;
      totalNet: number;
      paidCount: number;
      pendingCount: number;
    };
  }> {
    const filter: Record<string, unknown> = {};

    if (query.month) {
      filter.salaryMonth = query.month;
    }
    if (query.year) {
      filter.salaryYear = query.year;
    }
    if (query.status) {
      filter.status = query.status;
    }
    if (query.employeeId) {
      const emp = await PayrollService.resolveEmployee(query.employeeId);
      filter.employeeId = emp ? emp._id : new Types.ObjectId();
    }

    // Employee search / department filter
    if (query.search || query.department) {
      const empFilter: Record<string, unknown> = {};
      if (query.department) {
        empFilter.department = query.department;
      }
      if (query.search) {
        const regex = new RegExp(query.search.trim(), 'i');
        empFilter.$or = [{ fullName: regex }, { employeeCode: regex }, { workEmail: regex }];
      }

      const matchingEmployees = await Employee.find(empFilter).select('_id');
      const matchingIds = matchingEmployees.map((e) => e._id);
      filter.employeeId = { $in: matchingIds };
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 50));
    const skip = (page - 1) * limit;

    const [items, total, allMatching] = await Promise.all([
      Payroll.find(filter)
        .populate(
          'employeeId',
          'fullName employeeCode department designation dateOfJoining workEmail mobile status',
        )
        .sort({ salaryYear: -1, salaryMonth: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Payroll.countDocuments(filter),
      Payroll.find(filter).select('grossSalary deductions netPayable status'),
    ]);

    let totalGross = 0;
    let totalDeductions = 0;
    let totalNet = 0;
    let paidCount = 0;
    let pendingCount = 0;

    for (const record of allMatching) {
      totalGross += record.grossSalary || 0;
      totalDeductions += record.deductions || 0;
      totalNet += record.netPayable || 0;
      if (record.status === 'Paid') {
        paidCount++;
      } else if (record.status === 'Pending' || record.status === 'Draft' || record.status === 'Processed') {
        pendingCount++;
      }
    }

    const mappedItems = items.map((p) => {
      const pObj = p.toObject ? p.toObject() : p;
      if (pObj.employeeId && typeof pObj.employeeId === 'object') {
        const emp = pObj.employeeId as any;
        emp.id = String(emp._id);
      }
      return {
        ...pObj,
        id: String(p._id),
        _id: String(p._id),
      };
    }) as unknown as IPayroll[];

    return {
      items: mappedItems,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit) || 1,
      summary: {
        totalGross,
        totalDeductions,
        totalNet,
        paidCount,
        pendingCount,
      },
    };
  }

  /**
   * Generates payroll for a given month and year.
   * Prevents duplicates: If a payroll record already exists for an employee in that month/year, it skips it.
   */
  static async generatePayroll(
    input: GeneratePayrollInput,
    userId?: string,
  ): Promise<{
    generated: number;
    skipped: number;
    notConfigured: number;
    periodLabel: string;
  }> {
    const month = input.salaryMonth;
    const year = input.salaryYear;
    const periodLabel = `${MONTH_NAMES[month - 1]} ${year}`;
    const monthStr = String(month).padStart(2, '0');

    const empFilter: Record<string, unknown> = { status: { $in: ['Active', 'On Notice'] } };
    if (input.employeeIds?.length) {
      const resolvedIds = (
        await Promise.all(
          input.employeeIds.map(async (id) => {
            const emp = await PayrollService.resolveEmployee(id);
            return emp ? emp._id : null;
          }),
        )
      ).filter((id): id is Types.ObjectId => Boolean(id));

      empFilter._id = { $in: resolvedIds };
    }

    const employees = await Employee.find(empFilter);
    let generated = 0;
    let skipped = 0;
    let notConfigured = 0;

    for (const employee of employees) {
      // 1. Check if payroll record already exists for this employee + month + year
      const existing = await Payroll.findOne({
        employeeId: employee._id,
        salaryMonth: month,
        salaryYear: year,
      });

      if (existing) {
        skipped++;
        continue;
      }

      // 2. Fetch salary structure
      const salaryStructure = await SalaryStructure.findOne({ employeeId: employee._id });
      if (!salaryStructure) {
        notConfigured++;
        continue;
      }

      // 3. Generate unique sequential payslip number: e.g. PS-2026-10-001
      const payslipNumber = await formattedSequence(
        `payslip-${year}-${monthStr}`,
        `PS-${year}-${monthStr}`,
        3,
      );

      // 4. Create payroll snapshot
      await Payroll.create({
        payslipNumber,
        employeeId: employee._id,
        salaryMonth: month,
        salaryYear: year,
        periodLabel,
        salaryStructureSnapshot: {
          basicSalary: salaryStructure.basicSalary,
          hra: salaryStructure.hra,
          conveyance: salaryStructure.conveyance,
          otherAllowances: salaryStructure.otherAllowances,
          bonus: salaryStructure.bonus,
          grossSalary: salaryStructure.grossSalary,
          deductions: salaryStructure.deductions,
          netSalary: salaryStructure.netSalary,
        },
        grossSalary: salaryStructure.grossSalary,
        deductions: salaryStructure.deductions,
        netPayable: salaryStructure.netSalary,
        status: 'Pending',
        processedBy: userId ? new Types.ObjectId(userId) : null,
      });

      generated++;
    }

    return {
      generated,
      skipped,
      notConfigured,
      periodLabel,
    };
  }

  /**
   * Processes a salary payment for a payroll record.
   * Strictly enforces: Cash payments have blank transaction reference.
   */
  static async processPayment(
    payrollId: string,
    input: ProcessPaymentInput,
    userId?: string,
  ): Promise<IPayroll> {
    const payroll = await PayrollService.resolvePayroll(payrollId);
    if (!payroll) {
      throw new NotFoundError('Payroll record not found');
    }

    // Cash rule: transactionReference must remain empty
    let txRef = input.transactionReference?.trim() || '';
    if (input.paymentMethod === 'cash') {
      txRef = '';
    }

    payroll.status = 'Paid';
    payroll.paymentDate = input.paymentDate;
    payroll.paymentMethod = input.paymentMethod;
    payroll.transactionReference = txRef;
    payroll.notes = input.notes?.trim() || '';
    payroll.processedBy = userId ? new Types.ObjectId(userId) : payroll.processedBy;
    payroll.paidAt = new Date();

    return payroll.save();
  }

  /**
   * Fetches single payroll details by ID.
   */
  static async getPayrollById(payrollId: string): Promise<IPayroll> {
    const payroll = await PayrollService.resolvePayroll(payrollId);
    if (!payroll) {
      throw new NotFoundError('Payroll record not found');
    }
    return payroll;
  }

  /**
   * Generates a professional structured PDF payslip matching Media Octus branding.
   */
  static async generatePayslipPdf(payrollId: string): Promise<Buffer> {
    const payroll = await PayrollService.resolvePayroll(payrollId);
    if (!payroll) {
      throw new NotFoundError('Payroll record not found');
    }

    const employee = payroll.employeeId as unknown as IEmployee;
    const snapshot = payroll.salaryStructureSnapshot as any;
    const period = payroll.periodLabel;
    const brand = DEFAULT_BRAND;

    const isValidText = (val: unknown): val is string => {
      if (val === null || val === undefined) return false;
      if (typeof val !== 'string') return false;
      const trimmed = val.trim();
      if (!trimmed) return false;
      const lower = trimmed.toLowerCase();
      return !['-', '—', 'n/a', 'na', 'none', 'null', 'undefined'].includes(lower);
    };

    return renderPdf({
      title: 'EMPLOYEE PAYSLIP',
      reference: payroll.payslipNumber,
      customHeader: true,
      build: (doc) => {
        const PAGE_MARGIN = 48;
        const USABLE_WIDTH = doc.page.width - PAGE_MARGIN * 2;
        const CONTENT_BOTTOM_LIMIT = doc.page.height - 60;

        let currentY = PAGE_MARGIN;

        const ensureSpace = (neededHeight: number) => {
          if (currentY + neededHeight > CONTENT_BOTTOM_LIMIT) {
            doc.addPage();
            currentY = PAGE_MARGIN;
            return true;
          }
          return false;
        };

        // ====================================================================
        // 1. Company Header & Payslip Title (Clean 2-Column Header)
        // ====================================================================
        const startY = PAGE_MARGIN;
        let leftHeaderY = startY;

        doc.fillColor('#6E1D1D').fontSize(14).font('Helvetica-Bold').text(brand.companyName, PAGE_MARGIN, leftHeaderY);
        leftHeaderY = doc.y + 2;

        doc.fontSize(8).font('Helvetica').fillColor('#64748b');
        for (const line of brand.addressLines) {
          if (isValidText(line)) {
            doc.text(line, PAGE_MARGIN, leftHeaderY);
            leftHeaderY = doc.y + 1;
          }
        }

        const contactParts = [
          isValidText(brand.email) ? brand.email : '',
          isValidText(brand.phone) ? `Phone: ${brand.phone}` : '',
        ].filter(Boolean);
        if (contactParts.length) {
          doc.text(contactParts.join('  ·  '), PAGE_MARGIN, leftHeaderY);
          leftHeaderY = doc.y + 1;
        }
        if (isValidText(brand.gstin)) {
          doc.text(`GSTIN: ${brand.gstin}`, PAGE_MARGIN, leftHeaderY);
          leftHeaderY = doc.y + 1;
        }

        // Top Right: Document Title & Reference
        const rightWidth = 240;
        const rightX = PAGE_MARGIN + USABLE_WIDTH - rightWidth;
        let rightHeaderY = startY;

        doc.fillColor('#6E1D1D').fontSize(15).font('Helvetica-Bold').text('EMPLOYEE PAYSLIP', rightX, rightHeaderY, {
          width: rightWidth,
          align: 'right',
        });
        rightHeaderY += 18;

        if (isValidText(payroll.payslipNumber)) {
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#0f172a').text(`Slip No: ${payroll.payslipNumber}`, rightX, rightHeaderY, {
            width: rightWidth,
            align: 'right',
          });
          rightHeaderY += 14;
        }

        if (isValidText(period)) {
          doc.fontSize(8.5).font('Helvetica').fillColor('#64748b').text(`Salary Period: ${period}`, rightX, rightHeaderY, {
            width: rightWidth,
            align: 'right',
          });
          rightHeaderY += 14;
        }

        // Horizontal Rule after Header
        currentY = Math.max(leftHeaderY, rightHeaderY) + 10;
        doc
          .strokeColor('#e2e8f0')
          .lineWidth(1)
          .moveTo(PAGE_MARGIN, currentY)
          .lineTo(PAGE_MARGIN + USABLE_WIDTH, currentY)
          .stroke();
        currentY += 12;

        // ====================================================================
        // 2. Employee Information (2-Column Grid, Populated Fields ONLY)
        // ====================================================================
        const empFields: Array<{ label: string; value: string }> = [];

        if (isValidText(employee?.fullName)) {
          empFields.push({ label: 'Employee Name', value: employee.fullName.trim() });
        }
        if (isValidText(employee?.employeeCode)) {
          empFields.push({ label: 'Employee Code', value: employee.employeeCode.trim() });
        }
        if (isValidText(employee?.department)) {
          empFields.push({ label: 'Department', value: employee.department.trim() });
        }
        if (isValidText(employee?.designation)) {
          empFields.push({ label: 'Designation', value: employee.designation.trim() });
        }
        if (employee?.dateOfJoining) {
          const dojDate = new Date(employee.dateOfJoining);
          if (!isNaN(dojDate.getTime())) {
            empFields.push({
              label: 'Date of Joining',
              value: dojDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
            });
          }
        }
        if (isValidText(payroll.status)) {
          empFields.push({ label: 'Payment Status', value: payroll.status.trim() });
        }
        if (isValidText(employee?.bankAccountNumber)) {
          empFields.push({ label: 'Bank Account', value: employee.bankAccountNumber.trim() });
        }
        if (isValidText(employee?.ifsc)) {
          empFields.push({ label: 'IFSC Code', value: employee.ifsc.trim() });
        }
        if (isValidText(employee?.panNumber)) {
          empFields.push({ label: 'PAN Number', value: employee.panNumber.trim() });
        }

        if (empFields.length > 0) {
          ensureSpace(40);
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#6E1D1D').text('EMPLOYEE INFORMATION', PAGE_MARGIN, currentY);
          currentY += 14;

          const colGap = 16;
          const colWidth = (USABLE_WIDTH - colGap) / 2;
          const col1X = PAGE_MARGIN;
          const col2X = PAGE_MARGIN + colWidth + colGap;
          const labelWidth = 100;
          const valueWidth = colWidth - labelWidth;

          for (let i = 0; i < empFields.length; i += 2) {
            ensureSpace(16);
            const field1 = empFields[i];
            const field2 = empFields[i + 1];

            doc.fontSize(8.5).font('Helvetica').fillColor('#64748b').text(`${field1.label}:`, col1X, currentY, { width: labelWidth });
            doc.font('Helvetica-Bold').fillColor('#0f172a').text(field1.value, col1X + labelWidth, currentY, { width: valueWidth });

            if (field2) {
              doc.font('Helvetica').fillColor('#64748b').text(`${field2.label}:`, col2X, currentY, { width: labelWidth });
              doc.font('Helvetica-Bold').fillColor('#0f172a').text(field2.value, col2X + labelWidth, currentY, { width: valueWidth });
            }

            currentY += 15;
          }

          currentY += 4;
          doc
            .strokeColor('#e2e8f0')
            .lineWidth(0.75)
            .moveTo(PAGE_MARGIN, currentY)
            .lineTo(PAGE_MARGIN + USABLE_WIDTH, currentY)
            .stroke();
          currentY += 12;
        }

        // ====================================================================
        // 3. Salary Breakdown Table (Dynamic Positive Components Only!)
        // ====================================================================
        const salaryRows: Array<{ label: string; amountPaise: number }> = [];

        if (typeof snapshot?.basicSalary === 'number' && snapshot.basicSalary > 0) {
          salaryRows.push({ label: 'Basic Salary', amountPaise: snapshot.basicSalary });
        }
        if (typeof snapshot?.hra === 'number' && snapshot.hra > 0) {
          salaryRows.push({ label: 'House Rent Allowance (HRA)', amountPaise: snapshot.hra });
        }
        if (typeof snapshot?.conveyance === 'number' && snapshot.conveyance > 0) {
          salaryRows.push({ label: 'Conveyance Allowance', amountPaise: snapshot.conveyance });
        }
        if (typeof snapshot?.otherAllowances === 'number' && snapshot.otherAllowances > 0) {
          salaryRows.push({ label: 'Other Allowances', amountPaise: snapshot.otherAllowances });
        }
        if (typeof snapshot?.bonus === 'number' && snapshot.bonus > 0) {
          salaryRows.push({ label: 'Bonus / Incentives', amountPaise: snapshot.bonus });
        }

        // Include any additional dynamic positive allowances from snapshot
        if (snapshot && typeof snapshot === 'object') {
          const standardKeys = new Set([
            'basicSalary',
            'hra',
            'conveyance',
            'otherAllowances',
            'bonus',
            'grossSalary',
            'deductions',
            'netSalary',
            '_id',
            'id',
            'createdAt',
            'updatedAt',
            '__v',
          ]);
          for (const [key, val] of Object.entries(snapshot)) {
            if (!standardKeys.has(key) && typeof val === 'number' && val > 0) {
              const formattedLabel = key
                .replace(/([A-Z])/g, ' $1')
                .replace(/^./, (str) => str.toUpperCase())
                .trim();
              salaryRows.push({ label: formattedLabel, amountPaise: val });
            }
          }
        }

        ensureSpace(50);
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#6E1D1D').text('SALARY BREAKDOWN', PAGE_MARGIN, currentY);
        currentY += 14;

        const drawTableHeader = () => {
          doc.rect(PAGE_MARGIN, currentY, USABLE_WIDTH, 18).fill('#f8fafc');
          doc
            .strokeColor('#cbd5e1')
            .lineWidth(0.75)
            .rect(PAGE_MARGIN, currentY, USABLE_WIDTH, 18)
            .stroke();

          doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#475569');
          doc.text('COMPONENT', PAGE_MARGIN + 10, currentY + 4, { width: USABLE_WIDTH * 0.65 });
          doc.text('AMOUNT', PAGE_MARGIN + USABLE_WIDTH * 0.65, currentY + 4, {
            width: USABLE_WIDTH * 0.35 - 10,
            align: 'right',
          });
          currentY += 18;
        };

        drawTableHeader();

        // Component Body Rows
        for (const item of salaryRows) {
          if (ensureSpace(20)) {
            drawTableHeader();
          }

          doc
            .strokeColor('#f1f5f9')
            .lineWidth(0.5)
            .moveTo(PAGE_MARGIN, currentY + 16)
            .lineTo(PAGE_MARGIN + USABLE_WIDTH, currentY + 16)
            .stroke();

          doc.fontSize(8.5).font('Helvetica').fillColor('#1e293b');
          doc.text(item.label, PAGE_MARGIN + 10, currentY + 4, { width: USABLE_WIDTH * 0.65 });
          doc.font('Helvetica-Bold').fillColor('#0f172a').text(formatPaise(item.amountPaise), PAGE_MARGIN + USABLE_WIDTH * 0.65, currentY + 4, {
            width: USABLE_WIDTH * 0.35 - 10,
            align: 'right',
          });
          currentY += 17;
        }

        // Gross Salary Row (ONLY if > 0)
        if (typeof payroll.grossSalary === 'number' && payroll.grossSalary > 0) {
          if (ensureSpace(20)) {
            drawTableHeader();
          }

          doc
            .strokeColor('#cbd5e1')
            .lineWidth(0.75)
            .moveTo(PAGE_MARGIN, currentY)
            .lineTo(PAGE_MARGIN + USABLE_WIDTH, currentY)
            .stroke();

          doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a');
          doc.text('Gross Salary', PAGE_MARGIN + 10, currentY + 4, { width: USABLE_WIDTH * 0.65 });
          doc.text(formatPaise(payroll.grossSalary), PAGE_MARGIN + USABLE_WIDTH * 0.65, currentY + 4, {
            width: USABLE_WIDTH * 0.35 - 10,
            align: 'right',
          });
          currentY += 17;
        }

        // Deductions Row (ONLY if payroll.deductions > 0!)
        if (typeof payroll.deductions === 'number' && payroll.deductions > 0) {
          if (ensureSpace(20)) {
            drawTableHeader();
          }

          doc
            .strokeColor('#f1f5f9')
            .lineWidth(0.5)
            .moveTo(PAGE_MARGIN, currentY)
            .lineTo(PAGE_MARGIN + USABLE_WIDTH, currentY)
            .stroke();

          doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#b91c1c');
          doc.text('Total Deductions', PAGE_MARGIN + 10, currentY + 4, { width: USABLE_WIDTH * 0.65 });
          doc.text(`- ${formatPaise(payroll.deductions)}`, PAGE_MARGIN + USABLE_WIDTH * 0.65, currentY + 4, {
            width: USABLE_WIDTH * 0.35 - 10,
            align: 'right',
          });
          currentY += 17;
        }

        // Net Payable Amount Highlight Box (Kept tightly with salary breakdown!)
        ensureSpace(26);
        doc.rect(PAGE_MARGIN, currentY, USABLE_WIDTH, 22).fill('#F8E6E6');
        doc
          .strokeColor('#6E1D1D')
          .lineWidth(1)
          .rect(PAGE_MARGIN, currentY, USABLE_WIDTH, 22)
          .stroke();

        doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#6E1D1D');
        doc.text('Net Payable Amount', PAGE_MARGIN + 10, currentY + 6, { width: USABLE_WIDTH * 0.65 });
        doc.text(formatPaise(payroll.netPayable ?? 0), PAGE_MARGIN + USABLE_WIDTH * 0.65, currentY + 6, {
          width: USABLE_WIDTH * 0.35 - 10,
          align: 'right',
        });
        currentY += 26;

        // ====================================================================
        // 4. Payment Details (ONLY Rendered if Populated!)
        // ====================================================================
        const paymentFields: Array<{ label: string; value: string }> = [];

        if (payroll.paymentDate) {
          const pDate = new Date(payroll.paymentDate);
          if (!isNaN(pDate.getTime())) {
            paymentFields.push({
              label: 'Payment Date',
              value: pDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
            });
          }
        }

        if (isValidText(payroll.paymentMethod)) {
          const methodMap: Record<string, string> = {
            bank_transfer: 'Bank Transfer',
            upi: 'UPI',
            cheque: 'Cheque',
            cash: 'Cash',
          };
          const methodLabel = methodMap[payroll.paymentMethod!.trim()] || payroll.paymentMethod!.trim();
          paymentFields.push({ label: 'Payment Method', value: methodLabel });
        }

        if (isValidText(payroll.transactionReference) && payroll.paymentMethod !== 'cash') {
          paymentFields.push({ label: 'Transaction Reference', value: payroll.transactionReference!.trim() });
        }

        if (isValidText(payroll.notes)) {
          paymentFields.push({ label: 'Payment Remarks', value: payroll.notes!.trim() });
        }

        if (paymentFields.length > 0) {
          currentY += 8;
          ensureSpace(40);
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#6E1D1D').text('PAYMENT DETAILS', PAGE_MARGIN, currentY);
          currentY += 14;

          const colGap = 16;
          const colWidth = (USABLE_WIDTH - colGap) / 2;
          const col1X = PAGE_MARGIN;
          const col2X = PAGE_MARGIN + colWidth + colGap;
          const labelWidth = 110;
          const valueWidth = colWidth - labelWidth;

          for (let i = 0; i < paymentFields.length; i += 2) {
            ensureSpace(16);
            const f1 = paymentFields[i];
            const f2 = paymentFields[i + 1];

            doc.fontSize(8.5).font('Helvetica').fillColor('#64748b').text(`${f1.label}:`, col1X, currentY, { width: labelWidth });
            doc.font('Helvetica-Bold').fillColor('#0f172a').text(f1.value, col1X + labelWidth, currentY, { width: valueWidth });

            if (f2) {
              doc.font('Helvetica').fillColor('#64748b').text(`${f2.label}:`, col2X, currentY, { width: labelWidth });
              doc.font('Helvetica-Bold').fillColor('#0f172a').text(f2.value, col2X + labelWidth, currentY, { width: valueWidth });
            }

            currentY += 15;
          }

          currentY += 4;
          doc
            .strokeColor('#e2e8f0')
            .lineWidth(0.75)
            .moveTo(PAGE_MARGIN, currentY)
            .lineTo(PAGE_MARGIN + USABLE_WIDTH, currentY)
            .stroke();
          currentY += 10;
        }

        // ====================================================================
        // 5. Computer-Generated Notice
        // ====================================================================
        const spaceLeft = CONTENT_BOTTOM_LIMIT - currentY;
        let noticeY: number;
        if (currentY > 480 && spaceLeft >= 25) {
          noticeY = doc.page.height - 58;
        } else {
          noticeY = currentY + 16;
        }

        doc
          .fontSize(7.5)
          .font('Helvetica')
          .fillColor('#94a3b8')
          .text(
            'This is a computer-generated payslip and does not require a physical signature.',
            PAGE_MARGIN,
            noticeY,
            { width: USABLE_WIDTH, align: 'center', lineBreak: false },
          );
      },
    });
  }
}
