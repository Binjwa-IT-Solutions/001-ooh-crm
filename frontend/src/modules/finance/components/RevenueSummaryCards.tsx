'use client';

import React from 'react';
import { TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import { formatPaise, formatPercent } from '../utils/formatters';

interface RevenueSummaryCardsProps {
  pipelineValue: number;
  receivedValue: number;
  gap: number;
  collectionRate: number;
}

export function RevenueSummaryCards({
  pipelineValue,
  receivedValue,
  gap,
  collectionRate,
}: RevenueSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Pipeline Value */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-100 border-l-4 border-l-[#E63946] p-5 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between text-gray-500 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Pipeline Contract Value</span>
          <div className="p-2 bg-red-50 text-[#E63946] rounded-lg">
            <span className="font-bold text-xs">₹</span>
          </div>
        </div>
        <div className="text-2xl font-bold text-gray-900 tracking-tight">
          {formatPaise(pipelineValue)}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Total value of all approved & active campaigns
        </p>
      </div>

      {/* 2. Revenue Received */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-100 border-l-4 border-l-[#06D6A0] p-5 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between text-gray-500 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Revenue Received</span>
          <div className="p-2 bg-emerald-50 text-[#06D6A0] rounded-lg">
            <CheckCircle className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-bold text-gray-900 tracking-tight">
          {formatPaise(receivedValue)}
        </div>
        <div className="flex items-center gap-1.5 mt-2 text-xs font-medium text-emerald-600">
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Collected from clients</span>
        </div>
      </div>

      {/* 3. Revenue Gap */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-100 border-l-4 border-l-[#F77F00] p-5 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between text-gray-500 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Outstanding / Gap</span>
          <div className="p-2 bg-amber-50 text-[#F77F00] rounded-lg">
            <AlertCircle className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-bold text-gray-900 tracking-tight">
          {formatPaise(gap)}
        </div>
        <p className="text-xs text-amber-600 font-medium mt-2">
          Uncollected contract balance
        </p>
      </div>

      {/* 4. Collection Rate */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-100 border-l-4 border-l-indigo-600 p-5 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between text-gray-500 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Collection Rate</span>
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-bold text-gray-900 tracking-tight">
          {formatPercent(collectionRate)}
        </div>
        <div className="w-full bg-gray-100 h-1.5 rounded-full mt-3 overflow-hidden">
          <div
            className="bg-indigo-600 h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, collectionRate))}%` }}
          />
        </div>
      </div>
    </div>
  );
}
