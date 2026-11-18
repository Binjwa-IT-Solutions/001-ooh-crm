'use client';

import React from 'react';
import type { ExpenseBreakdown } from '../types';
import { formatPaise, formatPercent } from '../utils/formatters';

interface ExpenseBreakdownChartProps {
  breakdown: ExpenseBreakdown | null;
}

export function ExpenseBreakdownChart({ breakdown }: ExpenseBreakdownChartProps) {
  const categories = [
    { key: 'media', label: 'Media / Sites', amount: breakdown?.media || 0, percent: breakdown?.percentages?.media || 0, color: '#E63946' },
    { key: 'production', label: 'Production / Printing', amount: breakdown?.production || 0, percent: breakdown?.percentages?.production || 0, color: '#F77F00' },
    { key: 'logistics', label: 'Logistics & Mounting', amount: breakdown?.logistics || 0, percent: breakdown?.percentages?.logistics || 0, color: '#4361EE' },
    { key: 'other', label: 'Other Expenses', amount: breakdown?.other || 0, percent: breakdown?.percentages?.other || 0, color: '#6B7280' },
  ];

  const total = breakdown?.total || categories.reduce((sum, c) => sum + c.amount, 0);

  // SVG Donut calculation
  const size = 160;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulative = 0;

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Expense Category Breakdown</h3>
          <p className="text-xs text-gray-500">Distribution of vendor payments by cost center</p>
        </div>
        <span className="text-xs font-bold text-gray-900 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-200">
          Total: {formatPaise(total)}
        </span>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-around gap-6 pt-2">
        {/* SVG Donut */}
        <div className="relative flex items-center justify-center">
          <svg width={size} height={size} className="transform -rotate-90">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke="#f3f4f6"
              strokeWidth={strokeWidth}
            />
            {total > 0 &&
              categories.map((cat) => {
                const ratio = cat.amount / total;
                const strokeDasharray = `${ratio * circumference} ${circumference}`;
                const strokeDashoffset = -cumulative * circumference;
                cumulative += ratio;

                return (
                  <circle
                    key={cat.key}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="transparent"
                    stroke={cat.color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    className="transition-all duration-300 hover:opacity-80 cursor-pointer"
                  />
                );
              })}
          </svg>
          <div className="absolute flex flex-col items-center justify-center text-center">
            <span className="text-sm font-bold text-gray-900">{formatPaise(total, true)}</span>
            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Expenses</span>
          </div>
        </div>

        {/* Categories List */}
        <div className="space-y-3 w-full sm:w-auto">
          {categories.map((cat) => (
            <div key={cat.key} className="flex items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-md" style={{ backgroundColor: cat.color }} />
                <span className="font-semibold text-gray-700">{cat.label}</span>
              </div>
              <div className="flex items-center gap-2 font-mono">
                <span className="font-bold text-gray-900">{formatPaise(cat.amount)}</span>
                <span className="text-gray-400 font-sans w-12 text-right">({cat.percent}%)</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
