'use client';

import React, { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useAuth } from '@/shared/auth/auth-context';
import { AttendanceWidget } from '@/modules/hr/components/attendance-widget';
import { useAdminDashboard } from '@/modules/dashboard/hooks/use-dashboard';
import type {
  MoneyMovementItem,
  ClientReceivableItem,
  VendorPayableItem,
  DashboardAlert,
} from '@/modules/dashboard/types';
import {
  formatPaise,
  formatPercent,
  formatDate,
} from '@/modules/finance/utils/formatters';
import { api } from '@/shared/api/client';
import { quotationsApi } from '@/modules/quotations/api';
import { getCampaigns } from '@/modules/campaigns/api';
import { getPurchaseOrders } from '@/modules/purchase-orders/api';
import { getVendors } from '@/modules/vendors/api';
import { getSites } from '@/modules/sites/api';
import type { Quotation } from '@/modules/quotations/types';
import type { Campaign } from '@/modules/campaigns/types';
import type { PurchaseOrder } from '@/modules/purchase-orders/types';
import type { Vendor } from '@/modules/vendors/types';
import type { Site } from '@/modules/sites/types';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowUpRight,
  TrendingUp,
  DollarSign,
  AlertCircle,
  FileText,
  CreditCard,
  Building2,
  MapPin,
  ShoppingCart,
  Megaphone,
  RefreshCw,
  ShieldCheck,
  Calendar,
  Lock,
  CheckCircle2,
  Clock,
  Layers,
  Bell,
  Eye,
  CheckCheck,
} from 'lucide-react';

interface NotificationItem {
  _id: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
  readAt?: string | null;
  createdAt: string;
}

export function FinanceDashboard() {
  const { user, hasPermission } = useAuth();
  const { data, loading, error, refresh } = useAdminDashboard();

  // Notifications state
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);

  // Sales & Operations Overview preview state
  const [salesOpsTab, setSalesOpsTab] = useState<
    'quotations' | 'campaigns' | 'purchase_orders' | 'vendors' | 'sites'
  >('quotations');

  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [salesOpsLoading, setSalesOpsLoading] = useState(false);

  // Receivables vs Payables active tab
  const [recPayTab, setRecPayTab] = useState<'receivables' | 'payables'>('receivables');

  // Today formatted
  const todayFormatted = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  // Permissions check
  const canViewProfit = hasPermission('profit.view') || hasPermission('financial_reports.view');
  const canViewPayroll = hasPermission('payroll.view') || hasPermission('salary.view');
  const canViewQuotations = hasPermission('quotations.view');
  const canViewCampaigns = hasPermission('campaigns.view');
  const canViewPOs = hasPermission('purchase_orders.view');
  const canViewVendors = hasPermission('vendors.view');
  const canViewSites = hasPermission('sites.view');

  // Load user notifications
  useEffect(() => {
    let mounted = true;
    async function fetchNotifications() {
      try {
        setNotifLoading(true);
        const res = await api.get<{ notifications: NotificationItem[] }>('/api/notifications?limit=8');
        if (mounted && res?.notifications) {
          setNotifications(res.notifications);
        }
      } catch (err) {
        // Fallback silently if notifications endpoint fails
      } finally {
        if (mounted) setNotifLoading(false);
      }
    }
    fetchNotifications();
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch Sales & Ops preview data according to active tab
  useEffect(() => {
    let mounted = true;

    async function loadTabPreview() {
      setSalesOpsLoading(true);
      try {
        if (salesOpsTab === 'quotations' && canViewQuotations && quotations.length === 0) {
          const res = await quotationsApi.list({ limit: 5 });
          if (mounted && res?.quotations) setQuotations(res.quotations.slice(0, 5));
        } else if (salesOpsTab === 'campaigns' && canViewCampaigns && campaigns.length === 0) {
          const res = await getCampaigns();
          if (mounted && res?.data) setCampaigns(res.data.slice(0, 5));
        } else if (salesOpsTab === 'purchase_orders' && canViewPOs && purchaseOrders.length === 0) {
          const res = await getPurchaseOrders();
          if (mounted && res?.data) setPurchaseOrders(res.data.slice(0, 5));
        } else if (salesOpsTab === 'vendors' && canViewVendors && vendors.length === 0) {
          const res = await getVendors();
          if (mounted && res?.data) setVendors(res.data.slice(0, 5));
        } else if (salesOpsTab === 'sites' && canViewSites && sites.length === 0) {
          const res = await getSites();
          if (mounted && Array.isArray(res)) setSites(res.slice(0, 5));
        }
      } catch (e) {
        // Silent failure in preview tab
      } finally {
        if (mounted) setSalesOpsLoading(false);
      }
    }

    loadTabPreview();
    return () => {
      mounted = false;
    };
  }, [salesOpsTab, canViewQuotations, canViewCampaigns, canViewPOs, canViewVendors, canViewSites]);

  async function markAllNotificationsRead() {
    try {
      await api.post('/api/notifications/read-all', {});
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })),
      );
    } catch {
      // Ignore
    }
  }

  if (!user) return null;

  const fin = data?.financialOverview;
  const recentMovement = data?.moneyMovement || [];
  const receivables = data?.expectedFromClients || [];
  const payables = data?.moneyToBePaidToVendors || [];
  const alerts = data?.alerts || [];

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* 1. Header Bar: Personalized Welcome & Finance Role Badge */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
              Finance Dashboard
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-[#6E1D1D] text-white shadow-2xs">
              Finance Role
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-amber-50 text-amber-900 border border-amber-200">
              <Lock className="w-3 h-3 text-amber-700" />
              <span>Read-Only on Sales & Ops</span>
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500 font-medium">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              <span>{todayFormatted}</span>
            </span>
            <span>·</span>
            <span className="font-semibold text-gray-700">{user.name}</span>
            <span>·</span>
            <span>Media Octus Enterprise CRM</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refresh()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-2xs disabled:opacity-50"
            title="Refresh financial data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#6E1D1D]' : ''}`} />
            <span>Refresh Metrics</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => refresh()}
            className="px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-900 rounded-md font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {/* 2. Attendance & Role Authority Snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-1">
          <div className="space-y-2">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">
              My Attendance & Punch
            </h2>
            <AttendanceWidget />
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="space-y-2">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">
              Finance Authority & Scoped Access
            </h2>
            <div className="bg-white rounded-xl border border-gray-200/80 p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3.5">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#6E1D1D]" />
                    <span>Authorized Finance Operations ({user.permissions.length} Permissions)</span>
                  </h3>
                  <p className="text-xs text-gray-500 font-medium mt-0.5">
                    Authorized actions are enforced server-side. Operational mutations are strictly blocked.
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                    {user.email}
                  </span>
                </div>
              </div>

              {/* Fast Jump Links */}
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
                <span className="text-gray-400">Quick Navigation:</span>
                <Link
                  href="/finance/invoices"
                  className="px-2.5 py-1 rounded-lg bg-[#F8E6E6] text-[#6E1D1D] hover:bg-[#F0D0D0] transition-colors"
                >
                  Invoices & Bills
                </Link>
                <Link
                  href="/finance/payments-in"
                  className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors"
                >
                  Client Payments
                </Link>
                <Link
                  href="/finance/payments-out"
                  className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-800 hover:bg-rose-100 transition-colors"
                >
                  Vendor Payouts
                </Link>
                <Link
                  href="/purchase-orders"
                  className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  Purchase Orders
                </Link>
                {canViewProfit && (
                  <Link
                    href="/finance/profit-dashboard"
                    className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 hover:bg-indigo-100 transition-colors"
                  >
                    Profit Analytics
                  </Link>
                )}
                {canViewPayroll && (
                  <Link
                    href="/finance/payroll"
                    className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-800 hover:bg-purple-100 transition-colors"
                  >
                    Payroll
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION A: Financial Summary */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span className="h-5 w-1 rounded-full bg-[#6E1D1D]" />
              <span>A. Financial Summary</span>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800">
                Live Server Audit
              </span>
            </h2>
            <p className="text-xs text-gray-500 font-medium">
              Real-time payment records, invoice balances, receipts, and obligations.
            </p>
          </div>
        </div>

        {fin ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Total Client Payments Received */}
            <div className="bg-white rounded-xl p-4.5 border border-emerald-200/80 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                    Client Payments Received
                  </span>
                  <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
                    <ArrowDownToLine className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-black text-emerald-700 tracking-tight">
                    {formatPaise(fin.totalClientPaymentsReceived)}
                  </div>
                  <p className="mt-1 text-[11px] text-gray-500">
                    Actual settled funds in bank accounts
                  </p>
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-emerald-100 flex items-center justify-between text-[11px]">
                <span className="text-emerald-700 font-medium">
                  {fin.reconciledPaymentsInCount} reconciled · {fin.unreconciledPaymentsInCount} pending
                </span>
                <Link
                  href="/finance/payments-in"
                  className="font-semibold text-[#6E1D1D] hover:underline flex items-center gap-0.5"
                >
                  <span>View</span>
                  <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* 2. Total Vendor Payments Made */}
            <div className="bg-white rounded-xl p-4.5 border border-rose-200/80 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-800 uppercase tracking-wider">
                    Vendor Payments Made
                  </span>
                  <div className="p-2 rounded-lg bg-rose-50 text-rose-600 border border-rose-100">
                    <ArrowUpFromLine className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-black text-rose-700 tracking-tight">
                    {formatPaise(fin.totalVendorPaymentsMade)}
                  </div>
                  <p className="mt-1 text-[11px] text-gray-500">
                    Total disbursed to media & production vendors
                  </p>
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-rose-100 flex items-center justify-between text-[11px]">
                <span className="text-rose-700 font-medium">
                  {fin.reconciledPaymentsOutCount} reconciled · {fin.unreconciledPaymentsOutCount} pending
                </span>
                <Link
                  href="/finance/payments-out"
                  className="font-semibold text-[#6E1D1D] hover:underline flex items-center gap-0.5"
                >
                  <span>View</span>
                  <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* 3. Outstanding Client Receivables */}
            <div className="bg-white rounded-xl p-4.5 border border-amber-200/80 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
                    Client Receivables
                  </span>
                  <div className="p-2 rounded-lg bg-amber-50 text-amber-600 border border-amber-100">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-black text-amber-900 tracking-tight">
                    {formatPaise(fin.clientOutstandingReceivables)}
                  </div>
                  <p className="mt-1 text-[11px] text-amber-800 font-semibold">
                    {fin.overdueInvoicesCount > 0 ? (
                      <span className="text-red-600">
                        {fin.overdueInvoicesCount} overdue ({formatPaise(fin.overdueReceivables)})
                      </span>
                    ) : (
                      'All current invoices within credit terms'
                    )}
                  </p>
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-amber-100 flex items-center justify-between text-[11px]">
                <span className="text-gray-500 font-medium">Pending collections</span>
                <Link
                  href="/finance/invoices?status=Overdue"
                  className="font-semibold text-[#6E1D1D] hover:underline flex items-center gap-0.5"
                >
                  <span>Overdue</span>
                  <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* 4. Outstanding Vendor Payables */}
            <div className="bg-white rounded-xl p-4.5 border border-blue-200/80 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">
                    Vendor Payables
                  </span>
                  <div className="p-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
                    <CreditCard className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-black text-blue-950 tracking-tight">
                    {formatPaise(fin.vendorOutstandingPayables)}
                  </div>
                  <p className="mt-1 text-[11px] text-gray-500">
                    Approved purchase order liabilities pending payout
                  </p>
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-blue-100 flex items-center justify-between text-[11px]">
                <span className="text-blue-700 font-medium">PO commitments</span>
                <Link
                  href="/purchase-orders"
                  className="font-semibold text-[#6E1D1D] hover:underline flex items-center gap-0.5"
                >
                  <span>POs</span>
                  <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* 5. Total Invoiced Amount */}
            <div className="bg-white rounded-xl p-4.5 border border-gray-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Total Invoiced Amount
                  </span>
                  <div className="p-2 rounded-lg bg-gray-50 text-gray-600 border border-gray-100">
                    <FileText className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-black text-gray-900 tracking-tight">
                    {formatPaise(fin.totalInvoicedAmount)}
                  </div>
                  <p className="mt-1 text-[11px] text-gray-500">
                    {fin.pendingInvoicesCount} invoices pending payment
                  </p>
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-[11px]">
                <span className="text-gray-500">Sales invoices</span>
                <Link
                  href="/finance/invoices"
                  className="font-semibold text-[#6E1D1D] hover:underline flex items-center gap-0.5"
                >
                  <span>Invoices</span>
                  <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* 6. Revenue vs Expenses */}
            <div className="bg-white rounded-xl p-4.5 border border-gray-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Revenue & Expenses
                  </span>
                  <div className="p-2 rounded-lg bg-gray-50 text-gray-600 border border-gray-100">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 font-medium">Revenue:</span>
                    <span className="font-bold text-gray-900">{formatPaise(fin.campaignRevenue)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 font-medium">Expenses:</span>
                    <span className="font-bold text-rose-600">{formatPaise(fin.campaignExpenses)}</span>
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-[11px]">
                <span className="text-gray-500">Sales revenue</span>
                <Link
                  href="/finance/sales-dashboard"
                  className="font-semibold text-[#6E1D1D] hover:underline flex items-center gap-0.5"
                >
                  <span>Reports</span>
                  <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* 7. Net Profit & Margin (Permission-Gated) */}
            {canViewProfit && (
              <div className="bg-white rounded-xl p-4.5 border border-emerald-200/80 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                      Net Profit & Margin
                    </span>
                    <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="text-2xl font-black text-emerald-700 tracking-tight">
                      {formatPaise(fin.netProfit)}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800">
                        {formatPercent(fin.averageMargin)} margin
                      </span>
                      <span className="text-[11px] text-gray-500">Authorized view</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-emerald-100 flex items-center justify-between text-[11px]">
                  <span className="text-gray-400">Profitability audit</span>
                  <Link
                    href="/finance/profit-dashboard"
                    className="font-semibold text-[#6E1D1D] hover:underline flex items-center gap-0.5"
                  >
                    <span>Audit</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            )}

            {/* 8. Pending Payroll / Salary (Permission-Gated) */}
            {canViewPayroll && (
              <div className="bg-white rounded-xl p-4.5 border border-purple-200/80 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-800 uppercase tracking-wider">
                      Pending Payroll
                    </span>
                    <div className="p-2 rounded-lg bg-purple-50 text-purple-600 border border-purple-100">
                      <CreditCard className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="text-2xl font-black text-purple-900 tracking-tight">
                      {formatPaise(fin.pendingPayrollAmount || 0)}
                    </div>
                    <p className="mt-1 text-[11px] text-purple-700 font-semibold">
                      {fin.pendingPayrollCount || 0} salary record(s) pending processing
                    </p>
                  </div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-purple-100 flex items-center justify-between text-[11px]">
                  <span className="text-purple-700">Salary obligations</span>
                  <Link
                    href="/finance/payroll"
                    className="font-semibold text-[#6E1D1D] hover:underline flex items-center gap-0.5"
                  >
                    <span>Payroll</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-8 rounded-xl bg-gray-50 border border-gray-200 text-center text-xs text-gray-500">
            {loading ? 'Auditing financial records...' : 'Financial summary metrics are restricted.'}
          </div>
        )}
      </section>

      {/* SECTION B: Financial Transactions (Money Movement Stream) */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span className="h-5 w-1 rounded-full bg-[#6E1D1D]" />
              <span>B. Financial Transactions (Authorized Money Movement)</span>
            </h2>
            <p className="text-xs text-gray-500 font-medium">
              Real-time audit log of authorized incoming receipts and outgoing vendor payouts.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <Link
              href="/finance/payments-in"
              className="text-[#6E1D1D] hover:underline font-semibold flex items-center gap-1"
            >
              <span>All Receipts</span>
              <ArrowUpRight className="w-3 h-3" />
            </Link>
            <span className="text-gray-300">·</span>
            <Link
              href="/finance/payments-out"
              className="text-[#6E1D1D] hover:underline font-semibold flex items-center gap-1"
            >
              <span>All Payouts</span>
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200/80 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Direction</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Client / Vendor</th>
                  <th className="py-3 px-4">Ref / Invoice</th>
                  <th className="py-3 px-4">Campaign</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {recentMovement.length > 0 ? (
                  recentMovement.slice(0, 8).map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap">
                        {tx.type === 'in' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <ArrowDownToLine className="w-3 h-3 text-emerald-600" />
                            <span>INCOMING</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                            <ArrowUpFromLine className="w-3 h-3 text-rose-600" />
                            <span>OUTGOING</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                        {formatDate(tx.date)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-gray-900 max-w-[180px] truncate">
                        {tx.partyName || '—'}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-gray-600 whitespace-nowrap">
                        {tx.refNumber || '—'}
                      </td>
                      <td className="py-3 px-4 text-gray-600 max-w-[180px] truncate">
                        {tx.campaignName || '—'}
                      </td>
                      <td className="py-3 px-4 text-gray-500 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-[10px] font-medium">
                          {tx.method || 'Bank Transfer'}
                        </span>
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-black whitespace-nowrap ${
                          tx.type === 'in' ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {tx.type === 'in' ? '+' : '-'}
                        {formatPaise(tx.amount)}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {tx.reconciled ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            <span>Reconciled</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-2.5 h-2.5" />
                            <span>Pending</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <Link
                          href={tx.type === 'in' ? '/finance/payments-in' : '/finance/payments-out'}
                          className="text-[#6E1D1D] hover:underline font-semibold text-xs inline-flex items-center gap-0.5"
                        >
                          <span>Open</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-xs text-gray-400">
                      No financial transactions recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* SECTION C: Receivables and Payables */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span className="h-5 w-1 rounded-full bg-[#6E1D1D]" />
              <span>C. Receivables and Payables Management</span>
            </h2>
            <p className="text-xs text-gray-500 font-medium">
              Client invoices awaiting payment and vendor liabilities awaiting settlement. Overdue payments prioritized.
            </p>
          </div>

          <div className="flex items-center rounded-xl bg-gray-100 p-1 border border-gray-200 text-xs font-semibold">
            <button
              onClick={() => setRecPayTab('receivables')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                recPayTab === 'receivables'
                  ? 'bg-white text-gray-900 shadow-2xs font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Client Receivables ({receivables.length})
            </button>
            <button
              onClick={() => setRecPayTab('payables')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                recPayTab === 'payables'
                  ? 'bg-white text-gray-900 shadow-2xs font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Vendor Payables ({payables.length})
            </button>
          </div>
        </div>

        {recPayTab === 'receivables' ? (
          <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs overflow-hidden">
            <div className="p-3.5 bg-gray-50/60 border-b border-gray-100 flex items-center justify-between text-xs">
              <span className="font-semibold text-gray-700">
                Invoices Awaiting Client Settlement ({receivables.length} Active Records)
              </span>
              <Link
                href="/finance/invoices"
                className="font-semibold text-[#6E1D1D] hover:underline flex items-center gap-1"
              >
                <span>View Invoices Module</span>
                <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/40 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Client Name</th>
                    <th className="py-3 px-4 text-right">Total Invoiced</th>
                    <th className="py-3 px-4 text-right">Received</th>
                    <th className="py-3 px-4 text-right">Remaining Balance</th>
                    <th className="py-3 px-4">Due Date</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {receivables.length > 0 ? (
                    receivables.map((item) => (
                      <tr
                        key={item.id}
                        className={`hover:bg-gray-50/60 transition-colors ${
                          item.isOverdue ? 'bg-red-50/30' : ''
                        }`}
                      >
                        <td className="py-3 px-4 font-mono font-bold text-[#6E1D1D]">
                          {item.invoiceNumber}
                        </td>
                        <td className="py-3 px-4 font-semibold text-gray-900 max-w-[200px] truncate">
                          {item.partyName}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-gray-600">
                          {formatPaise(item.totalAmount)}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-emerald-700">
                          {formatPaise(item.amountReceived)}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-rose-700">
                          {formatPaise(item.balanceAmount)}
                        </td>
                        <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                          {formatDate(item.dueDate)}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {item.isOverdue ? (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-100 text-red-800 border border-red-200">
                              OVERDUE
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                              {item.status || 'Pending'}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <Link
                            href={`/finance/invoices?search=${encodeURIComponent(item.invoiceNumber)}`}
                            className="text-[#6E1D1D] hover:underline font-semibold"
                          >
                            Open →
                          </Link>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-xs text-gray-400">
                        No pending client receivables recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs overflow-hidden">
            <div className="p-3.5 bg-gray-50/60 border-b border-gray-100 flex items-center justify-between text-xs">
              <span className="font-semibold text-gray-700">
                Vendor Obligations Awaiting Settlement ({payables.length} Active Records)
              </span>
              <Link
                href="/purchase-orders"
                className="font-semibold text-[#6E1D1D] hover:underline flex items-center gap-1"
              >
                <span>View Purchase Orders</span>
                <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/40 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Vendor Name</th>
                    <th className="py-3 px-4">PO / Reference</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-right">Total Committed</th>
                    <th className="py-3 px-4 text-right">Amount Paid</th>
                    <th className="py-3 px-4 text-right">Remaining Balance</th>
                    <th className="py-3 px-4">Due Date</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {payables.length > 0 ? (
                    payables.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="py-3 px-4 font-semibold text-gray-900 max-w-[200px] truncate">
                          {item.vendorName}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-blue-900">
                          {item.reference || 'PO'}
                        </td>
                        <td className="py-3 px-4 text-gray-500">
                          <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-[10px]">
                            {item.category || 'Printing/Mounting'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-gray-600">
                          {formatPaise(item.totalAmount)}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-emerald-700">
                          {formatPaise(item.amountPaid)}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-rose-700">
                          {formatPaise(item.balanceAmount)}
                        </td>
                        <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                          {formatDate(item.dueDate)}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <Link
                            href="/purchase-orders"
                            className="text-[#6E1D1D] hover:underline font-semibold"
                          >
                            Open →
                          </Link>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-xs text-gray-400">
                        No outstanding vendor payables found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* SECTION D: Finance Notifications & Pending Actionable Alerts */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span className="h-5 w-1 rounded-full bg-[#6E1D1D]" />
              <span>D. Finance Notifications and Actionable Alerts</span>
            </h2>
            <p className="text-xs text-gray-500 font-medium">
              Overdue notices, payment reconciliation flags, vendor deadlines, and system alerts.
            </p>
          </div>
          {notifications.some((n) => !n.readAt) && (
            <button
              onClick={markAllNotificationsRead}
              className="text-xs font-semibold text-[#6E1D1D] hover:underline flex items-center gap-1 self-start sm:self-auto"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark all read</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Actionable Alerts from Backend */}
          <div className="bg-white rounded-xl border border-gray-200/80 p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#6E1D1D]" />
              <span>System Action Items ({alerts.length})</span>
            </h3>

            {alerts.length > 0 ? (
              <div className="space-y-2.5">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-3 rounded-xl border text-xs flex items-start justify-between gap-3 ${
                      alert.type === 'danger'
                        ? 'bg-rose-50/70 border-rose-200 text-rose-900'
                        : alert.type === 'warning'
                        ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                        : 'bg-blue-50/70 border-blue-200 text-blue-900'
                    }`}
                  >
                    <div>
                      <div className="font-bold flex items-center gap-1.5">
                        <span>{alert.title}</span>
                        {alert.count !== undefined && alert.count > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full bg-white text-[10px] font-black shadow-2xs">
                            {alert.count}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] opacity-90 mt-0.5">{alert.description}</p>
                    </div>
                    <Link
                      href={alert.link}
                      className="shrink-0 font-bold underline hover:opacity-80 text-[11px] pt-0.5"
                    >
                      Resolve →
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-gray-400">
                No active finance action alerts. All accounts are reconciled and within limits.
              </div>
            )}
          </div>

          {/* User Notification Feed */}
          <div className="bg-white rounded-xl border border-gray-200/80 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                <Bell className="w-4 h-4 text-gray-500" />
                <span>Recent Notifications</span>
              </h3>
              <span className="text-[11px] text-gray-400">Live feed</span>
            </div>

            {notifications.length > 0 ? (
              <div className="space-y-2 max-h-72 overflow-y-auto no-scrollbar">
                {notifications.map((n) => (
                  <div
                    key={n._id}
                    className={`p-3 rounded-xl border text-xs transition-colors flex items-start justify-between gap-3 ${
                      !n.readAt
                        ? 'bg-[#FFF8F8] border-[#F0D0D0]'
                        : 'bg-gray-50/50 border-gray-100 text-gray-600'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-gray-900 flex items-center gap-2">
                        <span>{n.title}</span>
                        {!n.readAt && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#6E1D1D]" />
                        )}
                      </div>
                      {n.body && <p className="text-[11px] text-gray-500 mt-0.5">{n.body}</p>}
                      <span className="text-[10px] text-gray-400 mt-1 block">
                        {formatDate(n.createdAt)}
                      </span>
                    </div>
                    {n.link && (
                      <Link
                        href={n.link}
                        className="text-[11px] font-bold text-[#6E1D1D] hover:underline shrink-0"
                      >
                        Open
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-gray-400">
                {notifLoading ? 'Fetching notifications...' : 'No notifications received.'}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* SECTION E: Sales and Operations Overview (Strict Read-Only) */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span className="h-5 w-1 rounded-full bg-[#6E1D1D]" />
              <span>E. Sales & Operations Overview</span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                <Lock className="w-2.5 h-2.5 text-amber-600" />
                <span>Read-Only Audit</span>
              </span>
            </h2>
            <p className="text-xs text-gray-500 font-medium">
              Authorized view of sales quotations, client campaigns, purchase orders, vendors, and ATR sites for billing reconciliation.
            </p>
          </div>

          {/* Module Selector Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-gray-100 p-1 border border-gray-200 text-xs font-semibold">
            {canViewQuotations && (
              <button
                onClick={() => setSalesOpsTab('quotations')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                  salesOpsTab === 'quotations'
                    ? 'bg-white text-gray-900 shadow-2xs font-bold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Quotations</span>
              </button>
            )}

            {canViewCampaigns && (
              <button
                onClick={() => setSalesOpsTab('campaigns')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                  salesOpsTab === 'campaigns'
                    ? 'bg-white text-gray-900 shadow-2xs font-bold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Megaphone className="w-3.5 h-3.5" />
                <span>Campaigns</span>
              </button>
            )}

            {canViewPOs && (
              <button
                onClick={() => setSalesOpsTab('purchase_orders')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                  salesOpsTab === 'purchase_orders'
                    ? 'bg-white text-gray-900 shadow-2xs font-bold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Purchase Orders</span>
              </button>
            )}

            {canViewVendors && (
              <button
                onClick={() => setSalesOpsTab('vendors')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                  salesOpsTab === 'vendors'
                    ? 'bg-white text-gray-900 shadow-2xs font-bold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Vendors</span>
              </button>
            )}

            {canViewSites && (
              <button
                onClick={() => setSalesOpsTab('sites')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                  salesOpsTab === 'sites'
                    ? 'bg-white text-gray-900 shadow-2xs font-bold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>ATR / Sites</span>
              </button>
            )}
          </div>
        </div>

        {/* Read-only Enforcement Note */}
        <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-center justify-between text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>Finance Read-Only Mode:</strong> You are viewing live Sales & Operations data.
              Creation, edits, approvals, and deletions are permanently disabled for your role.
            </span>
          </div>
          <span className="text-[11px] font-semibold text-amber-800 bg-amber-100/70 px-2.5 py-0.5 rounded-md">
            Enforced by Server RBAC
          </span>
        </div>

        {/* Tab Content Tables */}
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs overflow-hidden">
          {salesOpsLoading ? (
            <div className="p-10 text-center text-xs text-gray-500">
              <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-[#6E1D1D] mb-2" />
              Loading authorized records...
            </div>
          ) : salesOpsTab === 'quotations' && canViewQuotations ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Quote #</th>
                    <th className="py-3 px-4">Client</th>
                    <th className="py-3 px-4">Subject / Campaign</th>
                    <th className="py-3 px-4 text-right">Grand Total</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">View Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {quotations.length > 0 ? (
                    quotations.map((q) => {
                      const quoteId = q._id || q.id || '';
                      return (
                        <tr key={quoteId} className="hover:bg-gray-50/60">
                          <td className="py-3 px-4 font-mono font-bold text-[#6E1D1D]">
                            {q.quoteNumber || quoteId.slice(-6)}
                          </td>
                          <td className="py-3 px-4 font-semibold text-gray-900">{q.clientName || '—'}</td>
                          <td className="py-3 px-4 text-gray-600 max-w-[200px] truncate">{q.notes || '—'}</td>
                          <td className="py-3 px-4 text-right font-bold text-gray-900">
                            {formatPaise(q.total)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-700">
                              {q.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Link
                              href="/quotations"
                              className="inline-flex items-center gap-1 text-xs font-semibold text-[#6E1D1D] hover:underline"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View (Read-Only)</span>
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs text-gray-400">
                        No quotations found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : salesOpsTab === 'campaigns' && canViewCampaigns ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Campaign Code</th>
                    <th className="py-3 px-4">Campaign Name</th>
                    <th className="py-3 px-4">Client</th>
                    <th className="py-3 px-4">Timeline</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">View Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {campaigns.length > 0 ? (
                    campaigns.map((c) => {
                      const clientLabel =
                        typeof c.leadId === 'object' && c.leadId
                          ? c.leadId.companyName || c.leadId.name || '—'
                          : '—';
                      return (
                        <tr key={c._id} className="hover:bg-gray-50/60">
                          <td className="py-3 px-4 font-mono font-bold text-[#6E1D1D]">
                            {c.campaignCode || c._id.slice(-6)}
                          </td>
                          <td className="py-3 px-4 font-semibold text-gray-900">{c.name}</td>
                          <td className="py-3 px-4 text-gray-600">{clientLabel}</td>
                          <td className="py-3 px-4 text-gray-500 text-[11px]">
                            {formatDate(c.startDate)} - {formatDate(c.endDate)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-700">
                              {c.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Link
                              href="/campaigns"
                              className="inline-flex items-center gap-1 text-xs font-semibold text-[#6E1D1D] hover:underline"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View (Read-Only)</span>
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs text-gray-400">
                        No campaigns found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : salesOpsTab === 'purchase_orders' && canViewPOs ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    <th className="py-3 px-4">PO #</th>
                    <th className="py-3 px-4">Vendor</th>
                    <th className="py-3 px-4">Campaign</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">View Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {purchaseOrders.length > 0 ? (
                    purchaseOrders.map((po) => (
                      <tr key={po._id} className="hover:bg-gray-50/60">
                        <td className="py-3 px-4 font-mono font-bold text-blue-900">{po.poNumber}</td>
                        <td className="py-3 px-4 font-semibold text-gray-900">{po.vendorName}</td>
                        <td className="py-3 px-4 text-gray-600 max-w-[200px] truncate">
                          {po.campaignName || '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-gray-900">
                          ₹{po.totalAmount.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-700">
                            {po.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Link
                            href="/purchase-orders"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#6E1D1D] hover:underline"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View (Read-Only)</span>
                          </Link>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs text-gray-400">
                        No purchase orders found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : salesOpsTab === 'vendors' && canViewVendors ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Vendor Name</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">City / State</th>
                    <th className="py-3 px-4">GST / PAN</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">View Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {vendors.length > 0 ? (
                    vendors.map((v) => (
                      <tr key={v._id} className="hover:bg-gray-50/60">
                        <td className="py-3 px-4 font-semibold text-gray-900">{v.name}</td>
                        <td className="py-3 px-4 text-gray-600">{v.contactPerson || v.email || '—'}</td>
                        <td className="py-3 px-4 text-gray-500">
                          {v.city ? `${v.city}, ` : ''}
                          {v.state || '—'}
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-gray-600">
                          {v.gstNumber || v.panNumber || '—'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800">
                            {v.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Link
                            href="/vendors"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#6E1D1D] hover:underline"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View (Read-Only)</span>
                          </Link>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs text-gray-400">
                        No vendors found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : salesOpsTab === 'sites' && canViewSites ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Site Code</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">Media Type</th>
                    <th className="py-3 px-4">City / State</th>
                    <th className="py-3 px-4 text-center">Availability</th>
                    <th className="py-3 px-4 text-right">View Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {sites.length > 0 ? (
                    sites.map((s) => (
                      <tr key={s._id} className="hover:bg-gray-50/60">
                        <td className="py-3 px-4 font-mono font-bold text-[#6E1D1D]">
                          {s.siteCode || s._id.slice(-6)}
                        </td>
                        <td className="py-3 px-4 font-semibold text-gray-900 max-w-[200px] truncate">
                          {s.location}
                        </td>
                        <td className="py-3 px-4 text-gray-600">{s.mediaType}</td>
                        <td className="py-3 px-4 text-gray-500">
                          {s.city ? `${s.city}, ` : ''}
                          {s.state || '—'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800">
                            {s.availability}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Link
                            href="/sites"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#6E1D1D] hover:underline"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View (Read-Only)</span>
                          </Link>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs text-gray-400">
                        No ATR sites found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-gray-500">
              You are not authorized to view this operational module.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
