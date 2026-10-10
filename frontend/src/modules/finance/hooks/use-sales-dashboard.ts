import { useState, useEffect, useCallback } from 'react';
import { financeApi } from '../api';
import type { PaymentIn, RevenueByAgent, FinanceSummary, CampaignPaymentStatus, PaymentMethod } from '../types';

export interface SalesDashboardData {
  pipelineValue: number;
  receivedValue: number;
  gap: number;
  collectionRate: number;
  recentPayments: PaymentIn[];
  byAgent: RevenueByAgent[];
  byStatus: Record<CampaignPaymentStatus, number>;
  byMethod: Record<PaymentMethod, { count: number; amount: number }>;
  summary: FinanceSummary | null;
}

export function useSalesDashboard() {
  const [data, setData] = useState<SalesDashboardData>({
    pipelineValue: 0,
    receivedValue: 0,
    gap: 0,
    collectionRate: 0,
    recentPayments: [],
    byAgent: [],
    byStatus: { pending: 0, partial: 0, complete: 0 },
    byMethod: {
      bank_transfer: { count: 0, amount: 0 },
      cheque: { count: 0, amount: 0 },
      cash: { count: 0, amount: 0 },
      upi: { count: 0, amount: 0 },
      credit_card: { count: 0, amount: 0 },
    },
    summary: null,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [paymentsRes, agentsRes, summaryRes, leaderboardRes] = await Promise.all([
        financeApi.getPaymentsIn({ limit: 50 }),
        financeApi.getRevenueByAgent(),
        financeApi.getSummary(),
        financeApi.getProfitLeaderboard(100),
      ]);

      const payments = paymentsRes.payments || [];
      const summary = summaryRes;

      // Status breakdown from campaigns
      const byStatus: Record<CampaignPaymentStatus, number> = {
        pending: 0,
        partial: 0,
        complete: 0,
      };

      for (const cf of leaderboardRes.leaderboard || []) {
        if (cf.paymentStatus && byStatus[cf.paymentStatus] !== undefined) {
          byStatus[cf.paymentStatus]++;
        } else {
          byStatus.pending++;
        }
      }

      // Method breakdown
      const byMethod: Record<PaymentMethod, { count: number; amount: number }> = {
        bank_transfer: { count: 0, amount: 0 },
        cheque: { count: 0, amount: 0 },
        cash: { count: 0, amount: 0 },
        upi: { count: 0, amount: 0 },
        credit_card: { count: 0, amount: 0 },
      };

      for (const p of payments) {
        if (byMethod[p.method]) {
          byMethod[p.method].count++;
          byMethod[p.method].amount += p.amount;
        }
      }

      const pipelineTotal = summary.pipelineTotal || 0;
      const totalRevenue = summary.totalRevenue || 0;
      const gap = Math.max(0, pipelineTotal - totalRevenue);
      const collectionRate = pipelineTotal > 0 ? Math.round((totalRevenue / pipelineTotal) * 1000) / 10 : 0;

      setData({
        pipelineValue: pipelineTotal,
        receivedValue: totalRevenue,
        gap,
        collectionRate,
        recentPayments: payments.slice(0, 10),
        byAgent: agentsRes.revenueByAgent || [],
        byStatus,
        byMethod,
        summary,
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to load sales dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 15 minutes
    const interval = setInterval(fetchData, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return { data, loading, error, refresh: fetchData };
}
