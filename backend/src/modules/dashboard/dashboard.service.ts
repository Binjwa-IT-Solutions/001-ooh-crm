import mongoose from 'mongoose';
import { Lead } from '../leads/leads.model.js';
import { Campaign } from '../campaigns/campaign.model.js';
import { Quotation } from '../quotations/quotations.model.js';
import { Site } from '../sites/site.model.js';
import { Vendor } from '../vendors/vendor.model.js';
import { PurchaseOrder } from '../purchase-orders/purchase-order.model.js';
import { Proof } from '../proofs/proof.model.js';
import { EscalationModel } from '../escalations/escalation.model.js';
import { Invoice } from '../finance/models/invoice.model.js';
import { PaymentIn } from '../finance/models/paymentIn.model.js';
import { PaymentOut } from '../finance/models/paymentOut.model.js';
import { CampaignFinance } from '../finance/models/campaignFinance.model.js';
import { campaignFinanceService } from '../finance/services/campaignFinance.service.js';
import { Payroll } from '../payroll/payroll.model.js';

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
  trends: any[] | null;
  alerts: DashboardAlert[];
}

export const dashboardService = {
  async getOverview(permissions: readonly string[], role: string): Promise<AdminDashboardData> {
    const hasPerm = (p: string) => permissions.includes(p);
    const hasFinanceView = hasPerm('finance.view') || hasPerm('finance.view_payments') || hasPerm('finance.view_reports');
    const hasFinanceReports = hasPerm('finance.view_reports') || hasPerm('finance.view_leadership_reports');

    const businessSummary: BusinessSummary = {};
    const alerts: DashboardAlert[] = [];

    // Parallel fetch for permitted modules
    const tasks: Promise<void>[] = [];

    // Leads & Clients
    if (hasPerm('leads.view')) {
      tasks.push(
        (async () => {
          const [totalLeads, totalClients] = await Promise.all([
            Lead.countDocuments({ deletedAt: null }),
            Lead.countDocuments({ status: 'Won', deletedAt: null }),
          ]);
          businessSummary.totalLeads = totalLeads;
          businessSummary.totalClients = totalClients;
        })()
      );
    }

    // Campaigns
    if (hasPerm('campaigns.view')) {
      tasks.push(
        (async () => {
          const [totalCampaigns, activeCampaigns] = await Promise.all([
            Campaign.countDocuments({ deletedAt: null }),
            Campaign.countDocuments({
              status: { $in: ['Approved' as any, 'InProgress' as any] },
              deletedAt: null,
            }),
          ]);
          businessSummary.totalCampaigns = totalCampaigns;
          businessSummary.activeCampaigns = activeCampaigns;
        })()
      );
    }

    // Quotations
    if (hasPerm('quotations.view')) {
      tasks.push(
        (async () => {
          const [totalQuotations, pendingQuotations] = await Promise.all([
            Quotation.countDocuments({ deletedAt: null }),
            Quotation.countDocuments({
              status: { $in: ['Draft', 'Sent'] },
              deletedAt: null,
            }),
          ]);
          businessSummary.totalQuotations = totalQuotations;
          businessSummary.pendingQuotations = pendingQuotations;

          if (pendingQuotations > 0) {
            alerts.push({
              id: 'pending-quotations',
              type: 'info',
              title: 'Pending Quotations',
              description: `${pendingQuotations} quotation(s) are awaiting client response or approval`,
              count: pendingQuotations,
              link: '/quotations',
            });
          }
        })()
      );
    }

    // Sites / ATR
    if (hasPerm('sites.view')) {
      tasks.push(
        (async () => {
          const [totalSites, activeSites] = await Promise.all([
            Site.countDocuments({ deletedAt: null }),
            Site.countDocuments({ availability: 'Available' as any, deletedAt: null }),
          ]);
          businessSummary.totalSites = totalSites;
          businessSummary.activeSites = activeSites;
        })()
      );
    }

    // Vendors
    if (hasPerm('vendors.view')) {
      tasks.push(
        (async () => {
          const totalVendors = await Vendor.countDocuments({
            status: 'Active',
            deletedAt: null,
          });
          businessSummary.totalVendors = totalVendors;
        })()
      );
    }

    // Tasks / Escalations
    if (hasPerm('tasks.view')) {
      tasks.push(
        (async () => {
          const pendingTasks = await EscalationModel.countDocuments();
          businessSummary.pendingTasks = pendingTasks;

          if (pendingTasks > 0) {
            alerts.push({
              id: 'active-escalations',
              type: 'warning',
              title: 'Operational Escalations',
              description: `${pendingTasks} active SLA escalation(s) require supervisor attention`,
              count: pendingTasks,
              link: '/escalations',
            });
          }
        })()
      );
    }

    // Proofs
    if (hasPerm('proofs.view')) {
      tasks.push(
        (async () => {
          const pendingProofs = await Proof.countDocuments({ status: 'Pending' });
          businessSummary.pendingProofs = pendingProofs;

          if (pendingProofs > 0) {
            alerts.push({
              id: 'pending-proofs',
              type: 'warning',
              title: 'Pending Proofs of Display',
              description: `${pendingProofs} proof photo(s) submitted awaiting approval`,
              count: pendingProofs,
              link: '/proofs',
            });
          }
        })()
      );
    }

    let financialOverview: FinancialOverview | null = null;
    let expectedFromClients: ClientReceivableItem[] | null = null;
    let moneyToBePaidToVendors: VendorPayableItem[] | null = null;
    let moneyMovement: MoneyMovementItem[] | null = null;
    let trends: any[] | null = null;

    if (hasFinanceView) {
      tasks.push(
        (async () => {
          const now = new Date();

          const [
            paymentsIn,
            paymentsOut,
            invoices,
            campaignFinances,
            purchaseOrders,
            vendorsList,
          ] = await Promise.all([
            PaymentIn.find({ deletedAt: null })
              .populate('clientId', 'companyName')
              .populate('campaignId', 'name campaignCode')
              .sort({ receivedAt: -1 })
              .lean(),
            PaymentOut.find({ deletedAt: null })
              .populate('vendorId', 'name')
              .populate('campaignId', 'name campaignCode')
              .sort({ paidAt: -1 })
              .lean(),
            Invoice.find({
              deletedAt: null,
              isDeleted: { $ne: true },
              status: { $nin: ['Cancelled', 'cancelled'] as any },
            })
              .sort({ dueDate: 1 })
              .lean(),
            CampaignFinance.find({ deletedAt: null }).lean(),
            PurchaseOrder.find({ deletedAt: null }).populate('vendorId', 'name').lean(),
            Vendor.find({ deletedAt: null }).select('_id name').lean(),
          ]);

          // Vendor ID to name lookup map
          const vendorMap = new Map<string, string>();
          for (const v of vendorsList) {
            vendorMap.set(String(v._id), (v as any).name || 'Vendor');
          }

          // 1. Total Client Payments Received (actual PaymentIn transactions)
          let totalClientPaymentsReceived = 0;
          let reconciledPaymentsInCount = 0;
          let unreconciledPaymentsInCount = 0;
          for (const p of paymentsIn) {
            totalClientPaymentsReceived += p.amount || 0;
            if (p.reconciled) reconciledPaymentsInCount++;
            else unreconciledPaymentsInCount++;
          }

          // 2. Total Vendor Payments Made (actual PaymentOut transactions)
          let totalVendorPaymentsMade = 0;
          let reconciledPaymentsOutCount = 0;
          let unreconciledPaymentsOutCount = 0;
          for (const p of paymentsOut) {
            totalVendorPaymentsMade += p.amount || 0;
            if (p.reconciled) reconciledPaymentsOutCount++;
            else unreconciledPaymentsOutCount++;
          }

          // 3. Invoices metrics
          let totalInvoicedAmount = 0;
          let clientOutstandingReceivables = 0;
          let overdueReceivables = 0;
          let overdueInvoicesCount = 0;
          let pendingInvoicesCount = 0;

          const clientReceivablesList: ClientReceivableItem[] = [];

          for (const inv of invoices) {
            const total = inv.totalAmount || 0;
            const received = inv.amountReceived || 0;
            const balance = inv.balanceAmount !== undefined ? inv.balanceAmount : Math.max(0, total - received);

            totalInvoicedAmount += total;

            const isPaid = ['paid', 'Paid'].includes(inv.status) || balance <= 0;
            if (!isPaid) {
              clientOutstandingReceivables += balance;
              pendingInvoicesCount++;

              const dueDate = inv.dueDate ? new Date(inv.dueDate) : null;
              const isOverdue =
                ['overdue', 'Overdue'].includes(inv.status) || (Boolean(dueDate) && dueDate! < now);

              if (isOverdue) {
                overdueReceivables += balance;
                overdueInvoicesCount++;
              }

              clientReceivablesList.push({
                id: String(inv._id),
                invoiceNumber: inv.invoiceNumber || 'INV',
                partyName: inv.partyName || 'Client',
                totalAmount: total,
                amountReceived: received,
                balanceAmount: balance,
                dueDate: inv.dueDate ? new Date(inv.dueDate).toISOString() : '',
                status: inv.status,
                isOverdue,
              });
            }
          }

          // Sort expected receivables: overdue first, then largest balance
          clientReceivablesList.sort((a, b) => {
            if (a.isOverdue && !b.isOverdue) return -1;
            if (!a.isOverdue && b.isOverdue) return 1;
            return b.balanceAmount - a.balanceAmount;
          });
          expectedFromClients = clientReceivablesList.slice(0, 10);

          // 4. Campaign Finance metrics
          let campaignRevenue = 0;
          let campaignExpenses = 0;
          let netProfit = 0;
          let pipelineContracted = 0;
          let lowMarginCount = 0;

          for (const cf of campaignFinances) {
            campaignRevenue += cf.revenue || 0;
            campaignExpenses += cf.expenses || 0;
            netProfit += cf.profit || 0;
            pipelineContracted += cf.contractedValue || 0;
            if (cf.margin < 15 && cf.margin !== 0) {
              lowMarginCount++;
            }
          }

          // Fallback if no campaignFinances calculated yet
          if (campaignRevenue === 0 && totalClientPaymentsReceived > 0) {
            campaignRevenue = totalClientPaymentsReceived;
            campaignExpenses = totalVendorPaymentsMade;
            netProfit = campaignRevenue - campaignExpenses;
          }

          const averageMargin = campaignRevenue > 0
            ? Math.round(((netProfit / campaignRevenue) * 100) * 100) / 100
            : 0;

          // 5. Vendor payables from Purchase Orders & Payments Out
          let vendorOutstandingPayables = 0;
          let totalVendorBills = totalVendorPaymentsMade;
          const vendorPayablesList: VendorPayableItem[] = [];

          for (const po of purchaseOrders) {
            const poTotalInPaise = Math.round((po.totalAmount || 0) * 100);
            totalVendorBills += poTotalInPaise;
            const vendorName = (po.vendorId as any)?.name || vendorMap.get(String(po.vendorId)) || 'Vendor';

            if (po.status !== 'Cancelled') {
              vendorOutstandingPayables += poTotalInPaise;
              vendorPayablesList.push({
                id: String(po._id),
                vendorName,
                reference: po.poNumber || 'PO',
                totalAmount: poTotalInPaise,
                amountPaid: 0,
                balanceAmount: poTotalInPaise,
                dueDate: po.validityTo ? new Date(po.validityTo).toISOString() : (po.createdAt ? new Date(po.createdAt).toISOString() : ''),
                status: po.status,
                category: 'Media / Site Booking',
                method: 'Bank Transfer',
              });
            }
          }

          // Also include recent vendor payment records for transparency
          for (const p of paymentsOut.slice(0, 5)) {
            const vName = (p.vendorId as any)?.name || vendorMap.get(String((p as any).vendorId)) || 'Vendor';
            vendorPayablesList.push({
              id: String(p._id),
              vendorName: vName,
              reference: p.vendorInvoice || p.transactionId || 'Payout',
              totalAmount: p.amount,
              amountPaid: p.amount,
              balanceAmount: 0,
              dueDate: p.paidAt ? new Date(p.paidAt).toISOString() : '',
              status: p.reconciled ? 'Reconciled' : 'Recorded',
              category: p.category || 'Vendor Expense',
              method: p.method,
            });
          }

          moneyToBePaidToVendors = vendorPayablesList.slice(0, 10);

          financialOverview = {
            totalClientPaymentsReceived,
            totalVendorPaymentsMade,
            clientOutstandingReceivables,
            vendorOutstandingPayables,
            totalInvoicedAmount,
            totalVendorBills,
            campaignRevenue,
            campaignExpenses,
            netProfit,
            averageMargin,
            pipelineContracted,
            overdueReceivables,
            overdueInvoicesCount,
            pendingInvoicesCount,
            reconciledPaymentsInCount,
            unreconciledPaymentsInCount,
            reconciledPaymentsOutCount,
            unreconciledPaymentsOutCount,
          };

          // 6. Money Movement: unified transactions
          const movement: MoneyMovementItem[] = [];

          for (const pin of paymentsIn.slice(0, 20)) {
            const clientName = (pin.clientId as any)?.companyName || 'Client';
            const campaignName = (pin.campaignId as any)?.name || '';
            movement.push({
              id: String(pin._id),
              type: 'in',
              date: pin.receivedAt ? new Date(pin.receivedAt).toISOString() : new Date().toISOString(),
              partyName: clientName,
              refNumber: pin.transactionId || 'Payment In',
              campaignName,
              amount: pin.amount,
              method: pin.method,
              transactionId: pin.transactionId || '',
              reconciled: pin.reconciled,
              status: pin.reconciled ? 'Reconciled' : 'Pending Verification',
            });
          }

          for (const pout of paymentsOut.slice(0, 20)) {
            const vendorName = (pout.vendorId as any)?.name || vendorMap.get(String((pout as any).vendorId)) || 'Vendor';
            const campaignName = (pout.campaignId as any)?.name || '';
            movement.push({
              id: String(pout._id),
              type: 'out',
              date: pout.paidAt ? new Date(pout.paidAt).toISOString() : new Date().toISOString(),
              partyName: vendorName,
              refNumber: pout.vendorInvoice || pout.transactionId || 'Payment Out',
              campaignName,
              amount: pout.amount,
              method: pout.method,
              transactionId: pout.transactionId || '',
              reconciled: pout.reconciled,
              status: pout.reconciled ? 'Reconciled' : 'Pending Reconcile',
            });
          }

          movement.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          moneyMovement = movement.slice(0, 25);

          // Operational Alerts related to finance
          if (overdueInvoicesCount > 0) {
            alerts.push({
              id: 'overdue-invoices',
              type: 'danger',
              title: 'Overdue Client Invoices',
              description: `${overdueInvoicesCount} invoice(s) totaling ₹${(overdueReceivables / 100).toLocaleString('en-IN')} are past due date`,
              count: overdueInvoicesCount,
              link: '/finance/invoices?status=Overdue',
            });
          }

          if (lowMarginCount > 0) {
            alerts.push({
              id: 'low-margin-campaigns',
              type: 'warning',
              title: 'Low Margin Campaigns',
              description: `${lowMarginCount} active campaign(s) running below 15% profit margin`,
              count: lowMarginCount,
              link: '/finance/profit-dashboard',
            });
          }

          if (unreconciledPaymentsInCount > 0) {
            alerts.push({
              id: 'unreconciled-payments-in',
              type: 'info',
              title: 'Unreconciled Client Payments',
              description: `${unreconciledPaymentsInCount} client payment(s) require bank reconciliation`,
              count: unreconciledPaymentsInCount,
              link: '/finance/payments-in',
            });
          }

          if (unreconciledPaymentsOutCount > 0) {
            alerts.push({
              id: 'unreconciled-payments-out',
              type: 'info',
              title: 'Unreconciled Vendor Payments',
              description: `${unreconciledPaymentsOutCount} vendor payment(s) require bank reconciliation`,
              count: unreconciledPaymentsOutCount,
              link: '/finance/payments-out',
            });
          }

          if (vendorOutstandingPayables > 0) {
            alerts.push({
              id: 'upcoming-vendor-payables',
              type: 'warning',
              title: 'Upcoming Vendor Payables',
              description: `₹${(vendorOutstandingPayables / 100).toLocaleString('en-IN')} outstanding across vendor purchase orders`,
              link: '/finance/payments-out',
            });
          }
        })()
      );
    }

    // Payroll / Salary pending calculations
    if (hasPerm('payroll.view') || hasPerm('salary.view')) {
      tasks.push(
        (async () => {
          try {
            const pendingPayrolls = await Payroll.find({
              status: { $in: ['Draft', 'Pending', 'Processed'] },
              deletedAt: null,
            }).lean();

            let pendingPayrollAmount = 0;
            const pendingPayrollCount = pendingPayrolls.length;
            for (const pr of pendingPayrolls) {
              pendingPayrollAmount += Math.round((pr.netPayable || 0) * 100); // in paise
            }

            if (financialOverview) {
              (financialOverview as FinancialOverview).pendingPayrollAmount = pendingPayrollAmount;
              (financialOverview as FinancialOverview).pendingPayrollCount = pendingPayrollCount;
            }

            if (pendingPayrollCount > 0) {
              alerts.push({
                id: 'pending-payroll',
                type: 'warning',
                title: 'Pending Payroll Disbursements',
                description: `${pendingPayrollCount} salary payout(s) totaling ₹${(pendingPayrollAmount / 100).toLocaleString('en-IN')} awaiting disbursement`,
                count: pendingPayrollCount,
                link: '/finance/payroll',
              });
            }
          } catch (pErr) {
            console.warn('[dashboardService] failed to fetch payroll stats:', pErr);
          }
        })()
      );
    }

    // Trends (reused from existing campaign finance service)
    if (hasFinanceReports) {
      tasks.push(
        (async () => {
          try {
            trends = await campaignFinanceService.getProfitTrends(undefined, 30);
          } catch (err) {
            console.warn('[dashboardService] failed to fetch profit trends:', err);
            trends = [];
          }
        })()
      );
    }

    await Promise.all(tasks);

    return {
      userRole: role,
      permissions: [...permissions],
      businessSummary,
      financialOverview,
      expectedFromClients,
      moneyToBePaidToVendors,
      moneyMovement,
      trends,
      alerts,
    };
  },
};
