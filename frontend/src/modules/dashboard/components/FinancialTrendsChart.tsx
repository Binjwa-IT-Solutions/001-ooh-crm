'use client';

import React from 'react';
import Link from 'next/link';
import { BarChart3, ArrowUpRight } from 'lucide-react';
import { formatPaise } from '@/modules/finance/utils/formatters';

interface TrendPoint {
  date: string;
  revenue: number;
  expenses: number;
  profit: number;
  margin: number;
}

interface FinancialTrendsChartProps {
  trends?: TrendPoint[] | null;
}

export function FinancialTrendsChart({ trends = [] }: FinancialTrendsChartProps) {
  const points = (trends || []).slice(-10); // Last 10 points

  if (!points || points.length === 0) {
    return (
      <div className="bg-white rounded-xl p-6 border border-gray-200/80 shadow-xs flex flex-col items-center justify-center text-center h-64 text-gray-400">
        <BarChart3 className="w-8 h-8 text-gray-300 mb-2" />
        <p className="text-xs font-medium">No financial timeline trend points available yet</p>
        <p className="text-[11px] text-gray-400 mt-0.5">Trends populate automatically as daily payment transactions are logged</p>
      </div>
    );
  }

  const maxVal = Math.max(...points.map((p) => Math.max(p.revenue, p.expenses, 1)));

  return (
    <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-gray-900 tracking-tight">
              Cash Inflow vs Outflow Trend (Last 30 Days)
            </h3>
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-50 text-blue-700">
              Aggregated Movement
            </span>
          </div>
          <p className="text-[11px] text-gray-500 font-medium">
            Daily comparative audit of client collections (Revenue) against vendor payouts (Expenses)
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs font-semibold">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-[#16A36A]" />
            <span className="text-gray-700">Collections (In)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-[#E74C3C]" />
            <span className="text-gray-700">Disbursements (Out)</span>
          </div>
          <Link
            href="/finance/profit-dashboard"
            className="text-xs font-semibold text-[#6E1D1D] hover:underline flex items-center gap-0.5 ml-2"
          >
            <span>Full Audit</span>
            <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Chart Visualizer */}
      <div className="h-56 flex items-end justify-between gap-2 sm:gap-4 border-b border-gray-100 pb-2 pt-6">
        {points.map((p, idx) => {
          const revHeight = Math.max(6, Math.round((p.revenue / maxVal) * 100));
          const expHeight = Math.max(6, Math.round((p.expenses / maxVal) * 100));

          return (
            <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full group">
              <div className="flex items-end gap-1.5 h-full w-full max-w-[36px] justify-center relative">
                {/* Tooltip */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-12 z-20 bg-gray-900 text-white text-[10px] rounded px-2 py-1 pointer-events-none whitespace-nowrap shadow-lg">
                  <div>In: {formatPaise(p.revenue)}</div>
                  <div>Out: {formatPaise(p.expenses)}</div>
                </div>

                {/* Collections In Bar */}
                <div
                  className="w-1/2 bg-[#16A36A] rounded-t-sm hover:opacity-90 transition-all duration-300"
                  style={{ height: `${revHeight}%` }}
                />
                {/* Disbursements Out Bar */}
                <div
                  className="w-1/2 bg-[#E74C3C] rounded-t-sm hover:opacity-90 transition-all duration-300"
                  style={{ height: `${expHeight}%` }}
                />
              </div>

              <span className="mt-2 text-[10px] text-gray-500 font-mono rotate-0 truncate">
                {p.date.slice(5)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-gray-500">
        <span>Timeline: aggregated daily transaction volume</span>
        <span className="text-[#6E1D1D] font-semibold">Media Octus Live Cash Flow Tracker</span>
      </div>
    </div>
  );
}
