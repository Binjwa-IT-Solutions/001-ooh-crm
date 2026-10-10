import { Types } from 'mongoose';
import { BankAccount, type IBankAccount } from '../models/bankAccount.model.js';
import { NotFoundError, ValidationError } from '../../../core/errors/index.js';
import type { RequestContext } from '../../../core/context.js';

export interface BankAccountDto {
  id: string;
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  ifsc: string;
  branch: string;
  accountType: 'Current' | 'Savings' | 'Overdraft';
  isDefault: boolean;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBankAccountInput {
  bankName: string;
  accountHolderName?: string;
  accountNumber: string;
  ifsc: string;
  branch: string;
  accountType?: 'Current' | 'Savings' | 'Overdraft';
  isDefault?: boolean;
  notes?: string;
}

export interface UpdateBankAccountInput {
  bankName?: string;
  accountHolderName?: string;
  accountNumber?: string;
  ifsc?: string;
  branch?: string;
  accountType?: 'Current' | 'Savings' | 'Overdraft';
  isDefault?: boolean;
  isActive?: boolean;
  notes?: string;
}

function toDto(doc: any): BankAccountDto {
  return {
    id: String(doc._id),
    bankName: doc.bankName,
    accountHolderName: doc.accountHolderName,
    accountNumber: doc.accountNumber,
    ifsc: doc.ifsc,
    branch: doc.branch,
    accountType: doc.accountType,
    isDefault: !!doc.isDefault,
    isActive: doc.isActive !== false,
    notes: doc.notes || '',
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : new Date().toISOString(),
  };
}

export const bankAccountService = {
  /**
   * List all active company bank accounts.
   * Auto-seeds standard Media Octus HDFC Bank account if table is empty.
   */
  async getBankAccounts(ctx: RequestContext): Promise<BankAccountDto[]> {
    let accounts = await BankAccount.find({ isDeleted: false })
      .sort({ isDefault: -1, createdAt: -1 })
      .lean();

    if (accounts.length === 0) {
      // Seed default Media Octus bank account
      const seeded = new BankAccount({
        bankName: 'HDFC Bank',
        accountHolderName: 'Media Octus Pvt Ltd',
        accountNumber: '50200088991122',
        ifsc: 'HDFC0000123',
        branch: 'Bandra Kurla Complex, Mumbai',
        accountType: 'Current',
        isDefault: true,
        isActive: true,
        notes: 'Primary operating current account for client settlements and billing.',
        createdBy: new Types.ObjectId(ctx.user.id),
      });
      await seeded.save();
      accounts = [seeded.toObject()];
    }

    return accounts.map(toDto);
  },

  /** Create a new bank account */
  async createBankAccount(input: CreateBankAccountInput, ctx: RequestContext): Promise<BankAccountDto> {
    if (!input.bankName || !input.accountNumber || !input.ifsc || !input.branch) {
      throw new ValidationError('Bank Name, Account Number, IFSC Code, and Branch are required');
    }

    const cleanIfsc = input.ifsc.trim().toUpperCase();
    if (cleanIfsc.length < 5) {
      throw new ValidationError('Valid IFSC Code is required');
    }

    if (input.isDefault) {
      // Clear previous default
      await BankAccount.updateMany({ isDeleted: false }, { isDefault: false });
    }

    const doc = new BankAccount({
      bankName: input.bankName.trim(),
      accountHolderName: input.accountHolderName?.trim() || 'Media Octus Pvt Ltd',
      accountNumber: input.accountNumber.trim(),
      ifsc: cleanIfsc,
      branch: input.branch.trim(),
      accountType: input.accountType || 'Current',
      isDefault: !!input.isDefault,
      isActive: true,
      notes: input.notes?.trim() || '',
      createdBy: new Types.ObjectId(ctx.user.id),
    });

    await doc.save();
    return toDto(doc);
  },

  /** Update an existing bank account */
  async updateBankAccount(id: string, input: UpdateBankAccountInput, ctx: RequestContext): Promise<BankAccountDto> {
    if (!Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid Bank Account ID');
    }

    const doc = await BankAccount.findOne({ _id: new Types.ObjectId(id), isDeleted: false });
    if (!doc) {
      throw new NotFoundError('Bank Account not found');
    }

    if (input.isDefault) {
      await BankAccount.updateMany({ _id: { $ne: doc._id }, isDeleted: false }, { isDefault: false });
      doc.isDefault = true;
    } else if (input.isDefault === false) {
      doc.isDefault = false;
    }

    if (input.bankName !== undefined) doc.bankName = input.bankName.trim();
    if (input.accountHolderName !== undefined) doc.accountHolderName = input.accountHolderName.trim();
    if (input.accountNumber !== undefined) doc.accountNumber = input.accountNumber.trim();
    if (input.ifsc !== undefined) doc.ifsc = input.ifsc.trim().toUpperCase();
    if (input.branch !== undefined) doc.branch = input.branch.trim();
    if (input.accountType !== undefined) doc.accountType = input.accountType;
    if (input.isActive !== undefined) doc.isActive = input.isActive;
    if (input.notes !== undefined) doc.notes = input.notes.trim();

    await doc.save();
    return toDto(doc);
  },

  /** Set default bank account */
  async setDefaultBankAccount(id: string, ctx: RequestContext): Promise<BankAccountDto> {
    if (!Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid Bank Account ID');
    }

    const doc = await BankAccount.findOne({ _id: new Types.ObjectId(id), isDeleted: false });
    if (!doc) {
      throw new NotFoundError('Bank Account not found');
    }

    await BankAccount.updateMany({ isDeleted: false }, { isDefault: false });
    doc.isDefault = true;
    doc.isActive = true;
    await doc.save();

    return toDto(doc);
  },

  /** Soft delete bank account */
  async deleteBankAccount(id: string, ctx: RequestContext): Promise<{ success: boolean; message: string }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid Bank Account ID');
    }

    const doc = await BankAccount.findOne({ _id: new Types.ObjectId(id), isDeleted: false });
    if (!doc) {
      throw new NotFoundError('Bank Account not found');
    }

    doc.isDeleted = true;
    doc.isDefault = false;
    await doc.save();

    return { success: true, message: `Bank account ${doc.bankName} (${doc.accountNumber}) deleted successfully` };
  },
};
