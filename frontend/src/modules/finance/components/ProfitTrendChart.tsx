'use client';

import React, { useState } from 'react';
import type { ProfitTrendPoint } from '../types';
import { formatPaise, formatPercent } from '../utils/formatters';

interface ProfitTrendChartProps {
  trends?: ProfitTrendPoint[];
}

export function ProfitTrendChart({ trends = [] }: ProfitTrendChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const points = trends.length > 0 ? trends : [
    { date: '1 Sep', revenue: 2000000, expenses: 1000000, profit: 1000000, margin: 50 },
    { date: '10 Sep', revenue: 6000000, expenses: 3200000, profit: 2800000, margin: 46.6 },
    { date: '20 Sep', revenue: 14000000, expenses: 8000000, profit: 6000000, margin: 42.8 },
    { date: '30 Sep', revenue: 25000000, expenses: 14000000, profit: 11000000, margin: 44.0 },
  ];

  const maxVal = Math.max(...points.map((p) => Math.max(p.profit, p.revenue, 1)));
  const minVal = Math.min(...points.map((p) => p.profit), 0);
  const range = Math.max(maxVal - minVal, 1);

  const width = 600;
  const height = 220;
  const padding = 35;

  const coords = points.map((p, i) => {
    const x = padding + (i / Math.max(points.length - 1, 1)) * (width - padding * 2);
    const y = height - padding - ((p.profit - minVal) / range) * (height - padding * 2);
    return { x, y, ...p };
  });

  const pathD = coords.reduce((acc, c, idx) => {
    return idx === 0 ? `M ${c.x} ${c.y}` : `${acc} L ${c.x} ${c.y}`;
  }, '');

  const areaD = `${pathD} L ${coords[coords.length - 1]?.x || width} ${height - padding} L ${coords[0]?.x || padding} ${height - padding} Z`;

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Profit Trend (30 Days)</h3>
          <p className="text-xs text-gray-500">Historical daily profit progression from ProfitLog</p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100">
          Nightly Snapshots
        </span>
      </div>

      <div className="relative pt-2">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-52 overflow-visible">
          <defs>
            <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06D6A0" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#06D6A0" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#f3f4f6" strokeDasharray="3 3" />
          <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="#f3f4f6" strokeDasharray="3 3" />
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#e5e7eb" />

          {/* Area fill */}
          <path d={areaD} fill="url(#profitGrad)" />

          {/* Stroke line */}
          <path d={pathD} fill="none" stroke="#06D6A0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* Points */}
          {coords.map((c, i) => (
            <g key={i}>
              <circle
                cx={c.x}
                cy={c.y}
                r={hoveredIdx === i ? 6 : 3.5}
                className="fill-[#06D6A0] stroke-white stroke-2 cursor-pointer transition-all duration-200"
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            </g>
          ))}
        </svg>

        {hoveredIdx !== null && coords[hoveredIdx] && (
          <div className="mt-2 flex items-center justify-center gap-4 text-xs font-semibold text-gray-700 bg-gray-50 py-1.5 px-3 rounded-lg border border-gray-200">
            <span>{coords[hoveredIdx].date}</span>
            <span className="text-emerald-600">Profit: {formatPaise(coords[hoveredIdx].profit)}</span>
            <span className="text-gray-500">Margin: {formatPercent(coords[hoveredIdx].margin)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
