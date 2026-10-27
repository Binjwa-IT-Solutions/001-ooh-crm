'use client';

import React from 'react';
import Link from 'next/link';
import {
  Users,
  Megaphone,
  FileText,
  Clock,
  MapPin,
  AlertTriangle,
  Camera,
  Building2,
  ArrowRight,
  Briefcase,
} from 'lucide-react';
import type { BusinessSummary } from '../types';

interface BusinessSummaryCardsProps {
  summary: BusinessSummary;
  permissions: string[];
}

export function BusinessSummaryCards({ summary, permissions }: BusinessSummaryCardsProps) {
  const hasPerm = (p: string) => permissions.includes(p);

  const cards = [
    hasPerm('leads.view') && summary.totalLeads !== undefined && {
      title: 'Total Leads',
      value: summary.totalLeads,
      label: 'Captured leads in pipeline',
      href: '/leads',
      icon: Users,
      color: 'text-blue-600 bg-blue-50 border-blue-100',
    },
    hasPerm('leads.view') && summary.totalClients !== undefined && {
      title: 'Total Clients',
      value: summary.totalClients,
      label: 'Won & converted accounts',
      href: '/leads',
      icon: Briefcase,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    },
    hasPerm('campaigns.view') && summary.activeCampaigns !== undefined && {
      title: 'Active Campaigns',
      value: summary.activeCampaigns,
      label: 'Live & approved campaigns',
      href: '/campaigns',
      icon: Megaphone,
      color: 'text-[#6E1D1D] bg-[#F8E6E6] border-[#F0D0D0]',
    },
    hasPerm('quotations.view') && summary.totalQuotations !== undefined && {
      title: 'Total Quotations',
      value: summary.totalQuotations,
      label: 'Generated proposals',
      href: '/quotations',
      icon: FileText,
      color: 'text-indigo-600 bg-indigo-50 border-indigo-100',
    },
    hasPerm('quotations.view') && summary.pendingQuotations !== undefined && {
      title: 'Pending Quotations',
      value: summary.pendingQuotations,
      label: 'Awaiting client signoff',
      href: '/quotations',
      icon: Clock,
      color: 'text-amber-600 bg-amber-50 border-amber-100',
    },
    hasPerm('sites.view') && summary.totalSites !== undefined && {
      title: 'Active Sites / ATR',
      value: summary.totalSites,
      label: 'Inventory assets tracked',
      href: '/sites',
      icon: MapPin,
      color: 'text-purple-600 bg-purple-50 border-purple-100',
    },
    hasPerm('vendors.view') && summary.totalVendors !== undefined && {
      title: 'Active Vendors',
      value: summary.totalVendors,
      label: 'Registered outdoor partners',
      href: '/vendors',
      icon: Building2,
      color: 'text-teal-600 bg-teal-50 border-teal-100',
    },
    hasPerm('tasks.view') && summary.pendingTasks !== undefined && {
      title: 'Pending Tasks / Escalations',
      value: summary.pendingTasks,
      label: 'Operational SLA items',
      href: '/escalations',
      icon: AlertTriangle,
      color: summary.pendingTasks > 0 ? 'text-red-600 bg-red-50 border-red-100' : 'text-slate-600 bg-slate-50 border-slate-100',
    },
    hasPerm('proofs.view') && summary.pendingProofs !== undefined && {
      title: 'Pending Proofs',
      value: summary.pendingProofs,
      label: 'Display proofs to review',
      href: '/proofs',
      icon: Camera,
      color: summary.pendingProofs > 0 ? 'text-amber-600 bg-amber-50 border-amber-100' : 'text-slate-600 bg-slate-50 border-slate-100',
    },
  ].filter(Boolean) as Array<{
    title: string;
    value: number;
    label: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
  }>;

  if (cards.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-900 tracking-tight">Business Overview</h2>
        <span className="text-xs text-gray-500 font-medium">Real-time counts across active operations</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.title}
              href={card.href}
              className="group bg-white rounded-xl p-4 border border-gray-200/80 shadow-xs hover:border-[#6E1D1D]/40 hover:shadow-md transition-all duration-200 flex flex-col justify-between"
            >
              <div className="flex items-start justify-between">
                <span className="text-xs font-semibold text-gray-600 group-hover:text-[#6E1D1D] transition-colors line-clamp-1">
                  {card.title}
                </span>
                <div className={`p-2 rounded-lg border ${card.color} shrink-0`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>

              <div className="mt-3">
                <div className="text-2xl font-black text-gray-900 tracking-tight group-hover:text-[#6E1D1D] transition-colors">
                  {card.value.toLocaleString('en-IN')}
                </div>
                <p className="mt-1 text-[11px] text-gray-500 line-clamp-1">{card.label}</p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-[11px] font-semibold text-gray-400 group-hover:text-[#6E1D1D] transition-colors">
                <span>View records</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
