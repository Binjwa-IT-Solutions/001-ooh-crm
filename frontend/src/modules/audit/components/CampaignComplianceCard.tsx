'use client';

import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Clock,
  CalendarCheck,
  Camera,
  MapPin,
  TrendingUp,
  FileText,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { auditApi } from '../api';
import type { ComplianceCheckResult, ComplianceCheckType } from '../types';

interface CampaignComplianceCardProps {
  campaignId: string;
  campaignName?: string;
  onAuditCompleted?: () => void;
}

const CHECK_CONFIG: Record<
  ComplianceCheckType,
  {
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  executed_on_time: {
    title: 'Schedule & Execution Timeline',
    description: 'Campaign completed within promised start and end dates',
    icon: Clock,
  },
  deadlines_met: {
    title: 'Task Deadlines Met',
    description: 'All field operations and execution tasks finished by target date',
    icon: CalendarCheck,
  },
  proofs_complete: {
    title: 'Proof of Display Completed',
    description: 'Approved photo/video proofs provided for all mandatory tasks',
    icon: Camera,
  },
  gps_match: {
    title: 'Geo-Fence & GPS Match (≤500m)',
    description: 'Proof coordinates verified against physical site coordinates',
    icon: MapPin,
  },
  payments_in_reconciled: {
    title: 'Client Payment Reconciliation',
    description: 'Received client payments match contracted quotation value',
    icon: TrendingUp,
  },
  payments_out_reconciled: {
    title: 'Vendor PO Reconciliation',
    description: 'Vendor commitments and purchase orders match active requirements',
    icon: FileText,
  },
};

export const CampaignComplianceCard: React.FC<CampaignComplianceCardProps> = ({
  campaignId,
  campaignName,
  onAuditCompleted,
}) => {
  const [results, setResults] = useState<ComplianceCheckResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedCheck, setExpandedCheck] = useState<string | null>(null);

  const fetchResults = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await auditApi.getCampaignAudit(campaignId);
      setResults(res.data || []);
    } catch (err: any) {
      console.error('Failed to load compliance audit results', err);
      setError(err.message || 'Failed to fetch compliance audit');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (campaignId) {
      fetchResults();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  const handleRunScan = async () => {
    try {
      setScanning(true);
      setError(null);
      const res = await auditApi.runComplianceAudit(campaignId);
      if (Array.isArray(res.data)) {
        setResults(res.data as ComplianceCheckResult[]);
      } else {
        await fetchResults();
      }
      if (onAuditCompleted) {
        onAuditCompleted();
      }
    } catch (err: any) {
      console.error('Failed to run compliance scan', err);
      setError(err.message || 'Failed to execute compliance audit');
    } finally {
      setScanning(false);
    }
  };

  const isCheckNA = (item: ComplianceCheckResult) =>
    Boolean(
      item.details?.metadata?.notApplicable ||
      item.details?.summary?.startsWith('No operational tasks') ||
      item.details?.summary?.startsWith('No tasks with mandatory') ||
      item.details?.summary?.startsWith('No vendor purchase orders')
    );

  const totalChecks = results.length;
  const naChecks = results.filter(isCheckNA).length;
  const failingChecks = results.filter((r) => !r.passed).length;
  const purePassedChecks = results.filter((r) => r.passed && !isCheckNA(r)).length;
  const isAllPassed = totalChecks > 0 && failingChecks === 0;

  const toggleExpand = (checkType: string) => {
    setExpandedCheck(expandedCheck === checkType ? null : checkType);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-start gap-3.5">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${
              isAllPassed
                ? 'bg-emerald-50 text-emerald-600 border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-400'
                : failingChecks > 0
                ? 'bg-rose-50 text-[#8B2424] border-rose-200/60 dark:bg-rose-950/40 dark:text-rose-400'
                : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
            }`}
          >
            {isAllPassed ? (
              <ShieldCheck className="h-6 w-6" />
            ) : failingChecks > 0 ? (
              <ShieldAlert className="h-6 w-6" />
            ) : (
              <ShieldCheck className="h-6 w-6" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Compliance & Assurance Audit
              </h2>
              {totalChecks > 0 && (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    isAllPassed
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300'
                      : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${isAllPassed ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  {isAllPassed ? '100% Compliant' : `${failingChecks} Non-Compliant`}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              {campaignName ? `Automated verification checks for ${campaignName}` : '6-point automated verification against contracts and field data'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {results.length > 0 && results[0]?.checkedAt && (
            <span className="hidden text-[11px] text-slate-500 font-medium lg:inline-flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1 rounded-lg border border-slate-200/60 dark:border-slate-700">
              <Clock className="h-3 w-3 text-slate-400" />
              Audited: {new Date(results[0].checkedAt).toLocaleDateString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            type="button"
            onClick={handleRunScan}
            disabled={scanning || loading}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#8B2424] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#721c1c] active:scale-98 disabled:opacity-50 transition border border-[#A32D2D]"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${scanning ? 'animate-spin' : ''}`} />
            <span>{scanning ? 'Auditing...' : 'Run Compliance Scan'}</span>
          </button>
        </div>
      </div>

      {/* Quick KPI Strip */}
      {totalChecks > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-5 py-3 bg-slate-50/70 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 rounded-xl bg-white dark:bg-slate-900 px-3 py-1.5 border border-slate-200/70 dark:border-slate-800 shadow-2xs">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Passed</span>
              <span className="text-xs font-bold text-slate-900 dark:text-white">{purePassedChecks} Checks</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-white dark:bg-slate-900 px-3 py-1.5 border border-slate-200/70 dark:border-slate-800 shadow-2xs">
            <AlertCircle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Exceptions</span>
              <span className="text-xs font-bold text-rose-700 dark:text-rose-400">{failingChecks} Issues</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-white dark:bg-slate-900 px-3 py-1.5 border border-slate-200/70 dark:border-slate-800 shadow-2xs">
            <span className="h-3 w-3 rounded-full border-2 border-slate-400 inline-block shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Not Applicable</span>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{naChecks} Checks</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-white dark:bg-slate-900 px-3 py-1.5 border border-slate-200/70 dark:border-slate-800 shadow-2xs">
            <ShieldCheck className="h-3.5 w-3.5 text-[#8B2424] dark:text-rose-400 shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Total Audited</span>
              <span className="text-xs font-bold text-slate-900 dark:text-white">{totalChecks} Checks</span>
            </div>
          </div>
        </div>
      )}

      {/* Error alert */}
      {error && (
        <div className="m-4 flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Content */}
      <div className="p-5">
        {loading && results.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
            <span className="ml-2 text-sm text-slate-500">Loading compliance records...</span>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <ShieldCheck className="h-10 w-10 text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              No audit report generated yet
            </p>
            <p className="mt-1 max-w-sm text-xs text-slate-500">
              Click &quot;Run Compliance Scan&quot; above to cross-check dates, task proofs, GPS tags, and financial reconciliations.
            </p>
          </div>
        ) : (
          (() => {
            const renderCheckCard = (item: ComplianceCheckResult) => {
              const config = CHECK_CONFIG[item.checkType] || {
                title: item.checkType,
                description: 'Compliance verification check',
                icon: ShieldCheck,
              };
              const IconComponent = config.icon;
              const hasFailingItems =
                Boolean(item.details?.failingItems && item.details.failingItems.length > 0);
              const isExpanded = expandedCheck === item.checkType;
              const isNA = isCheckNA(item);

              return (
                <div
                  key={item._id || item.checkType}
                  className={`group relative rounded-xl border bg-white p-4 transition-all duration-200 dark:bg-slate-900/90 shadow-2xs hover:shadow-xs ${
                    isNA
                      ? 'border-slate-200/80 hover:border-slate-300 dark:border-slate-800'
                      : item.passed
                      ? 'border-slate-200/80 border-l-4 border-l-emerald-500 dark:border-slate-800'
                      : 'border-rose-200 border-l-4 border-l-rose-500 bg-rose-50/20 dark:border-rose-900/50 dark:bg-rose-950/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                          isNA
                            ? 'bg-slate-100 text-slate-500 border-slate-200/70 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                            : item.passed
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
                            : 'bg-rose-50 text-rose-700 border-rose-200/60 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800'
                        }`}
                      >
                        <IconComponent className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {config.title}
                        </h3>
                        <p className="text-[11px] text-slate-500 line-clamp-1">{config.description}</p>
                      </div>
                    </div>

                    {isNA ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200/80 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                        <span>N/A</span>
                      </span>
                    ) : item.passed ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>PASS</span>
                      </span>
                    ) : (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800">
                        <AlertCircle className="h-3 w-3" />
                        <span>FAIL</span>
                      </span>
                    )}
                  </div>

                  {/* Summary Note */}
                  <div
                    className={`mt-3 rounded-lg p-2.5 text-xs transition border ${
                      isNA
                        ? 'bg-slate-50/70 border-slate-100 text-slate-600 dark:bg-slate-800/40 dark:border-slate-800 dark:text-slate-400'
                        : item.passed
                        ? 'bg-emerald-50/30 border-emerald-100/60 text-slate-700 dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-slate-300'
                        : 'bg-rose-50/60 border-rose-200/80 text-rose-900 dark:bg-rose-950/30 dark:border-rose-900/50 dark:text-rose-200'
                    }`}
                  >
                    <p className="leading-relaxed text-[11px] font-medium">{item.details?.summary || 'No summary recorded.'}</p>
                  </div>

                  {/* Failure Breakdown if any */}
                  {hasFailingItems && (
                    <div className="mt-2.5">
                      <button
                        type="button"
                        onClick={() => toggleExpand(item.checkType)}
                        className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-rose-700 hover:text-rose-800 dark:text-rose-400 transition"
                      >
                        <span>
                          {isExpanded
                            ? 'Hide failing items'
                            : `View ${item.details.failingItems!.length} failing items`}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </button>

                      {isExpanded && (
                        <ul className="mt-2 space-y-1.5 rounded-lg border border-rose-200/80 bg-rose-50/40 p-2.5 text-[11px] dark:border-rose-900/60 dark:bg-rose-950/30">
                          {item.details.failingItems!.map((fail, idx) => (
                            <li
                              key={fail.id || idx}
                              className="flex items-start justify-between gap-2 py-0.5 border-b border-rose-100/60 last:border-b-0 dark:border-rose-900/30"
                            >
                              <span className="font-semibold text-slate-800 dark:text-slate-200">{fail.name || fail.id}:</span>
                              <span className="text-rose-600 dark:text-rose-400 font-medium text-right">
                                {fail.reason || 'Requirement not met'}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              );
            };

            const leftColumn = results.filter((_, idx) => idx % 2 === 0);
            const rightColumn = results.filter((_, idx) => idx % 2 !== 0);

            return (
              <div className="grid gap-3 sm:grid-cols-2 items-start">
                <div className="flex flex-col gap-3">
                  {leftColumn.map(renderCheckCard)}
                </div>
                <div className="flex flex-col gap-3">
                  {rightColumn.map(renderCheckCard)}
                </div>
              </div>
            );
          })()
        )}
      </div>

      {/* Footer Audit Stats */}
      {results.length > 0 && (
        <div className="flex flex-wrap items-center justify-between border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/50">
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Passed: <strong className="text-emerald-700 font-bold dark:text-emerald-400">{purePassedChecks}</strong>
            </span>
            {naChecks > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-slate-400" />
                N/A: <strong className="text-slate-700 font-bold dark:text-slate-300">{naChecks}</strong>
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              Exceptions: <strong className={failingChecks > 0 ? 'text-rose-700 font-bold dark:text-rose-400' : 'text-slate-600'}>{failingChecks}</strong>
            </span>
          </div>
          <span className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
            <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
            Immutable audit record &bull; Read-only validation
          </span>
        </div>
      )}
    </div>
  );
};

export default CampaignComplianceCard;
