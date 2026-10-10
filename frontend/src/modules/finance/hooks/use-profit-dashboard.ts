import { useState, useEffect, useCallback } from 'react';
import { financeApi } from '../api';
import type {
  CampaignFinance,
  ProfitTrendPoint,
  ExpenseBreakdown,
  FinanceSummary,
  FinanceAlert,
} from '../types';

export type TimeRange = 'today' | 'month' | 'quarter';

export interface ProfitDashboardData {
  totalProfit: number;
  margin: number;
  revenue: number;
  expenses: number;
  activeCount: number;
  trends: ProfitTrendPoint[];
  breakdown: ExpenseBreakdown | null;
  topCampaigns: CampaignFinance[];
  bottomCampaigns: CampaignFinance[];
  alerts: FinanceAlert[];
  summary: FinanceSummary | null;
}

export function useProfitDashboard(timeRange: TimeRange = 'month') {
  const [data, setData] = useState<ProfitDashboardData>({
    totalProfit: 0,
    margin: 0,
    revenue: 0,
    expenses: 0,
    activeCount: 0,
    trends: [],
    breakdown: null,
    topCampaigns: [],
    bottomCampaigns: [],
    alerts: [],
    summary: null,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const days = timeRange === 'today' ? 1 : timeRange === 'quarter' ? 90 : 30;

      const [summaryRes, trendsRes, breakdownRes, topRes, bottomRes] = await Promise.all([
        financeApi.getSummary(),
        financeApi.getProfitTrends(days),
        financeApi.getExpenseBreakdown(),
        financeApi.getProfitLeaderboard(10, 'profit'),
        financeApi.getLowMarginCampaigns(10),
      ]);

      const top = topRes.leaderboard || [];
      const bottom = bottomRes.lowMarginCampaigns || [];

      // Generate dynamic alerts based on profitability & low-margin warnings
      const alerts: FinanceAlert[] = [];

      // 1. Negative profit alerts (Red)
      const lossCampaigns = top.filter((c) => c.profit < 0);
      for (const c of lossCampaigns) {
        alerts.push({
          id: `loss-${c.campaignId}`,
          type: 'danger',
          title: `Loss Alert: ${c.campaignName || 'Campaign'}`,
          message: `Campaign is running at a loss of ₹${Math.abs(c.profit / 100).toLocaleString('en-IN')} (${c.margin}% margin). Review vendor pricing immediately.`,
          campaignId: c.campaignId,
          campaignName: c.campaignName,
          amount: c.profit,
          margin: c.margin,
          actionText: 'Review Campaign',
        });
      }

      // 2. Low margin alerts (Orange)
      const lowMarginCount = bottom.filter((c) => c.profit >= 0 && c.revenue > 0).length;
      if (lowMarginCount > 0) {
        alerts.push({
          id: 'low-margin-group',
          type: 'warning',
          title: `${lowMarginCount} Campaign(s) with margin < 10%`,
          message: `Low profit margin threshold reached. Consider negotiating vendor rates or adjusting client quotation markups.`,
          actionText: 'View Low Margin',
        });
      }

      // 3. Top performer highlight (Green)
      if (top.length > 0 && top[0].profit > 0) {
        const topPerformer = top[0];
        alerts.push({
          id: `top-${topPerformer.campaignId}`,
          type: 'success',
          title: `Top Performer: ${topPerformer.campaignName || 'Campaign'}`,
          message: `Generating ₹${(topPerformer.profit / 100).toLocaleString('en-IN')} net profit with an outstanding ${topPerformer.margin}% margin.`,
          campaignId: topPerformer.campaignId,
          campaignName: topPerformer.campaignName,
          amount: topPerformer.profit,
          margin: topPerformer.margin,
        });
      }

      setData({
        totalProfit: summaryRes.totalProfit || 0,
        margin: summaryRes.averageMargin || 0,
        revenue: summaryRes.totalRevenue || 0,
        expenses: summaryRes.totalExpenses || 0,
        activeCount: summaryRes.activeCampaignsCount || 0,
        trends: trendsRes.trends || [],
        breakdown: breakdownRes,
        topCampaigns: top.slice(0, 5),
        bottomCampaigns: bottom.slice(0, 5),
        alerts,
        summary: summaryRes,
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to load profit dashboard');
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchData();
    // Auto-refresh hourly
    const interval = setInterval(fetchData, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return { data, loading, error, refresh: fetchData };
}
