export type PaymentMethod =
  | 'bank_transfer'
  | 'cheque'
  | 'cash'
  | 'upi'
  | 'credit_card';

export type PaymentOutCategory =
  | 'media_cost'
  | 'production_cost'
  | 'logistics'
  | 'other';

export type CampaignPaymentStatus = 'pending' | 'partial' | 'complete';

export interface RecordedBy {
  id: string;
  name: string;
  email?: string;
}

export interface ReconciledBy {
  id: string;
  name: string;
}

export interface PaymentIn {
  id: string;
  _id?: string;
  campaignId: string;
  campaignCode?: string;
  campaignName?: string;
  clientId?: string | null;
  clientName?: string;
  client?: {
    id: string;
    name: string;
  } | null;
  amount: number; // integer paise
  receivedAt: string;
  method: PaymentMethod;
  transactionId?: string;
  notes?: string;
  recordedBy: RecordedBy | null;
  recordedAt: string;
  reconciled: boolean;
  reconciledAt?: string | null;
  reconciledBy?: ReconciledBy | null;
  attachments: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PaymentOut {
  id: string;
  _id?: string;
  campaignId: string;
  campaignCode?: string;
  campaignName?: string;
  clientId?: string | null;
  clientName?: string;
  client?: {
    id: string;
    name: string;
  } | null;
  vendorId: string;
  vendorName?: string;
  poId?: string | null;
  amount: number; // integer paise
  paidAt: string;
  method: PaymentMethod;
  category: PaymentOutCategory;
  vendorInvoice?: string;
  transactionId?: string;
  notes?: string;
  recordedBy: RecordedBy | null;
  recordedAt: string;
  reconciled: boolean;
  reconciledAt?: string | null;
  reconciledBy?: ReconciledBy | null;
  attachments: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CampaignFinance {
  id: string;
  _id?: string;
  campaignId: string;
  campaignCode?: string;
  campaignName?: string;
  clientId?: string | null;
  clientName?: string;
  revenue: number;
  paymentInCount: number;
  lastPaymentInAt?: string | null;
  expenses: number;
  expenses_media: number;
  expenses_production: number;
  expenses_logistics: number;
  expenses_other: number;
  paymentOutCount: number;
  lastPaymentOutAt?: string | null;
  profit: number;
  margin: number;
  contractedValue: number;
  actualCost: number;
  budgetVariance: number;
  paymentStatus: CampaignPaymentStatus;
  percentageReceived: number;
  calculatedAt: string;
  campaignStartDate?: string | null;
  campaignEndDate?: string | null;
}

export interface ProfitLog {
  id: string;
  campaignId: string;
  logDate: string;
  revenue: number;
  expenses: number;
  profit: number;
  margin: number;
  timestamp: string;
  notes?: string;
}

export interface ProfitTrendPoint {
  date: string;
  revenue: number;
  expenses: number;
  profit: number;
  margin: number;
  count?: number;
}

export interface ExpenseBreakdown {
  media: number;
  production: number;
  logistics: number;
  other: number;
  total: number;
  percentages: {
    media: number;
    production: number;
    logistics: number;
    other: number;
  };
}

export interface RevenueByAgent {
  agentId: string;
  agent?: string;
  agentName?: string;
  agentEmail?: string;
  revenue: number;
  campaignCount: number;
}

export interface FinanceSummary {
  totalRevenue: number;
  totalExpenses: number;
  totalProfit: number;
  averageMargin: number;
  pipelineTotal: number;
  activeCampaignsCount: number;
  totalPaymentsInCount: number;
  totalPaymentsOutCount: number;
  topCampaign?: {
    campaignId: string;
    campaignName: string;
    profit: number;
    margin: number;
  } | null;
}

export interface PaginatedList<T> {
  payments: T[];
  total: number;
  count: number;
  totalAmount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreatePaymentInPayload {
  campaignId: string;
  clientId?: string;
  amount: number; // in paise
  receivedAt: string;
  method: PaymentMethod;
  transactionId?: string;
  notes?: string;
  attachments?: string[];
}

export interface CreatePaymentOutPayload {
  campaignId: string;
  vendorId: string;
  poId?: string;
  amount: number; // in paise
  paidAt: string;
  method: PaymentMethod;
  category: PaymentOutCategory;
  vendorInvoice?: string;
  transactionId?: string;
  notes?: string;
  attachments?: string[];
}

export interface FinanceAlert {
  id: string;
  type: 'danger' | 'warning' | 'success' | 'info';
  title: string;
  message: string;
  campaignId?: string;
  campaignName?: string;
  amount?: number;
  margin?: number;
  actionText?: string;
}

// ============================================================================
// Invoice & Billing Types
// ============================================================================

export type InvoiceType = 'sales_invoice' | 'proforma';

export type InvoiceStatus =
  | 'Draft'
  | 'Sent'
  | 'Partially Paid'
  | 'Paid'
  | 'Overdue'
  | 'Cancelled';

export interface InvoiceItem {
  name: string;
  description?: string;
  hsn?: string;
  quantity: number;
  unit: string;
  discount?: number; // in integer paise
  rate: number; // in integer paise
  taxPercent: number;
  taxAmount: number; // in integer paise
  amount: number; // in integer paise
}

export interface InvoiceEditLog {
  modifiedBy: { id: string; name: string } | null;
  modifiedAt: string;
  changesSummary: string;
  note?: string;
}

export interface BankDetails {
  bankName?: string;
  accountNumber?: string;
  ifsc?: string;
  branch?: string;
  accountHolderName?: string;
}

export interface Invoice {
  id: string;
  _id?: string;
  type: InvoiceType;
  invoicePrefix: string;
  invoiceNumber: string;
  shareToken?: string;
  partyId?: string | null;
  partyName: string;
  billingAddress: string;
  shippingAddress: string;
  gstin: string;
  placeOfSupply: string;
  contactPerson: string;
  contactMobile: string;
  contactEmail: string;
  campaignId?: string | null;
  campaignCode?: string;
  campaignName?: string;
  invoiceDate: string;
  dueDate: string;
  items: InvoiceItem[];
  subtotal: number; // in paise
  discount: number; // in paise
  additionalCharges: number; // in paise
  taxableAmount: number; // in paise
  taxAmount: number; // in paise
  tcs: number; // in paise
  roundOff: number; // in paise
  totalAmount: number; // in paise
  amountReceived: number; // in paise
  balanceAmount: number; // in paise
  status: InvoiceStatus;
  bankDetails?: BankDetails;
  termsAndConditions?: string;
  notes?: string;
  editHistory: InvoiceEditLog[];
  createdBy: {
    id: string;
    name: string;
    email?: string;
  } | null;
  payments?: Array<{
    id: string;
    amount: number;
    receivedAt: string;
    method: string;
    transactionId?: string;
    notes?: string;
    reconciled: boolean;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedInvoices {
  invoices: Invoice[];
  total: number;
  count: number;
  totalAmount: number;
  totalReceived: number;
  totalBalance: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreateInvoicePayload {
  type?: InvoiceType;
  invoicePrefix?: string;
  invoiceNumber?: string;
  partyId?: string | null;
  partyName: string;
  billingAddress?: string;
  shippingAddress?: string;
  gstin?: string;
  placeOfSupply?: string;
  contactPerson?: string;
  contactMobile?: string;
  contactEmail?: string;
  campaignId?: string | null;
  invoiceDate: string;
  dueDate: string;
  items: Array<{
    name: string;
    description?: string;
    hsn?: string;
    quantity: number;
    unit?: string;
    discount?: number; // in paise
    rate: number; // in paise
    taxPercent: number;
  }>;
  discount?: number; // in paise
  additionalCharges?: number; // in paise
  tcs?: number; // in paise
  roundOff?: number; // in paise
  bankDetails?: BankDetails;
  termsAndConditions?: string;
  notes?: string;
  status?: InvoiceStatus;
}

export interface UpdateInvoicePayload extends Partial<CreateInvoicePayload> {
  editNote?: string;
}

export interface RecentPricePoint {
  invoiceNumber: string;
  invoiceDate: string;
  itemName: string;
  rate: number; // in paise
  quantity: number;
  unit: string;
  taxPercent: number;
}

export interface BankAccount {
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

export interface CreateBankAccountPayload {
  bankName: string;
  accountHolderName?: string;
  accountNumber: string;
  ifsc: string;
  branch: string;
  accountType?: 'Current' | 'Savings' | 'Overdraft';
  isDefault?: boolean;
  notes?: string;
}


