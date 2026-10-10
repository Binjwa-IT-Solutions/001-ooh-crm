import { Request, Response } from 'express';
import { PayrollService } from './payroll.service.js';
import {
  upsertSalarySchema,
  generatePayrollSchema,
  processPaymentSchema,
  listPayrollQuerySchema,
} from './payroll.validator.js';

export class PayrollController {
  static async listAllEmployeeSalaries(req: Request, res: Response): Promise<void> {
    const { search, department } = req.query;
    const result = await PayrollService.listAllEmployeeSalaries({
      search: typeof search === 'string' ? search : undefined,
      department: typeof department === 'string' ? department : undefined,
    });
    res.status(200).json({ items: result });
  }

  static async getEmployeeSalary(req: Request, res: Response): Promise<void> {
    const employeeId = String(req.params.employeeId || req.params.id);
    const result = await PayrollService.getEmployeeSalary(employeeId);
    res.status(200).json(result);
  }

  static async upsertEmployeeSalary(req: Request, res: Response): Promise<void> {
    const employeeId = String(req.params.employeeId || req.params.id);
    const data = upsertSalarySchema.parse(req.body);
    const salary = await PayrollService.upsertEmployeeSalary(
      employeeId,
      data,
      req.ctx?.user?.id,
    );
    res.status(200).json({
      message: 'Salary structure updated successfully',
      salary,
    });
  }

  static async getSalaryHistory(req: Request, res: Response): Promise<void> {
    const employeeId = String(req.params.employeeId || req.params.id);
    const history = await PayrollService.getSalaryHistory(employeeId);
    res.status(200).json({ history });
  }

  static async listPayroll(req: Request, res: Response): Promise<void> {
    const query = listPayrollQuerySchema.parse(req.query);
    const result = await PayrollService.listPayroll(query);
    res.status(200).json(result);
  }

  static async generatePayroll(req: Request, res: Response): Promise<void> {
    const data = generatePayrollSchema.parse(req.body);
    const result = await PayrollService.generatePayroll(data, req.ctx?.user?.id);
    res.status(201).json({
      message: `Generated payroll for ${result.generated} employee(s). ${result.skipped} already existed. ${result.notConfigured} unconfigured.`,
      ...result,
    });
  }

  static async processPayment(req: Request, res: Response): Promise<void> {
    const payrollId = String(req.params.id);
    const data = processPaymentSchema.parse(req.body);
    const payroll = await PayrollService.processPayment(
      payrollId,
      data,
      req.ctx?.user?.id,
    );
    res.status(200).json({
      message: 'Salary payment processed successfully',
      payroll,
    });
  }

  static async getPayrollById(req: Request, res: Response): Promise<void> {
    const payrollId = String(req.params.id);
    const payroll = await PayrollService.getPayrollById(payrollId);
    res.status(200).json({ payroll });
  }

  static async downloadPayslipPdf(req: Request, res: Response): Promise<void> {
    const payrollId = String(req.params.id);
    const pdfBuffer = await PayrollService.generatePayslipPdf(payrollId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="payslip-${payrollId}.pdf"`);
    res.send(pdfBuffer);
  }
}
