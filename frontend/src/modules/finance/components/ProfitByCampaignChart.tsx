'use client';

import React from 'react';
import type { CampaignFinance } from '../types';
import { formatPaise, formatPercent } from '../utils/formatters';

interface ProfitByCampaignChartProps {
  campaigns: CampaignFinance[];
  onSelectCampaign?: (campaign: CampaignFinance) => void;
}

export function ProfitByCampaignChart({
  campaigns,
  onSelectCampaign,
}: ProfitByCampaignChartProps) {
  if (!campaigns || campaigns.length === 0) {
    return (
      <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-xs h-72 flex items-center justify-center text-gray-400">
        <p className="text-sm">No campaign profit data available yet</p>
      </div>
    );
  }

  const maxProfit = Math.max(...campaigns.map((c) => Math.max(c.profit, 1)));

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Profit by Campaign (Top Performers)</h3>
          <p className="text-xs text-gray-500">Highest grossing campaigns with margin efficiency</p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100">
          Leaderboard
        </span>
      </div>

      <div className="space-y-3.5 pt-2">
        {campaigns.map((c) => {
          const isProfitable = c.profit >= 0;
          const barPercent = Math.max(5, Math.round((Math.abs(c.profit) / maxProfit) * 100));

          return (
            <div
              key={c.id || c._id || c.campaignId}
              onClick={() => onSelectCampaign?.(c)}
              className="group cursor-pointer p-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-gray-900 truncate max-w-[200px] group-hover:text-[#E63946] transition-colors">
                  {c.campaignName || 'Campaign'}
                </span>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      c.margin >= 30
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : c.margin >= 10
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}
                  >
                    {formatPercent(c.margin)}
                  </span>
                  <span className={`font-mono font-bold ${isProfitable ? 'text-gray-900' : 'text-red-600'}`}>
                    {formatPaise(c.profit)}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isProfitable
                      ? 'bg-gradient-to-r from-emerald-500 to-[#06D6A0]'
                      : 'bg-gradient-to-r from-red-500 to-[#E63946]'
                  }`}
                  style={{ width: `${barPercent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
