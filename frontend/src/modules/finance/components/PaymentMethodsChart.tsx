'use client';

import React from 'react';
import type { PaymentMethod } from '../types';
import { formatPaise } from '../utils/formatters';

interface PaymentMethodsChartProps {
  methodData: Record<PaymentMethod, { count: number; amount: number }>;
}

export function PaymentMethodsChart({ methodData }: PaymentMethodsChartProps) {
  const methods: { key: PaymentMethod; label: string; color: string }[] = [
    { key: 'bank_transfer', label: 'Bank Transfer (NEFT/RTGS)', color: '#4361EE' },
    { key: 'upi', label: 'UPI / QR', color: '#06D6A0' },
    { key: 'cheque', label: 'Cheque', color: '#F77F00' },
    { key: 'credit_card', label: 'Credit Card', color: '#7209B7' },
    { key: 'cash', label: 'Cash', color: '#6B7280' },
  ];

  const totalAmount = Object.values(methodData).reduce((sum, item) => sum + (item?.amount || 0), 0) || 1;

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Payment Modes & Channels</h3>
          <p className="text-xs text-gray-500">Collection distribution across payment channels</p>
        </div>
      </div>

      <div className="space-y-3.5 pt-1">
        {methods.map((m) => {
          const item = methodData[m.key] || { count: 0, amount: 0 };
          const percent = Math.round((item.amount / totalAmount) * 100);

          return (
            <div key={m.key} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-gray-700">{m.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">({item.count} txn)</span>
                  <span className="font-bold text-gray-900">{formatPaise(item.amount)}</span>
                  <span className="text-[11px] font-semibold text-gray-400 w-10 text-right">{percent}%</span>
                </div>
              </div>
              <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.max(2, percent)}%`,
                    backgroundColor: m.color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
