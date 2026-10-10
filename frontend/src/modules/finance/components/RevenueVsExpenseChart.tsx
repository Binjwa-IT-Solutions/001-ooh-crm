'use client';

import React from 'react';
import type { ProfitTrendPoint } from '../types';
import { formatPaise } from '../utils/formatters';

interface RevenueVsExpenseChartProps {
  trends?: ProfitTrendPoint[];
}

export function RevenueVsExpenseChart({ trends = [] }: RevenueVsExpenseChartProps) {
  const points = trends.slice(-7); // Last 7 data points

  if (points.length === 0) {
    return (
      <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-xs h-72 flex items-center justify-center text-gray-400">
        <p className="text-sm">No comparison trends available</p>
      </div>
    );
  }

  const maxVal = Math.max(...points.map((p) => Math.max(p.revenue, p.expenses, 1)));

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Revenue vs Expenses</h3>
          <p className="text-xs text-gray-500">Comparative financial flows</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-[#4361EE]" />
            <span className="font-semibold text-gray-600">Revenue</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-[#F77F00]" />
            <span className="font-semibold text-gray-600">Expenses</span>
          </div>
        </div>
      </div>

      <div className="h-56 flex items-end justify-around gap-4 border-b border-gray-100 pb-2 pt-6">
        {points.map((p, idx) => {
          const revHeight = Math.max(4, Math.round((p.revenue / maxVal) * 100));
          const expHeight = Math.max(4, Math.round((p.expenses / maxVal) * 100));

          return (
            <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full group">
              <div className="flex items-end gap-1.5 h-full w-full max-w-[40px] justify-center">
                {/* Revenue Bar */}
                <div
                  className="w-1/2 bg-[#4361EE] rounded-t-md hover:opacity-90 transition-all duration-300"
                  style={{ height: `${revHeight}%` }}
                  title={`Revenue: ${formatPaise(p.revenue)}`}
                />
                {/* Expense Bar */}
                <div
                  className="w-1/2 bg-[#F77F00] rounded-t-md hover:opacity-90 transition-all duration-300"
                  style={{ height: `${expHeight}%` }}
                  title={`Expenses: ${formatPaise(p.expenses)}`}
                />
              </div>
              <span className="text-[11px] font-medium text-gray-500 mt-2 truncate w-full text-center">
                {p.date.slice(5) || p.date}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
