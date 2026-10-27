export interface BusinessSummary {
  totalLeads?: number;
  totalClients?: number;
  totalCampaigns?: number;
  activeCampaigns?: number;
  totalQuotations?: number;
  pendingQuotations?: number;
  totalSites?: number;
  activeSites?: number;
  totalVendors?: number;
  pendingTasks?: number;
  pendingProofs?: number;
}

export interface FinancialOverview {
  totalClientPaymentsReceived: number; // in paise
  totalVendorPaymentsMade: number; // in paise
  clientOutstandingReceivables: number; // in paise
  vendorOutstandingPayables: number; // in paise
  totalInvoicedAmount: number; // in paise
  totalVendorBills: number; // in paise
  campaignRevenue: number; // in paise
  campaignExpenses: number; // in paise
  netProfit: number; // in paise
  averageMargin: number; // percentage
  pipelineContracted: number; // in paise
  overdueReceivables: number; // in paise
  overdueInvoicesCount: number;
  pendingInvoicesCount: number;
  reconciledPaymentsInCount: number;
  unreconciledPaymentsInCount: number;
  reconciledPaymentsOutCount: number;
  unreconciledPaymentsOutCount: number;
  pendingPayrollAmount?: number; // in paise
  pendingPayrollCount?: number;
}

export interface MoneyMovementItem {
  id: string;
  type: 'in' | 'out';
  date: string;
  partyName: string;
  refNumber: string;
  campaignName: string;
  amount: number; // in paise
  method: string;
  transactionId: string;
  reconciled: boolean;
  status: string;
}

export interface ClientReceivableItem {
  id: string;
  invoiceNumber: string;
  partyName: string;
  totalAmount: number; // in paise
  amountReceived: number; // in paise
  balanceAmount: number; // in paise
  dueDate: string;
  status: string;
  isOverdue: boolean;
}

export interface VendorPayableItem {
  id: string;
  vendorName: string;
  reference: string;
  totalAmount: number; // in paise
  amountPaid: number; // in paise
  balanceAmount: number; // in paise
  dueDate: string;
  status: string;
  category: string;
  method: string;
}

export interface DashboardAlert {
  id: string;
  type: 'danger' | 'warning' | 'info';
  title: string;
  description: string;
  count?: number;
  link: string;
}

export interface AdminDashboardData {
  userRole: string;
  permissions: string[];
  businessSummary: BusinessSummary;
  financialOverview: FinancialOverview | null;
  expectedFromClients: ClientReceivableItem[] | null;
  moneyToBePaidToVendors: VendorPayableItem[] | null;
  moneyMovement: MoneyMovementItem[] | null;
  trends: Array<{
    date: string;
    revenue: number;
    expenses: number;
    profit: number;
    margin: number;
  }> | null;
  alerts: DashboardAlert[];
}
