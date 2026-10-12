import { api } from '@/shared/api/client';
import type {
  PaymentIn,
  PaymentOut,
  CampaignFinance,
  ProfitTrendPoint,
  ExpenseBreakdown,
  RevenueByAgent,
  FinanceSummary,
  PaginatedList,
  CreatePaymentInPayload,
  CreatePaymentOutPayload,
} from './types';

export const financeApi = {
  // ==========================================================================
  // F1: Payments In (Client Payments)
  // ==========================================================================
  async getPaymentsIn(params: {
    campaignId?: string;
    fromDate?: string;
    toDate?: string;
    method?: string;
    reconciled?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<PaginatedList<PaymentIn>> {
    const searchParams = new URLSearchParams();
    if (params.campaignId) searchParams.set('campaignId', params.campaignId);
    if (params.fromDate) searchParams.set('fromDate', params.fromDate);
    if (params.toDate) searchParams.set('toDate', params.toDate);
    if (params.method) searchParams.set('method', params.method);
    if (params.reconciled !== undefined) searchParams.set('reconciled', String(params.reconciled));
    if (params.search) searchParams.set('search', params.search);
    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));

    const qs = searchParams.toString();
    return api.get<PaginatedList<PaymentIn>>(`/api/finance/payments-in${qs ? `?${qs}` : ''}`);
  },

  async getPaymentInById(id: string): Promise<{ payment: PaymentIn }> {
    return api.get<{ payment: PaymentIn }>(`/api/finance/payments-in/${id}`);
  },

  async createPaymentIn(data: CreatePaymentInPayload): Promise<{ message: string; payment: PaymentIn }> {
    return api.post<{ message: string; payment: PaymentIn }>('/api/finance/payments-in', data);
  },

  async updatePaymentIn(id: string, data: Partial<CreatePaymentInPayload>): Promise<{ message: string; payment: PaymentIn }> {
    return api.patch<{ message: string; payment: PaymentIn }>(`/api/finance/payments-in/${id}`, data);
  },

  async deletePaymentIn(id: string): Promise<{ success: boolean; message: string }> {
    return api.delete<{ success: boolean; message: string }>(`/api/finance/payments-in/${id}`);
  },

  async reconcilePaymentIn(id: string): Promise<{ message: string; payment: PaymentIn }> {
    return api.patch<{ message: string; payment: PaymentIn }>(`/api/finance/payments-in/${id}/reconcile`, {});
  },

  // ==========================================================================
  // F2: Payments Out (Vendor Payments)
  // ==========================================================================
  async getPaymentsOut(params: {
    campaignId?: string;
    vendorId?: string;
    category?: string;
    fromDate?: string;
    toDate?: string;
    method?: string;
    reconciled?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<PaginatedList<PaymentOut>> {
    const searchParams = new URLSearchParams();
    if (params.campaignId) searchParams.set('campaignId', params.campaignId);
    if (params.vendorId) searchParams.set('vendorId', params.vendorId);
    if (params.category) searchParams.set('category', params.category);
    if (params.fromDate) searchParams.set('fromDate', params.fromDate);
    if (params.toDate) searchParams.set('toDate', params.toDate);
    if (params.method) searchParams.set('method', params.method);
    if (params.reconciled !== undefined) searchParams.set('reconciled', String(params.reconciled));
    if (params.search) searchParams.set('search', params.search);
    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));

    const qs = searchParams.toString();
    return api.get<PaginatedList<PaymentOut>>(`/api/finance/payments-out${qs ? `?${qs}` : ''}`);
  },

  async getPaymentOutById(id: string): Promise<{ payment: PaymentOut }> {
    return api.get<{ payment: PaymentOut }>(`/api/finance/payments-out/${id}`);
  },

  async createPaymentOut(data: CreatePaymentOutPayload): Promise<{ message: string; payment: PaymentOut }> {
    return api.post<{ message: string; payment: PaymentOut }>('/api/finance/payments-out', data);
  },

  async updatePaymentOut(id: string, data: Partial<CreatePaymentOutPayload>): Promise<{ message: string; payment: PaymentOut }> {
    return api.patch<{ message: string; payment: PaymentOut }>(`/api/finance/payments-out/${id}`, data);
  },

  async deletePaymentOut(id: string): Promise<{ success: boolean; message: string }> {
    return api.delete<{ success: boolean; message: string }>(`/api/finance/payments-out/${id}`);
  },

  async reconcilePaymentOut(id: string): Promise<{ message: string; payment: PaymentOut }> {
    return api.patch<{ message: string; payment: PaymentOut }>(`/api/finance/payments-out/${id}/reconcile`, {});
  },

  // ==========================================================================
  // F3 / F4 / F5: Rollups & Reports
  // ==========================================================================
  async getCampaignFinance(campaignId: string): Promise<{ finance: CampaignFinance }> {
    if (!campaignId || campaignId === 'undefined' || campaignId === 'null') {
      throw new Error('Invalid campaign ID');
    }
    return api.get<{ finance: CampaignFinance }>(`/api/finance/campaigns/${campaignId}/finance`);
  },

  async getProfitLeaderboard(limit = 10, sortBy = 'profit'): Promise<{ leaderboard: CampaignFinance[] }> {
    return api.get<{ leaderboard: CampaignFinance[] }>(`/api/finance/profit-leaderboard?limit=${limit}&sortBy=${sortBy}`);
  },

  async getLowMarginCampaigns(threshold = 10): Promise<{ lowMarginCampaigns: CampaignFinance[] }> {
    return api.get<{ lowMarginCampaigns: CampaignFinance[] }>(`/api/finance/low-margin-campaigns?threshold=${threshold}`);
  },

  async getRevenueByAgent(fromDate?: string, toDate?: string): Promise<{ revenueByAgent: RevenueByAgent[] }> {
    const params = new URLSearchParams();
    if (fromDate) params.set('fromDate', fromDate);
    if (toDate) params.set('toDate', toDate);
    const qs = params.toString();
    return api.get<{ revenueByAgent: RevenueByAgent[] }>(`/api/finance/revenue-by-agent${qs ? `?${qs}` : ''}`);
  },

  async getSummary(): Promise<FinanceSummary> {
    return api.get<FinanceSummary>('/api/finance/summary');
  },

  async getProfitTrends(days = 30, campaignId?: string): Promise<{ trends: ProfitTrendPoint[] }> {
    const params = new URLSearchParams({ days: String(days) });
    if (campaignId && campaignId !== 'undefined' && campaignId !== 'null') {
      params.set('campaignId', campaignId);
    }
    return api.get<{ trends: ProfitTrendPoint[] }>(`/api/finance/profit-trends?${params.toString()}`);
  },

  async getExpenseBreakdown(campaignId?: string): Promise<ExpenseBreakdown> {
    const params = new URLSearchParams();
    if (campaignId && campaignId !== 'undefined' && campaignId !== 'null') {
      params.set('campaignId', campaignId);
    }
    const qs = params.toString();
    return api.get<ExpenseBreakdown>(`/api/finance/expense-breakdown${qs ? `?${qs}` : ''}`);
  },

  async runRollupJob(): Promise<{ message: string; processed: number; totalRevenue: number; totalExpenses: number; totalProfit: number }> {
    return api.post<{ message: string; processed: number; totalRevenue: number; totalExpenses: number; totalProfit: number }>('/api/finance/jobs/run-rollup', {});
  },
};

export const invoicesApi = {
  // ==========================================================================
  // Invoices & Proforma Invoices
  // ==========================================================================
  async getInvoices(params: {
    type?: 'sales_invoice' | 'proforma';
    status?: string;
    partyId?: string;
    campaignId?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  } = {}): Promise<import('./types').PaginatedInvoices> {
    const searchParams = new URLSearchParams();
    if (params.type) searchParams.set('type', params.type);
    if (params.status && params.status !== 'all') searchParams.set('status', params.status);
    if (params.partyId) searchParams.set('partyId', params.partyId);
    if (params.campaignId) searchParams.set('campaignId', params.campaignId);
    if (params.search) searchParams.set('search', params.search);
    if (params.startDate) searchParams.set('startDate', params.startDate);
    if (params.endDate) searchParams.set('endDate', params.endDate);
    if (params.page) searchParams.set('page', String(params.page));
    if (params.pageSize) searchParams.set('pageSize', String(params.pageSize));

    const qs = searchParams.toString();
    return api.get<import('./types').PaginatedInvoices>(`/api/finance/invoices${qs ? `?${qs}` : ''}`);
  },

  async getInvoiceById(id: string): Promise<{ success: boolean; invoice: import('./types').Invoice; data: import('./types').Invoice }> {
    return api.get<{ success: boolean; invoice: import('./types').Invoice; data: import('./types').Invoice }>(`/api/finance/invoices/${id}`);
  },

  async createInvoice(data: import('./types').CreateInvoicePayload): Promise<{ success: boolean; message: string; invoice: import('./types').Invoice }> {
    return api.post<{ success: boolean; message: string; invoice: import('./types').Invoice }>('/api/finance/invoices', data);
  },

  async updateInvoice(id: string, data: import('./types').UpdateInvoicePayload): Promise<{ success: boolean; message: string; invoice: import('./types').Invoice }> {
    return api.patch<{ success: boolean; message: string; invoice: import('./types').Invoice }>(`/api/finance/invoices/${id}`, data);
  },

  async deleteInvoice(id: string): Promise<{ success: boolean; message: string }> {
    return api.delete<{ success: boolean; message: string }>(`/api/finance/invoices/${id}`);
  },

  async duplicateInvoice(id: string): Promise<{ success: boolean; message: string; invoice: import('./types').Invoice }> {
    return api.post<{ success: boolean; message: string; invoice: import('./types').Invoice }>(`/api/finance/invoices/${id}/duplicate`, {});
  },

  async recordPayment(id: string, data: {
    amount: number;
    receivedAt: string;
    method: string;
    transactionId?: string;
    notes?: string;
    attachments?: string[];
  }): Promise<{ success: boolean; message: string; data: { invoice: import('./types').Invoice; payment: any } }> {
    return api.post<{ success: boolean; message: string; data: { invoice: import('./types').Invoice; payment: any } }>(`/api/finance/invoices/${id}/payments`, data);
  },

  async getRecentPartyPrices(partyId: string, itemName?: string): Promise<{ success: boolean; prices: import('./types').RecentPricePoint[]; data: import('./types').RecentPricePoint[] }> {
    const qs = itemName ? `?item=${encodeURIComponent(itemName)}` : '';
    return api.get<{ success: boolean; prices: import('./types').RecentPricePoint[]; data: import('./types').RecentPricePoint[] }>(`/api/finance/parties/${partyId}/recent-prices${qs}`);
  },

  async convertToSalesInvoice(id: string): Promise<{ success: boolean; message: string; invoice: import('./types').Invoice }> {
    return api.post<{ success: boolean; message: string; invoice: import('./types').Invoice }>(`/api/finance/invoices/${id}/convert`, {});
  },

  async getPublicInvoice(token: string): Promise<{ success: boolean; invoice: import('./types').Invoice; data: import('./types').Invoice }> {
    return api.get<{ success: boolean; invoice: import('./types').Invoice; data: import('./types').Invoice }>(`/api/finance/invoices/public/${token}`);
  },

  getPdfDownloadUrl(id: string): string {
    return `/api/finance/invoices/${id}/pdf`;
  },

  getPublicPdfDownloadUrl(token: string): string {
    return `/api/finance/invoices/public/${token}/pdf`;
  },
};

export const bankAccountsApi = {
  async getBankAccounts(): Promise<{ success: boolean; data: import('./types').BankAccount[] }> {
    return api.get<{ success: boolean; data: import('./types').BankAccount[] }>('/api/finance/bank-accounts');
  },

  async createBankAccount(data: import('./types').CreateBankAccountPayload): Promise<{ success: boolean; data: import('./types').BankAccount }> {
    return api.post<{ success: boolean; data: import('./types').BankAccount }>('/api/finance/bank-accounts', data);
  },

  async updateBankAccount(id: string, data: Partial<import('./types').CreateBankAccountPayload>): Promise<{ success: boolean; data: import('./types').BankAccount }> {
    return api.patch<{ success: boolean; data: import('./types').BankAccount }>(`/api/finance/bank-accounts/${id}`, data);
  },

  async setDefault(id: string): Promise<{ success: boolean; data: import('./types').BankAccount }> {
    return api.patch<{ success: boolean; data: import('./types').BankAccount }>(`/api/finance/bank-accounts/${id}/default`, {});
  },

  async deleteBankAccount(id: string): Promise<{ success: boolean; message: string }> {
    return api.delete<{ success: boolean; message: string }>(`/api/finance/bank-accounts/${id}`);
  },
};


