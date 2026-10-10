'use client';

import React, { useState } from 'react';
import { AlertTriangle, AlertCircle, CheckCircle, ChevronRight, X } from 'lucide-react';
import type { FinanceAlert } from '../types';

interface AlertsPanelProps {
  alerts: FinanceAlert[];
  onSelectCampaign?: (campaignId: string) => void;
}

export function AlertsPanel({ alerts, onSelectCampaign }: AlertsPanelProps) {
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  const activeAlerts = alerts.filter((a) => !dismissedIds.includes(a.id));

  if (activeAlerts.length === 0) {
    return (
      <div className="bg-emerald-50/60 rounded-xl p-4 border border-emerald-200/80 flex items-center justify-between text-emerald-800">
        <div className="flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <div>
            <p className="text-xs font-bold text-emerald-900">All Campaigns Profitable</p>
            <p className="text-xs text-emerald-700">No negative profit or margin breach alerts detected across active campaigns.</p>
          </div>
        </div>
      </div>
    );
  }

  const dismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissedIds((prev) => [...prev, id]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Executive Financial Alerts</h3>
        </div>
        <span className="text-xs font-semibold px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
          {activeAlerts.length} Action Items
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {activeAlerts.map((alert) => {
          let style = {
            border: 'border-l-4 border-l-[#E63946] border-red-200 bg-red-50/70 text-red-900',
            icon: <AlertCircle className="w-4 h-4 text-[#E63946] shrink-0 mt-0.5" />,
            badge: 'bg-red-100 text-[#A4161A]',
          };

          if (alert.type === 'warning') {
            style = {
              border: 'border-l-4 border-l-[#F77F00] border-amber-200 bg-amber-50/70 text-amber-900',
              icon: <AlertTriangle className="w-4 h-4 text-[#F77F00] shrink-0 mt-0.5" />,
              badge: 'bg-amber-100 text-amber-900',
            };
          } else if (alert.type === 'success') {
            style = {
              border: 'border-l-4 border-l-[#06D6A0] border-emerald-200 bg-emerald-50/70 text-emerald-900',
              icon: <CheckCircle className="w-4 h-4 text-[#06D6A0] shrink-0 mt-0.5" />,
              badge: 'bg-emerald-100 text-emerald-900',
            };
          }

          return (
            <div
              key={alert.id}
              onClick={() => alert.campaignId && onSelectCampaign?.(alert.campaignId)}
              className={`rounded-xl p-4 border shadow-xs transition-all relative ${style.border} ${
                alert.campaignId ? 'cursor-pointer hover:shadow-md' : ''
              }`}
            >
              <button
                onClick={(e) => dismiss(alert.id, e)}
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 p-1 rounded-full"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-start gap-2.5 pr-6">
                {style.icon}
                <div>
                  <h4 className="text-xs font-bold leading-snug">{alert.title}</h4>
                  <p className="text-xs opacity-90 mt-1 leading-relaxed">{alert.message}</p>
                  {alert.actionText && (
                    <div className="flex items-center gap-1 text-[11px] font-bold mt-2.5 text-[#A4161A] hover:underline">
                      <span>{alert.actionText}</span>
                      <ChevronRight className="w-3 h-3" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
