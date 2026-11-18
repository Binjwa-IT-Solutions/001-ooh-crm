'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Layers, ShieldCheck, BarChart3 } from 'lucide-react';
import { formatPaise, formatPercent } from '../utils/formatters';

interface ProfitSummaryCardsProps {
  totalProfit: number;
  margin: number;
  revenue: number;
  expenses: number;
  activeCount: number;
}

export function ProfitSummaryCards({
  totalProfit,
  margin,
  revenue,
  expenses,
  activeCount,
}: ProfitSummaryCardsProps) {
  const isProfitable = totalProfit >= 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {/* 1. Net Profit */}
      <div
        className={`bg-white rounded-xl shadow-xs border border-gray-100 border-l-4 p-5 hover:shadow-md transition-shadow ${
          isProfitable ? 'border-l-[#06D6A0]' : 'border-l-[#E63946]'
        }`}
      >
        <div className="flex items-center justify-between text-gray-500 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Net Profit</span>
          <div
            className={`p-2 rounded-lg ${
              isProfitable ? 'bg-emerald-50 text-[#06D6A0]' : 'bg-red-50 text-[#E63946]'
            }`}
          >
            {isProfitable ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          </div>
        </div>
        <div
          className={`text-2xl font-bold tracking-tight ${
            isProfitable ? 'text-emerald-700' : 'text-red-700'
          }`}
        >
          {formatPaise(totalProfit)}
        </div>
        <p className="text-xs text-gray-500 mt-2">Revenue minus vendor expenses</p>
      </div>

      {/* 2. Profit Margin */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-100 border-l-4 border-l-indigo-600 p-5 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between text-gray-500 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Average Margin</span>
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <span className="font-bold text-xs">%</span>
          </div>
        </div>
        <div className="text-2xl font-bold text-gray-900 tracking-tight">
          {formatPercent(margin)}
        </div>
        <div className="w-full bg-gray-100 h-1.5 rounded-full mt-3 overflow-hidden">
          <div
            className="bg-indigo-600 h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, margin))}%` }}
          />
        </div>
      </div>

      {/* 3. Gross Revenue */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-100 border-l-4 border-l-[#4361EE] p-5 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between text-gray-500 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Total Revenue</span>
          <div className="p-2 bg-blue-50 text-[#4361EE] rounded-lg">
            <span className="font-bold text-xs">₹</span>
          </div>
        </div>
        <div className="text-2xl font-bold text-gray-900 tracking-tight">
          {formatPaise(revenue)}
        </div>
        <p className="text-xs text-gray-500 mt-2">Collected from clients</p>
      </div>

      {/* 4. Total Expenses */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-100 border-l-4 border-l-[#F77F00] p-5 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between text-gray-500 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Total Expenses</span>
          <div className="p-2 bg-amber-50 text-[#F77F00] rounded-lg">
            <span className="font-bold text-xs">₹</span>
          </div>
        </div>
        <div className="text-2xl font-bold text-gray-900 tracking-tight">
          {formatPaise(expenses)}
        </div>
        <p className="text-xs text-gray-500 mt-2">Media, production, logistics</p>
      </div>

      {/* 5. Active Campaigns */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-100 border-l-4 border-l-[#6E1D1D] p-5 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between text-gray-500 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Active Campaigns</span>
          <div className="p-2 bg-rose-50 text-[#6E1D1D] rounded-lg">
            <Layers className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-bold text-gray-900 tracking-tight">
          {activeCount}
        </div>
        <div className="flex items-center gap-1 mt-2 text-xs text-emerald-600 font-medium">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Profit calculated nightly</span>
        </div>
      </div>
    </div>
  );
}
