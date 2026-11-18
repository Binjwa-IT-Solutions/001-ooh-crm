'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowDownToLine,
  ArrowUpRight,
  AlertTriangle,
  Calendar,
} from 'lucide-react';
import type { ClientReceivableItem, VendorPayableItem } from '../types';
import { formatPaise, formatDate } from '@/modules/finance/utils/formatters';

interface CashFlowExpectationsProps {
  expectedFromClients: ClientReceivableItem[];
  moneyToBePaidToVendors: VendorPayableItem[];
}

export function CashFlowExpectations({
  expectedFromClients,
  moneyToBePaidToVendors,
}: CashFlowExpectationsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* 6.A Money Expected From Clients */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs overflow-hidden flex flex-col justify-between">
        <div>
          <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
                <ArrowDownToLine className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 tracking-tight">
                  Money Expected From Clients (Receivables)
                </h3>
                <p className="text-[11px] text-gray-500 font-medium">
                  Outstanding sales invoices awaiting payment collection
                </p>
              </div>
            </div>
            <Link
              href="/finance/invoices"
              className="text-xs font-semibold text-[#6E1D1D] hover:underline flex items-center gap-1"
            >
              <span>All Invoices</span>
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          {expectedFromClients.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-xs">
              No pending client invoices. All collections are up to date!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50/75 border-b border-gray-100 text-gray-500 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3.5">Client & Invoice</th>
                    <th className="py-2.5 px-3">Due Date</th>
                    <th className="py-2.5 px-3 text-right">Invoice Total</th>
                    <th className="py-2.5 px-3 text-right">Balance Due</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {expectedFromClients.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-gray-50/60 transition-colors group cursor-pointer"
                    >
                      <td className="py-2.5 px-3.5">
                        <Link
                          href={`/finance/invoices/${item.id}`}
                          className="group-hover:text-[#6E1D1D] transition-colors"
                        >
                          <div className="font-bold text-gray-900 line-clamp-1">{item.partyName}</div>
                          <div className="text-[11px] font-mono text-gray-500">{item.invoiceNumber}</div>
                        </Link>
                      </td>
                      <td className="py-2.5 px-3 text-gray-600 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-[11px]">
                          <Calendar className="w-3 h-3 text-gray-400" />
                          <span>{formatDate(item.dueDate)}</span>
                        </div>
                        {item.isOverdue && (
                          <span className="text-[10px] font-bold text-red-600 flex items-center gap-0.5 mt-0.5">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            Overdue
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right text-gray-600 whitespace-nowrap">
                        {formatPaise(item.totalAmount)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-amber-900 whitespace-nowrap">
                        {formatPaise(item.balanceAmount)}
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                            item.isOverdue
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {item.isOverdue ? 'Overdue' : item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="p-3 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
          <span>Priority sorted by overdue & high-value balances</span>
          <Link href="/finance/invoices?status=Overdue" className="font-semibold text-red-700 hover:underline">
            View overdue queue →
          </Link>
        </div>
      </div>

      {/* 6.B Money to Be Paid to Vendors */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs overflow-hidden flex flex-col justify-between">
        <div>
          <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-rose-50 text-rose-700 border border-rose-100">
                <ArrowUpRight className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 tracking-tight">
                  Money to Be Paid to Vendors (Payables)
                </h3>
                <p className="text-[11px] text-gray-500 font-medium">
                  Committed purchase orders, site rentals & bills due
                </p>
              </div>
            </div>
            <Link
              href="/purchase-orders"
              className="text-xs font-semibold text-[#6E1D1D] hover:underline flex items-center gap-1"
            >
              <span>All POs</span>
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          {moneyToBePaidToVendors.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-xs">
              No pending vendor payables or purchase orders.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50/75 border-b border-gray-100 text-gray-500 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3.5">Vendor & Reference</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3 text-right">Committed</th>
                    <th className="py-2.5 px-3 text-right">Balance Due</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {moneyToBePaidToVendors.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-gray-50/60 transition-colors group cursor-pointer"
                    >
                      <td className="py-2.5 px-3.5">
                        <Link
                          href="/purchase-orders"
                          className="group-hover:text-[#6E1D1D] transition-colors"
                        >
                          <div className="font-bold text-gray-900 line-clamp-1">{item.vendorName}</div>
                          <div className="text-[11px] font-mono text-gray-500">{item.reference}</div>
                        </Link>
                      </td>
                      <td className="py-2.5 px-3 text-gray-600 whitespace-nowrap text-[11px]">
                        {formatDate(item.dueDate)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-gray-600 whitespace-nowrap">
                        {formatPaise(item.totalAmount)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-rose-900 whitespace-nowrap">
                        {formatPaise(item.balanceAmount)}
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                            item.balanceAmount > 0
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="p-3 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
          <span>Outdoor site rent, fabrication & logistics liabilities</span>
          <Link href="/finance/payments-out" className="font-semibold text-[#6E1D1D] hover:underline">
            Record payment out →
          </Link>
        </div>
      </div>
    </div>
  );
}
