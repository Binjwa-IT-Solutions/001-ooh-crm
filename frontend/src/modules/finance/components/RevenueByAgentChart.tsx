'use client';

import React, { useState } from 'react';
import type { RevenueByAgent } from '../types';
import { formatPaise } from '../utils/formatters';

interface RevenueByAgentChartProps {
  data: RevenueByAgent[];
}

export function RevenueByAgentChart({ data }: RevenueByAgentChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-xs h-80 flex flex-col items-center justify-center text-gray-400">
        <p className="text-sm">No agent revenue data recorded yet</p>
      </div>
    );
  }

  const maxRevenue = Math.max(...data.map((d) => d.revenue || 0), 1);
  const topAgentName = data[0]?.agent || data[0]?.agentName || '—';

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Revenue by Agent</h3>
          <p className="text-xs text-gray-500">Sales performance & collection attribution</p>
        </div>
        <span className="text-xs font-medium px-2.5 py-1 bg-red-50 text-[#E63946] rounded-full border border-red-100">
          Top Agent: {topAgentName}
        </span>
      </div>

      <div className="relative pt-6">
        {/* SVG Bar Chart */}
        <div className="h-56 flex items-end justify-around gap-2 border-b border-gray-100 pb-2">
          {data.slice(0, 8).map((item, idx) => {
            const heightPercent = Math.max(4, Math.round(((item.revenue || 0) / maxRevenue) * 100));
            const isTop = idx === 0 && (item.revenue || 0) > 0;
            const isHovered = hoveredIdx === idx;
            const displayName = item.agent || item.agentName || 'Unknown';
            const shortName = displayName.split(' ')[0] || displayName;

            return (
              <div
                key={item.agentId || idx}
                className="flex-1 flex flex-col items-center justify-end h-full relative group cursor-pointer"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* Floating tooltip */}
                {isHovered && (
                  <div className="absolute -top-12 z-20 bg-gray-900 text-white text-xs px-2.5 py-1.5 rounded-lg shadow-lg pointer-events-none whitespace-nowrap">
                    <p className="font-bold">{displayName}</p>
                    <p className="text-red-300">{formatPaise(item.revenue || 0)} ({item.campaignCount || 0} campaigns)</p>
                  </div>
                )}

                {/* Amount label on top of bar */}
                <span className="text-[10px] font-medium text-gray-500 mb-1">
                  {formatPaise(item.revenue || 0, true)}
                </span>

                {/* Animated bar */}
                <div
                  className={`w-full max-w-[48px] rounded-t-lg transition-all duration-300 ${
                    isTop
                      ? 'bg-gradient-to-t from-[#A4161A] to-[#E63946] shadow-sm'
                      : isHovered
                      ? 'bg-gray-700'
                      : 'bg-gray-300 hover:bg-gray-400'
                  }`}
                  style={{ height: `${heightPercent}%` }}
                />

                {/* Agent Name label */}
                <span className="text-xs font-medium text-gray-700 mt-2 truncate w-full text-center" title={displayName}>
                  {shortName}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
