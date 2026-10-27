'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  DollarSign,
  TrendingUp,
  ClipboardCheck,
  AlertCircle,
  FileText,
  Layers,
  ArrowUpRight,
  ShieldAlert,
} from 'lucide-react';
import type { FinancialOverview } from '../types';
import { formatPaise, formatPercent } from '@/modules/finance/utils/formatters';

interface FinancialOverviewCardsProps {
  overview: FinancialOverview;
}

export function FinancialOverviewCards({ overview }: FinancialOverviewCardsProps) {
  const isProfitable = overview.netProfit >= 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <span>Financial Overview & Cash Movement</span>
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800">
              Live Audit
            </span>
          </h2>
          <p className="text-xs text-gray-500 font-medium">
            Complete movement of money — receipts, payouts, outstanding balances, and net profitability
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Link
            href="/finance/payments-in"
            className="text-xs font-semibold text-[#6E1D1D] hover:underline flex items-center gap-1"
          >
            <span>Receipts</span>
            <ArrowUpRight className="w-3 h-3" />
          </Link>
          <span className="text-gray-300">·</span>
          <Link
            href="/finance/payments-out"
            className="text-xs font-semibold text-[#6E1D1D] hover:underline flex items-center gap-1"
          >
            <span>Payouts</span>
            <ArrowUpRight className="w-3 h-3" />
          </Link>
          <span className="text-gray-300">·</span>
          <Link
            href="/finance/invoices"
            className="text-xs font-semibold text-[#6E1D1D] hover:underline flex items-center gap-1"
          >
            <span>Invoices</span>
            <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Row 1: Core 4 Cash In / Out & Balance Pillars */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Client Payments Received */}
        <div className="bg-white rounded-xl p-4.5 border border-emerald-200/80 shadow-xs hover:shadow-md transition-shadow">
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
              {formatPaise(overview.totalClientPaymentsReceived)}
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500 font-medium">
              <span>Actual money collected</span>
              <span className="text-emerald-700 font-semibold">
                {overview.reconciledPaymentsInCount} reconciled
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-emerald-100/60 flex items-center justify-between text-[11px]">
            <span className="text-gray-400">Total Invoiced: {formatPaise(overview.totalInvoicedAmount, true)}</span>
            <Link href="/finance/payments-in" className="font-semibold text-emerald-700 hover:underline">
              View receipts →
            </Link>
          </div>
        </div>

        {/* 2. Vendor Payments Made */}
        <div className="bg-white rounded-xl p-4.5 border border-rose-200/80 shadow-xs hover:shadow-md transition-shadow">
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
              {formatPaise(overview.totalVendorPaymentsMade)}
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500 font-medium">
              <span>Actual disbursements</span>
              <span className="text-rose-700 font-semibold">
                {overview.reconciledPaymentsOutCount} reconciled
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-rose-100/60 flex items-center justify-between text-[11px]">
            <span className="text-gray-400">Billed: {formatPaise(overview.totalVendorBills, true)}</span>
            <Link href="/finance/payments-out" className="font-semibold text-rose-700 hover:underline">
              View payouts →
            </Link>
          </div>
        </div>

        {/* 3. Client Outstanding Receivables */}
        <div className="bg-white rounded-xl p-4.5 border border-amber-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
              Client Receivables Due
            </span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600 border border-amber-100">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-amber-800 tracking-tight">
              {formatPaise(overview.clientOutstandingReceivables)}
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500 font-medium">
              <span>Money to be received</span>
              <span className="text-amber-800 font-semibold">
                {overview.pendingInvoicesCount} invoices
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-amber-100/60 flex items-center justify-between text-[11px]">
            <span className="text-red-600 font-semibold">
              Overdue: {formatPaise(overview.overdueReceivables, true)}
            </span>
            <Link href="/finance/invoices" className="font-semibold text-amber-800 hover:underline">
              Review dues →
            </Link>
          </div>
        </div>

        {/* 4. Vendor Outstanding Payables */}
        <div className="bg-white rounded-xl p-4.5 border border-blue-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">
              Vendor Payables Due
            </span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-blue-800 tracking-tight">
              {formatPaise(overview.vendorOutstandingPayables)}
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500 font-medium">
              <span>Money yet to be paid</span>
              <span className="text-blue-800 font-semibold">POs & Bills</span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-blue-100/60 flex items-center justify-between text-[11px]">
            <span className="text-gray-400">Committed payouts</span>
            <Link href="/purchase-orders" className="font-semibold text-blue-800 hover:underline">
              Review POs →
            </Link>
          </div>
        </div>
      </div>

      {/* Row 2: Profitability & Business Performance Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Net Profit & Margin */}
        <div className="bg-white rounded-xl p-4.5 border border-gray-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              Net Profit
            </span>
            <div className={`p-2 rounded-lg border ${isProfitable ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className={`text-2xl font-black tracking-tight ${isProfitable ? 'text-emerald-700' : 'text-rose-700'}`}>
              {formatPaise(overview.netProfit)}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800">
                {formatPercent(overview.averageMargin)} margin
              </span>
              <span className="text-[11px] text-gray-500">Revenue minus expenses</span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-gray-100 text-[11px] text-gray-400 flex items-center justify-between">
            <span>Campaign profitability</span>
            <Link href="/finance/profit-dashboard" className="font-semibold text-[#6E1D1D] hover:underline">
              Audit margin →
            </Link>
          </div>
        </div>

        {/* Campaign Revenue & Expenses */}
        <div className="bg-white rounded-xl p-4.5 border border-gray-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              Revenue vs Expenses
            </span>
            <div className="p-2 rounded-lg bg-gray-50 text-gray-600 border border-gray-100">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 font-medium">Revenue:</span>
              <span className="font-bold text-gray-900">{formatPaise(overview.campaignRevenue)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 font-medium">Expenses:</span>
              <span className="font-bold text-rose-600">{formatPaise(overview.campaignExpenses)}</span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-gray-100 text-[11px] text-gray-400 flex items-center justify-between">
            <span>Operational ratio</span>
            <Link href="/finance/sales-dashboard" className="font-semibold text-[#6E1D1D] hover:underline">
              Revenue reports →
            </Link>
          </div>
        </div>

        {/* Contracted Pipeline */}
        <div className="bg-white rounded-xl p-4.5 border border-gray-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              Contracted Pipeline
            </span>
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
              <ClipboardCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-black text-indigo-950 tracking-tight">
              {formatPaise(overview.pipelineContracted)}
            </div>
            <p className="mt-1 text-[11px] text-gray-500">Total agreed campaign contract value</p>
          </div>
          <div className="mt-3 pt-2 border-t border-gray-100 text-[11px] text-gray-400 flex items-center justify-between">
            <span>Under contracted scope</span>
            <Link href="/campaigns" className="font-semibold text-[#6E1D1D] hover:underline">
              Campaigns →
            </Link>
          </div>
        </div>

        {/* Overdue Payment Risk Alert */}
        <div className={`bg-white rounded-xl p-4.5 border ${overview.overdueInvoicesCount > 0 ? 'border-red-300 bg-red-50/20' : 'border-gray-200/80'} shadow-xs flex flex-col justify-between`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-red-800 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
              <span>Overdue Risk</span>
            </span>
            <div className="p-2 rounded-lg bg-red-50 text-red-600 border border-red-100">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-black text-red-700 tracking-tight">
              {formatPaise(overview.overdueReceivables)}
            </div>
            <p className="mt-1 text-[11px] text-red-600 font-semibold">
              {overview.overdueInvoicesCount} invoice(s) past contract due date
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-red-100 text-[11px] flex items-center justify-between">
            <span className="text-gray-400">Needs immediate follow-up</span>
            <Link href="/finance/invoices?status=Overdue" className="font-semibold text-red-700 hover:underline">
              View overdue →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
