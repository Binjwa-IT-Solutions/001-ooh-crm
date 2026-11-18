import Campaign from '../modules/campaigns/campaign.model.js';
import { campaignFinanceService } from '../modules/finance/services/campaignFinance.service.js';
import { ProfitLog } from '../modules/finance/models/profitLog.model.js';
import { notifyMany } from '../core/notifications/index.js';
import { AuthUser } from '../core/auth/auth-model.js';

/**
 * F3 — PROFIT CALCULATION NIGHTLY JOB.
 *
 * Runs nightly at 11:59 PM (23:59).
 * Recalculates CampaignFinance rollups for all campaigns, creates daily snapshots
 * in `ProfitLog`, and sends notifications for loss or low-margin campaigns.
 */
export async function profitCalculationJob(): Promise<{
  processed: number;
  totalRevenue: number;
  totalExpenses: number;
  totalProfit: number;
  lossesCount: number;
  lowMarginCount: number;
}> {
  console.log('[job:profit-calculation] Starting nightly profit rollup...');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const campaigns = await Campaign.find({
    deletedAt: null,
  });

  let processed = 0;
  let totalRevenue = 0;
  let totalExpenses = 0;
  let totalProfit = 0;
  let lossesCount = 0;
  let lowMarginCount = 0;
  const alertNotes: string[] = [];

  for (const campaign of campaigns) {
    try {
      const finance = await campaignFinanceService.updateCampaignFinance(campaign._id);
      if (!finance) continue;

      processed += 1;
      totalRevenue += finance.revenue || 0;
      totalExpenses += finance.expenses || 0;
      totalProfit += finance.profit || 0;

      let notes = '';
      if (finance.profit < 0) {
        lossesCount += 1;
        notes = `Loss Alert: ₹${Math.abs(finance.profit / 100).toLocaleString('en-IN')} (${finance.margin}% margin)`;
        alertNotes.push(`${campaign.name}: ${notes}`);
      } else if (finance.margin < 10 && finance.revenue > 0) {
        lowMarginCount += 1;
        notes = `Low Margin Warning: ${finance.margin}%`;
      }

      // Upsert daily snapshot into ProfitLog
      await ProfitLog.findOneAndUpdate(
        {
          campaignId: campaign._id,
          logDate: today,
        },
        {
          campaignId: campaign._id,
          logDate: today,
          revenue: finance.revenue,
          expenses: finance.expenses,
          profit: finance.profit,
          margin: finance.margin,
          timestamp: new Date(),
          notes,
        },
        { upsert: true, new: true }
      );
    } catch (err) {
      console.error(`[job:profit-calculation] Error processing campaign ${campaign._id}:`, err);
    }
  }

  // If there are loss campaigns, notify leadership (Admin & Finance roles)
  if (lossesCount > 0) {
    try {
      const leadershipUsers = await AuthUser.find({
        role: { $in: ['admin', 'finance'] },
        status: 'Active',
        deletedAt: null,
      }).select('_id');

      if (leadershipUsers.length > 0) {
        await notifyMany(
          leadershipUsers.map((u) => u._id),
          {
            type: 'finance.loss_alert',
            title: 'Nightly Profit Alert: Unprofitable Campaigns Detected',
            body: `${lossesCount} campaign(s) are operating at a net loss today. Review the Profit Dashboard for details.`,
            link: '/finance/profit-dashboard',
          }
        );
      }
    } catch (err) {
      console.error('[job:profit-calculation] Failed to send leadership loss notification:', err);
    }
  }

  console.log(
    `[job:profit-calculation] Completed: ${processed} campaigns processed. ` +
    `Total Rev: ₹${(totalRevenue / 100).toLocaleString('en-IN')}, ` +
    `Total Exp: ₹${(totalExpenses / 100).toLocaleString('en-IN')}, ` +
    `Total Profit: ₹${(totalProfit / 100).toLocaleString('en-IN')}, ` +
    `Losses: ${lossesCount}, Low Margin: ${lowMarginCount}`
  );

  return {
    processed,
    totalRevenue,
    totalExpenses,
    totalProfit,
    lossesCount,
    lowMarginCount,
  };
}
