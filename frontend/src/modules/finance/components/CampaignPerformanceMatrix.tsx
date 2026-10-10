'use client';

import React, { useState } from 'react';
import type { CampaignFinance } from '../types';
import { formatPaise, formatPercent } from '../utils/formatters';

interface CampaignPerformanceMatrixProps {
  campaigns: CampaignFinance[];
  onSelectCampaign?: (campaign: CampaignFinance) => void;
}

export function CampaignPerformanceMatrix({
  campaigns,
  onSelectCampaign,
}: CampaignPerformanceMatrixProps) {
  const [hoveredCampaign, setHoveredCampaign] = useState<CampaignFinance | null>(null);

  if (!campaigns || campaigns.length === 0) {
    return null;
  }

  const width = 600;
  const height = 240;
  const padding = 40;

  const maxContract = Math.max(...campaigns.map((c) => c.contractedValue || 1), 10000000);
  const maxProfit = Math.max(...campaigns.map((c) => Math.abs(c.profit) || 1), 5000000);

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Campaign Profitability Matrix</h3>
          <p className="text-xs text-gray-500">Contract Value vs Realized Net Profit</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-emerald-700 font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-[#06D6A0]" /> High Margin (&gt;30%)
          </span>
          <span className="flex items-center gap-1 text-amber-700 font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F77F00]" /> Moderate (10-30%)
          </span>
          <span className="flex items-center gap-1 text-red-700 font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-[#E63946]" /> Low / Loss (&lt;10%)
          </span>
        </div>
      </div>

      <div className="relative pt-2">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-56 overflow-visible">
          {/* Quadrant Backgrounds */}
          <rect x={padding} y={padding} width={(width - padding * 2) / 2} height={(height - padding * 2) / 2} fill="#f9fafb" opacity="0.6" />
          <rect x={padding + (width - padding * 2) / 2} y={padding} width={(width - padding * 2) / 2} height={(height - padding * 2) / 2} fill="#ecfdf5" opacity="0.4" />

          {/* Center axes */}
          <line x1={padding} y1={(height - padding) / 2 + padding / 2} x2={width - padding} y2={(height - padding) / 2 + padding / 2} stroke="#e5e7eb" strokeDasharray="3 3" />
          <line x1={(width - padding) / 2 + padding / 2} y1={padding} x2={(width - padding) / 2 + padding / 2} y2={height - padding} stroke="#e5e7eb" strokeDasharray="3 3" />

          {/* Border axes */}
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#9ca3af" />
          <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#9ca3af" />

          {/* Axis Labels */}
          <text x={width - padding} y={height - 12} textAnchor="end" className="text-[10px] fill-gray-400 font-medium">Contract Value →</text>
          <text x={padding + 10} y={padding + 12} className="text-[10px] fill-gray-400 font-medium">↑ Realized Profit</text>

          {/* Bubbles */}
          {campaigns.map((c, idx) => {
            const x = padding + ((c.contractedValue || 0) / maxContract) * (width - padding * 2);
            const y = height - padding - ((c.profit || 0) / maxProfit) * (height - padding * 2);

            let color = '#E63946';
            if (c.margin >= 30) color = '#06D6A0';
            else if (c.margin >= 10) color = '#F77F00';

            const isHovered = hoveredCampaign?.campaignId === c.campaignId;

            return (
              <circle
                key={c.id || c._id || idx}
                cx={Math.max(padding + 10, Math.min(width - padding - 10, x))}
                cy={Math.max(padding + 10, Math.min(height - padding - 10, y))}
                r={isHovered ? 12 : 8}
                fill={color}
                fillOpacity={isHovered ? 0.9 : 0.65}
                stroke={color}
                strokeWidth={2}
                className="cursor-pointer transition-all duration-200"
                onMouseEnter={() => setHoveredCampaign(c)}
                onMouseLeave={() => setHoveredCampaign(null)}
                onClick={() => onSelectCampaign?.(c)}
              />
            );
          })}
        </svg>

        {hoveredCampaign && (
          <div className="mt-2 text-center text-xs font-semibold text-gray-800 bg-gray-50 py-1.5 px-3 rounded-lg border border-gray-200">
            <span className="font-bold">{hoveredCampaign.campaignName}</span> | Contract: {formatPaise(hoveredCampaign.contractedValue)} | Profit: <span className={hoveredCampaign.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}>{formatPaise(hoveredCampaign.profit)}</span> | Margin: {formatPercent(hoveredCampaign.margin)}
          </div>
        )}
      </div>
    </div>
  );
}
