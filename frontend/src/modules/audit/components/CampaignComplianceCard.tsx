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

  const totalChecks = results.length;
  const passedChecks = results.filter((r) => r.passed).length;
  const failingChecks = totalChecks - passedChecks;
  const isAllPassed = totalChecks > 0 && failingChecks === 0;

  const toggleExpand = (checkType: string) => {
    setExpandedCheck(expandedCheck === checkType ? null : checkType);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              isAllPassed
                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                : failingChecks > 0
                ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
            }`}
          >
            {isAllPassed ? (
              <ShieldCheck className="h-5 w-5" />
            ) : failingChecks > 0 ? (
              <ShieldAlert className="h-5 w-5" />
            ) : (
              <ShieldCheck className="h-5 w-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Compliance & Assurance Audit
              </h2>
              {totalChecks > 0 && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    isAllPassed
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                  }`}
                >
                  {isAllPassed ? '100% Compliant' : `${failingChecks} Non-Compliant`}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              {campaignName ? `Automated verification checks for ${campaignName}` : '6-point automated verification against contracts and field data'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {results.length > 0 && results[0]?.checkedAt && (
            <span className="hidden text-xs text-slate-400 lg:inline-block">
              Audited: {new Date(results[0].checkedAt).toLocaleDateString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            type="button"
            onClick={handleRunScan}
            disabled={scanning || loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#8B2424] px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#721c1c] disabled:opacity-50 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${scanning ? 'animate-spin' : ''}`} />
            <span>{scanning ? 'Auditing...' : 'Run Compliance Scan'}</span>
          </button>
        </div>
      </div>

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
          <div className="grid gap-3 sm:grid-cols-2">
            {results.map((item) => {
              const config = CHECK_CONFIG[item.checkType] || {
                title: item.checkType,
                description: 'Compliance verification check',
                icon: ShieldCheck,
              };
              const IconComponent = config.icon;
              const hasFailingItems =
                Boolean(item.details?.failingItems && item.details.failingItems.length > 0);
              const isExpanded = expandedCheck === item.checkType;

              return (
                <div
                  key={item._id || item.checkType}
                  className={`rounded-xl border p-4 transition ${
                    item.passed
                      ? 'border-slate-100 bg-slate-50/50 hover:border-slate-200 dark:border-slate-800 dark:bg-slate-800/20'
                      : 'border-rose-100 bg-rose-50/30 hover:border-rose-200 dark:border-rose-900/40 dark:bg-rose-950/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          item.passed
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                            : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400'
                        }`}
                      >
                        <IconComponent className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                          {config.title}
                        </h3>
                        <p className="text-[11px] text-slate-500">{config.description}</p>
                      </div>
                    </div>

                    <span
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        item.passed
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300'
                      }`}
                    >
                      {item.passed ? (
                        <>
                          <CheckCircle2 className="h-3 w-3" />
                          <span>PASS</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-3 w-3" />
                          <span>FAIL</span>
                        </>
                      )}
                    </span>
                  </div>

                  {/* Summary */}
                  <div className="mt-3 rounded-lg bg-white p-2.5 text-xs text-slate-700 border border-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                    <p className="leading-relaxed">{item.details?.summary || 'No summary recorded.'}</p>
                  </div>

                  {/* Failure Breakdown if any */}
                  {hasFailingItems && (
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => toggleExpand(item.checkType)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 hover:text-rose-800 dark:text-rose-400"
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
                        <ul className="mt-2 space-y-1 rounded-lg border border-rose-200 bg-rose-50/50 p-2 text-[11px] dark:border-rose-900 dark:bg-rose-950/30">
                          {item.details.failingItems!.map((fail, idx) => (
                            <li
                              key={fail.id || idx}
                              className="flex items-start justify-between gap-2 py-0.5 text-slate-700 dark:text-slate-300"
                            >
                              <span className="font-medium">{fail.name || fail.id}:</span>
                              <span className="text-rose-600 dark:text-rose-400">
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
            })}
          </div>
        )}
      </div>

      {/* Footer Audit Stats */}
      {results.length > 0 && (
        <div className="flex flex-wrap items-center justify-between border-t border-slate-100 bg-slate-50/50 px-5 py-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/50">
          <div className="flex items-center gap-4">
            <span>
              Passed: <strong className="text-emerald-600 font-semibold">{passedChecks}</strong> / {totalChecks}
            </span>
            <span>
              Exceptions: <strong className={failingChecks > 0 ? 'text-rose-600 font-semibold' : 'text-slate-600'}>{failingChecks}</strong>
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            Immutable audit record &bull; Read-only validation
          </span>
        </div>
      )}
    </div>
  );
};

export default CampaignComplianceCard;
