import { Schema, model, type Document, type Types } from 'mongoose';

export interface IBankAccount extends Document {
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  ifsc: string;
  branch: string;
  accountType: 'Current' | 'Savings' | 'Overdraft';
  isDefault: boolean;
  isActive: boolean;
  notes?: string;
  createdBy: Types.ObjectId;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const bankAccountSchema = new Schema<IBankAccount>(
  {
    bankName: { type: String, required: true, trim: true },
    accountHolderName: { type: String, required: true, trim: true, default: 'Media Octus Pvt Ltd' },
    accountNumber: { type: String, required: true, trim: true },
    ifsc: { type: String, required: true, trim: true, uppercase: true },
    branch: { type: String, required: true, trim: true, default: 'Mumbai' },
    accountType: {
      type: String,
      enum: ['Current', 'Savings', 'Overdraft'],
      default: 'Current',
    },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    notes: { type: String, default: '', trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

bankAccountSchema.index({ isDefault: 1, isDeleted: 1 });

export const BankAccount = model<IBankAccount>('BankAccount', bankAccountSchema);
