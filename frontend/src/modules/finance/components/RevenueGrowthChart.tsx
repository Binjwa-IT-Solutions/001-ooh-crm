'use client';

import React, { useState } from 'react';
import type { ProfitTrendPoint } from '../types';
import { formatPaise } from '../utils/formatters';

interface RevenueGrowthChartProps {
  trends?: ProfitTrendPoint[];
}

export function RevenueGrowthChart({ trends = [] }: RevenueGrowthChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Fallback to sample days if empty
  const points = trends.length > 0 ? trends : [
    { date: 'Day 1', revenue: 0, expenses: 0, profit: 0, margin: 0 },
    { date: 'Day 10', revenue: 5000000, expenses: 2000000, profit: 3000000, margin: 60 },
    { date: 'Day 20', revenue: 15000000, expenses: 6000000, profit: 9000000, margin: 60 },
    { date: 'Day 30', revenue: 32000000, expenses: 14000000, profit: 18000000, margin: 56.2 },
  ];

  const maxVal = Math.max(...points.map((p) => p.revenue), 1);
  const width = 600;
  const height = 200;
  const padding = 30;

  // Compute SVG coordinates
  const coords = points.map((p, i) => {
    const x = padding + (i / Math.max(points.length - 1, 1)) * (width - padding * 2);
    const y = height - padding - (p.revenue / maxVal) * (height - padding * 2);
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
          <h3 className="text-base font-semibold text-gray-900">Revenue Growth Trajectory</h3>
          <p className="text-xs text-gray-500">Cumulative revenue collected over time</p>
        </div>
        <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
          Steady Growth
        </span>
      </div>

      <div className="relative overflow-hidden pt-2">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-48 overflow-visible">
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E63946" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#E63946" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#f3f4f6" strokeDasharray="4 4" />
          <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="#f3f4f6" strokeDasharray="4 4" />
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#e5e7eb" />

          {/* Area fill */}
          <path d={areaD} fill="url(#revenueGradient)" />

          {/* Line stroke */}
          <path d={pathD} fill="none" stroke="#E63946" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* Data Points */}
          {coords.map((c, i) => (
            <g key={i}>
              <circle
                cx={c.x}
                cy={c.y}
                r={hoveredIndex === i ? 6 : 3.5}
                className="fill-[#E63946] stroke-white stroke-2 cursor-pointer transition-all duration-200"
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            </g>
          ))}
        </svg>

        {/* Hover info tooltip */}
        {hoveredIndex !== null && coords[hoveredIndex] && (
          <div className="mt-2 text-center text-xs font-semibold text-gray-700 bg-gray-50 py-1.5 px-3 rounded-lg border border-gray-200">
            {coords[hoveredIndex].date}: <span className="text-[#E63946]">{formatPaise(coords[hoveredIndex].revenue)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
