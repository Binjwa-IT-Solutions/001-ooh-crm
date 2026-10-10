'use client';

import React from 'react';
import type { CampaignPaymentStatus } from '../types';

interface PaymentStatusPieProps {
  statusData: Record<CampaignPaymentStatus, number>;
  onSelectStatus?: (status: CampaignPaymentStatus) => void;
}

export function PaymentStatusPie({ statusData, onSelectStatus }: PaymentStatusPieProps) {
  const pending = statusData.pending || 0;
  const partial = statusData.partial || 0;
  const complete = statusData.complete || 0;
  const total = pending + partial + complete;

  const slices = [
    { label: 'Pending', count: pending, color: '#6B7280', status: 'pending' as CampaignPaymentStatus },
    { label: 'Partial', count: partial, color: '#F77F00', status: 'partial' as CampaignPaymentStatus },
    { label: 'Complete', count: complete, color: '#06D6A0', status: 'complete' as CampaignPaymentStatus },
  ];

  // SVG Donut Chart calculation
  const size = 160;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulativePercent = 0;

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Campaign Payment Status</h3>
          <p className="text-xs text-gray-500">Collection progress by campaign</p>
        </div>
        <span className="text-xs font-semibold px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md">
          {total} Campaigns
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
              slices.map((slice) => {
                const percent = slice.count / total;
                const strokeDasharray = `${percent * circumference} ${circumference}`;
                const strokeDashoffset = -cumulativePercent * circumference;
                cumulativePercent += percent;

                return (
                  <circle
                    key={slice.label}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="transparent"
                    stroke={slice.color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    className="transition-all duration-500 hover:opacity-85 cursor-pointer"
                    onClick={() => onSelectStatus?.(slice.status)}
                  />
                );
              })}
          </svg>
          <div className="absolute flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-bold text-gray-900">{total}</span>
            <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Total</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-3 w-full sm:w-auto">
          {slices.map((slice) => {
            const pct = total > 0 ? Math.round((slice.count / total) * 100) : 0;
            return (
              <div
                key={slice.label}
                onClick={() => onSelectStatus?.(slice.status)}
                className="flex items-center justify-between gap-4 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: slice.color }} />
                  <span className="text-xs font-semibold text-gray-700">{slice.label}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-gray-900">{slice.count}</span>
                  <span className="text-gray-400">({pct}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
