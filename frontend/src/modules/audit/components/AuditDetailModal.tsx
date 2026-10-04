'use client';

import { X, FileText, Check, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import type { AuditLogEntry } from '../types';
import { getBusinessActivityInfo } from '../audit-helpers';

interface AuditDetailModalProps {
  entry: AuditLogEntry | null;
  onClose: () => void;
}

export function AuditDetailModal({ entry, onClose }: AuditDetailModalProps) {
  const [copied, setCopied] = useState(false);
  const [showTechnical, setShowTechnical] = useState(false);

  if (!entry) return null;

  const activity = getBusinessActivityInfo(entry);

  const handleCopy = () => {
    const jsonStr = JSON.stringify(entry.payload || entry, null, 2);
    navigator.clipboard.writeText(jsonStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getActionBadge = (action: string) => {
    switch (action.toLowerCase()) {
      case 'create':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800';
      case 'update':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800';
      case 'delete':
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800';
      case 'login':
        return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800';
      case 'login_failed':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2.5">
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${getActionBadge(entry.action)}`}>
                {entry.action}
              </span>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                {activity.title}
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Recorded on {new Date(entry.createdAt).toLocaleString('en-IN', {
                dateStyle: 'medium',
                timeStyle: 'medium',
              })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Business Summary Card */}
          <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-100 bg-slate-50/70 p-4 text-xs dark:border-slate-800 dark:bg-slate-800/40">
            <div>
              <span className="text-slate-400 font-medium">Activity & Source:</span>
              <p className="font-semibold text-slate-900 dark:text-white mt-0.5">
                {activity.title}
              </p>
              <span className={`inline-flex items-center rounded-md border px-2 py-0.5 mt-1 text-[10px] font-medium ${activity.badgeColor}`}>
                {activity.channel}
              </span>
            </div>

            <div>
              <span className="text-slate-400 font-medium">Performed By:</span>
              <p className="font-semibold text-slate-900 dark:text-white mt-0.5">
                {entry.actorEmail || 'System / Automated'}
              </p>
              {entry.actorRole && (
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block mt-0.5">
                  Role: {entry.actorRole}
                </span>
              )}
            </div>

            <div>
              <span className="text-slate-400 font-medium">Module / Entity:</span>
              <p className="font-semibold text-slate-900 dark:text-white mt-0.5 capitalize">
                {entry.entity}
              </p>
              {entry.entityId && (
                <p className="font-mono text-[11px] text-slate-500 truncate mt-0.5" title={entry.entityId}>
                  Record ID: #{entry.entityId.slice(-8)}
                </p>
              )}
            </div>

            <div>
              <span className="text-slate-400 font-medium">Operation Status:</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${!entry.statusCode || entry.statusCode < 400 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {entry.statusCode ? `${entry.statusCode} ${entry.statusCode < 400 ? 'Success' : 'Failed'}` : 'Recorded'}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Immutable audit ledger entry
              </span>
            </div>
          </div>

          {/* Field Changes (Diff View) */}
          {entry.changes && entry.changes.length > 0 && (
            <div>
              <h3 className="mb-2.5 text-xs font-semibold text-slate-900 uppercase tracking-wider dark:text-white">
                Recorded Field Changes ({entry.changes.length})
              </h3>
              <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
                    <tr>
                      <th className="px-4 py-2.5">Field</th>
                      <th className="px-4 py-2.5 text-rose-600 dark:text-rose-400">Previous Value (From)</th>
                      <th className="px-4 py-2.5 text-emerald-600 dark:text-emerald-400">New Value (To)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px] dark:divide-slate-800">
                    {entry.changes.map((change, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-2.5 font-semibold text-slate-800 dark:text-slate-200">
                          {change.field}
                        </td>
                        <td className="px-4 py-2.5 text-rose-700 bg-rose-50/30 dark:bg-rose-950/20 dark:text-rose-300 break-all">
                          {change.from !== undefined && change.from !== null
                            ? typeof change.from === 'object'
                              ? JSON.stringify(change.from)
                              : String(change.from)
                            : '<empty>'}
                        </td>
                        <td className="px-4 py-2.5 text-emerald-700 bg-emerald-50/30 dark:bg-emerald-950/20 dark:text-emerald-300 break-all">
                          {change.to !== undefined && change.to !== null
                            ? typeof change.to === 'object'
                              ? JSON.stringify(change.to)
                              : String(change.to)
                            : '<empty>'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Technical & Developer Details (Collapsible) */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/40 overflow-hidden dark:border-slate-800 dark:bg-slate-800/30">
            <button
              type="button"
              onClick={() => setShowTechnical(!showTechnical)}
              className="w-full flex items-center justify-between p-3.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100/60 dark:text-slate-300 dark:hover:bg-slate-800/60 transition"
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-400" />
                <span>Technical & Developer Details (Endpoint, IP & Raw JSON)</span>
              </div>
              {showTechnical ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </button>

            {showTechnical && (
              <div className="border-t border-slate-200 p-4 space-y-4 dark:border-slate-800 bg-white dark:bg-slate-900/60">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 font-medium text-[11px]">API Route & Method:</span>
                    <p className="font-mono text-[11px] text-slate-900 dark:text-white mt-0.5">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{entry.method || 'N/A'}</span> {entry.path || ''}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium text-[11px]">Client IP & Network:</span>
                    <p className="font-mono text-[11px] text-slate-900 dark:text-white mt-0.5">
                      {entry.ip || 'Local / Internal'}
                    </p>
                  </div>
                  {entry.userAgent && (
                    <div className="col-span-2">
                      <span className="text-slate-400 font-medium text-[11px]">User Agent / Client Device:</span>
                      <p className="truncate font-mono text-[10px] text-slate-500 mt-0.5" title={entry.userAgent}>
                        {entry.userAgent}
                      </p>
                    </div>
                  )}
                </div>

                {/* Payload JSON View */}
                {entry.payload !== undefined && entry.payload !== null && (
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        Raw Request Body
                      </span>
                      <button
                        type="button"
                        onClick={handleCopy}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition"
                      >
                        {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <FileText className="h-3 w-3" />}
                        <span>{copied ? 'Copied' : 'Copy JSON'}</span>
                      </button>
                    </div>
                    <pre className="max-h-40 overflow-auto rounded-lg border border-slate-200 bg-slate-950 p-3 text-[11px] font-mono text-emerald-400 dark:border-slate-800">
                      {JSON.stringify(entry.payload, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-slate-200 px-6 py-3.5 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 transition shadow-xs"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}
