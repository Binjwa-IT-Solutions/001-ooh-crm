'use client';

import React, { useEffect, useState } from 'react';
import { X, CheckCircle, TrendingUp, AlertTriangle, Layers, FileText } from 'lucide-react';
import { financeApi } from '../api';
import type { CampaignFinance, PaymentIn, PaymentOut, ExpenseBreakdown } from '../types';
import { formatPaise, formatPercent, formatDate } from '../utils/formatters';

interface CampaignDetailModalProps {
  campaignId: string | null;
  onClose: () => void;
}

export function CampaignDetailModal({ campaignId, onClose }: CampaignDetailModalProps) {
  const [finance, setFinance] = useState<CampaignFinance | null>(null);
  const [paymentsIn, setPaymentsIn] = useState<PaymentIn[]>([]);
  const [paymentsOut, setPaymentsOut] = useState<PaymentOut[]>([]);
  const [breakdown, setBreakdown] = useState<ExpenseBreakdown | null>(null);
  const [loading, setLoading] = useState(true);

  const isValidId = Boolean(
    campaignId &&
    campaignId !== 'undefined' &&
    campaignId !== 'null' &&
    /^[0-9a-fA-F]{24}$/.test(campaignId.trim())
  );

  useEffect(() => {
    if (!isValidId || !campaignId) return;

    let mounted = true;
    setLoading(true);

    Promise.all([
      financeApi.getCampaignFinance(campaignId),
      financeApi.getPaymentsIn({ campaignId, limit: 10 }),
      financeApi.getPaymentsOut({ campaignId, limit: 10 }),
      financeApi.getExpenseBreakdown(campaignId),
    ])
      .then(([fRes, inRes, outRes, bRes]) => {
        if (!mounted) return;
        setFinance(fRes.finance);
        setPaymentsIn(inRes.payments || []);
        setPaymentsOut(outRes.payments || []);
        setBreakdown(bRes);
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [campaignId, isValidId]);

  if (!isValidId || !campaignId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-100 animate-in fade-in zoom-in duration-200">
        {/* Modal Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-xs font-mono font-bold bg-red-100 text-[#A4161A] rounded">
                {finance?.campaignCode || 'CAMPAIGN'}
              </span>
              <h2 className="text-lg font-bold text-gray-900">
                {finance?.campaignName || 'Campaign Financial Rollup'}
              </h2>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Complete profit & loss audit breakdown • Calculated nightly
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {loading ? (
            <div className="h-64 flex items-center justify-center text-gray-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E63946]" />
            </div>
          ) : finance ? (
            <>
              {/* Summary KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Contract Value</span>
                  <div className="text-lg font-bold text-gray-900 mt-1">
                    {formatPaise(finance.contractedValue)}
                  </div>
                  <span className="text-[11px] text-gray-400">Agreed client quote</span>
                </div>

                <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-100">
                  <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider">Revenue Rec'd</span>
                  <div className="text-lg font-bold text-emerald-700 mt-1">
                    {formatPaise(finance.revenue)}
                  </div>
                  <span className="text-[11px] text-emerald-600 font-semibold">
                    {formatPercent(finance.percentageReceived)} collected
                  </span>
                </div>

                <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-100">
                  <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider">Expenses (Paid)</span>
                  <div className="text-lg font-bold text-amber-700 mt-1">
                    {formatPaise(finance.expenses)}
                  </div>
                  <span className="text-[11px] text-amber-600 font-semibold">
                    {finance.paymentOutCount} vendor disbursements
                  </span>
                </div>

                <div
                  className={`p-4 rounded-xl border ${
                    finance.profit >= 0
                      ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                      : 'bg-red-50/80 border-red-200 text-red-900'
                  }`}
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Net Profit</span>
                  <div className="text-lg font-bold mt-1">
                    {formatPaise(finance.profit)}
                  </div>
                  <span className="text-[11px] font-bold">
                    Margin: {formatPercent(finance.margin)}
                  </span>
                </div>
              </div>

              {/* Expense Breakdown */}
              <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3">
                  Vendor Expense Distribution
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-gray-500">Media / Sites:</span>
                    <p className="font-bold text-gray-900 font-mono mt-0.5">{formatPaise(finance.expenses_media)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Production / Print:</span>
                    <p className="font-bold text-gray-900 font-mono mt-0.5">{formatPaise(finance.expenses_production)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Logistics:</span>
                    <p className="font-bold text-gray-900 font-mono mt-0.5">{formatPaise(finance.expenses_logistics)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Other Overhead:</span>
                    <p className="font-bold text-gray-900 font-mono mt-0.5">{formatPaise(finance.expenses_other)}</p>
                  </div>
                </div>
              </div>

              {/* Recent In / Out Transactions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Client Payments */}
                <div className="border border-gray-100 rounded-xl p-4">
                  <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center justify-between">
                    <span>Client Payments In</span>
                    <span className="text-emerald-600 font-normal">({paymentsIn.length})</span>
                  </h4>
                  <div className="space-y-2">
                    {paymentsIn.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">No client payments yet</p>
                    ) : (
                      paymentsIn.map((p) => (
                        <div key={p.id || p._id} className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded-lg">
                          <div>
                            <span className="font-semibold text-gray-800">{formatDate(p.receivedAt)}</span>
                            <span className="text-gray-400 block text-[10px]">{p.method} • {p.transactionId || 'No Ref'}</span>
                          </div>
                          <span className="font-mono font-bold text-emerald-700">{formatPaise(p.amount)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Vendor Payments */}
                <div className="border border-gray-100 rounded-xl p-4">
                  <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center justify-between">
                    <span>Vendor Payments Out</span>
                    <span className="text-amber-600 font-normal">({paymentsOut.length})</span>
                  </h4>
                  <div className="space-y-2">
                    {paymentsOut.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">No vendor disbursements yet</p>
                    ) : (
                      paymentsOut.map((p) => (
                        <div key={p.id || p._id} className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded-lg">
                          <div>
                            <span className="font-semibold text-gray-800">{p.vendorName || 'Vendor'}</span>
                            <span className="text-gray-400 block text-[10px]">{p.category} • {formatDate(p.paidAt)}</span>
                          </div>
                          <span className="font-mono font-bold text-amber-700">{formatPaise(p.amount)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <p className="text-center text-sm text-gray-500 py-8">Failed to load campaign detail</p>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
