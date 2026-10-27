'use client';

import React from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  AlertCircle,
  Clock,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import type { DashboardAlert } from '../types';

interface DashboardAlertsProps {
  alerts: DashboardAlert[];
}

export function DashboardAlerts({ alerts }: DashboardAlertsProps) {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-1.5">
          <ShieldAlert className="w-4 h-4 text-red-600" />
          <span>Operational & Financial Alerts</span>
        </h2>
        <span className="text-[11px] text-gray-500 font-medium">Requires supervisor action</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {alerts.map((alert) => {
          const isDanger = alert.type === 'danger';
          const isWarning = alert.type === 'warning';

          return (
            <Link
              key={alert.id}
              href={alert.link}
              className={`group rounded-xl p-3.5 border transition-all duration-200 flex items-start gap-3 shadow-2xs hover:shadow-xs ${
                isDanger
                  ? 'bg-red-50/40 border-red-200 hover:border-red-400'
                  : isWarning
                  ? 'bg-amber-50/40 border-amber-200 hover:border-amber-400'
                  : 'bg-blue-50/40 border-blue-200 hover:border-blue-400'
              }`}
            >
              <div
                className={`p-2 rounded-lg shrink-0 ${
                  isDanger
                    ? 'bg-red-100 text-red-700'
                    : isWarning
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-blue-100 text-blue-700'
                }`}
              >
                {isDanger ? (
                  <AlertCircle className="w-4 h-4" />
                ) : isWarning ? (
                  <AlertTriangle className="w-4 h-4" />
                ) : (
                  <Clock className="w-4 h-4" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <h4 className="text-xs font-bold text-gray-900 truncate group-hover:text-[#6E1D1D] transition-colors">
                    {alert.title}
                  </h4>
                  {alert.count !== undefined && (
                    <span
                      className={`text-[10px] font-black px-1.5 py-0.2 rounded-full shrink-0 ${
                        isDanger
                          ? 'bg-red-200 text-red-900'
                          : isWarning
                          ? 'bg-amber-200 text-amber-900'
                          : 'bg-blue-200 text-blue-900'
                      }`}
                    >
                      {alert.count}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-600 font-medium line-clamp-1 mt-0.5">
                  {alert.description}
                </p>
                <div className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-gray-400 group-hover:text-[#6E1D1D] transition-colors">
                  <span>Take action</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
