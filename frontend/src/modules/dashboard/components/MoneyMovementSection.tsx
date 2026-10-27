'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Search,
  CheckCircle2,
  Clock,
  ArrowUpRight,
} from 'lucide-react';
import type { MoneyMovementItem } from '../types';
import { formatPaise, formatDate } from '@/modules/finance/utils/formatters';

interface MoneyMovementSectionProps {
  items: MoneyMovementItem[];
}

export function MoneyMovementSection({ items }: MoneyMovementSectionProps) {
  const [filterType, setFilterType] = useState<'all' | 'in' | 'out'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'reconciled' | 'pending'>('all');
  const [search, setSearch] = useState('');

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filterType !== 'all' && item.type !== filterType) return false;
      if (filterStatus === 'reconciled' && !item.reconciled) return false;
      if (filterStatus === 'pending' && item.reconciled) return false;

      if (search.trim()) {
        const query = search.toLowerCase();
        const matchParty = item.partyName.toLowerCase().includes(query);
        const matchRef = item.refNumber.toLowerCase().includes(query);
        const matchTxn = item.transactionId.toLowerCase().includes(query);
        const matchCamp = item.campaignName.toLowerCase().includes(query);
        if (!matchParty && !matchRef && !matchTxn && !matchCamp) return false;
      }

      return true;
    });
  }, [items, filterType, filterStatus, search]);

  return (
    <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs overflow-hidden">
      {/* Header & Controls */}
      <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3.5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-gray-900 tracking-tight">Money Movement</h2>
            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-slate-100 text-slate-700">
              {filteredItems.length} transactions
            </span>
          </div>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Audit trail of client receipts and vendor disbursements
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search party, ref..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#6E1D1D] w-36 sm:w-44"
            />
          </div>

          {/* Type tabs */}
          <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
            <button
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                filterType === 'all' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType('in')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                filterType === 'in' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              + In
            </button>
            <button
              onClick={() => setFilterType('out')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                filterType === 'out' ? 'bg-rose-600 text-white shadow-2xs' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              - Out
            </button>
          </div>

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as 'all' | 'reconciled' | 'pending')}
            className="text-xs py-1.5 px-3 rounded-lg border border-gray-200 bg-gray-50/50 text-gray-700"
          >
            <option value="all">All Statuses</option>
            <option value="reconciled">Reconciled</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      {filteredItems.length === 0 ? (
        <div className="p-8 text-center text-gray-400 text-xs">
          No transactions match your selected filter criteria.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/75 border-b border-gray-100 text-gray-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">Type</th>
                <th className="py-2.5 px-4">Party (Client / Vendor)</th>
                <th className="py-2.5 px-4">Reference / Invoice</th>
                <th className="py-2.5 px-4">Campaign</th>
                <th className="py-2.5 px-4 text-right">Amount</th>
                <th className="py-2.5 px-4">Method</th>
                <th className="py-2.5 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {filteredItems.map((tx) => {
                const isIncoming = tx.type === 'in';
                return (
                  <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                      {formatDate(tx.date)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isIncoming
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                            : 'bg-rose-50 text-rose-800 border border-rose-100'
                        }`}
                      >
                        {isIncoming ? (
                          <>
                            <ArrowDownToLine className="w-3 h-3 text-emerald-600" />
                            <span>Client Receipt (+)</span>
                          </>
                        ) : (
                          <>
                            <ArrowUpFromLine className="w-3 h-3 text-rose-600" />
                            <span>Vendor Payout (-)</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-900 font-semibold max-w-[160px] truncate">
                      {tx.partyName}
                    </td>
                    <td className="py-3 px-4 text-gray-600 font-mono text-[11px] whitespace-nowrap">
                      {tx.refNumber}
                    </td>
                    <td className="py-3 px-4 text-gray-500 max-w-[160px] truncate">
                      {tx.campaignName || '—'}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-bold whitespace-nowrap ${
                        isIncoming ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {isIncoming ? '+' : '-'} {formatPaise(tx.amount)}
                    </td>
                    <td className="py-3 px-4 text-gray-600 uppercase text-[10px] whitespace-nowrap">
                      {tx.method.replace('_', ' ')}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {tx.reconciled ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Reconciled</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                          <Clock className="w-3 h-3" />
                          <span>Pending</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Table Footer */}
      <div className="p-3 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
        <span>Showing latest real-time transactions</span>
        <div className="flex items-center gap-4">
          <Link href="/finance/payments-in" className="font-semibold text-[#6E1D1D] hover:underline flex items-center gap-1">
            <span>All Client Receipts</span>
            <ArrowUpRight className="w-3 h-3" />
          </Link>
          <Link href="/finance/payments-out" className="font-semibold text-[#6E1D1D] hover:underline flex items-center gap-1">
            <span>All Vendor Payments</span>
            <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
