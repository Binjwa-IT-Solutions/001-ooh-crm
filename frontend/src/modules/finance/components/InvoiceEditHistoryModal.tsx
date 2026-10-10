'use client';

import { X, History, User, Clock, FileText } from 'lucide-react';
import type { InvoiceEditLog } from '../types';

interface InvoiceEditHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceNumber: string;
  history: InvoiceEditLog[];
}

export function InvoiceEditHistoryModal({
  isOpen,
  onClose,
  invoiceNumber,
  history,
}: InvoiceEditHistoryModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in-50">
      <div className="relative w-full max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F8E6E6] text-[#6E1D1D]">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Invoice Edit History</h3>
              <p className="text-xs text-slate-500">Audit trail for {invoiceNumber}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 max-h-[420px] overflow-y-auto pr-1 space-y-3">
          {history.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              <FileText className="mx-auto h-8 w-8 text-slate-300 mb-2" />
              No modifications recorded yet.
            </div>
          ) : (
            history.map((log, idx) => (
              <div
                key={idx}
                className="relative flex gap-3 rounded-lg border border-slate-100 bg-slate-50/60 p-3.5 text-xs transition-all hover:bg-slate-50"
              >
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white border border-slate-200 text-slate-600">
                  <User className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900">
                      {log.modifiedBy?.name || 'System User'}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-slate-400">
                      <Clock className="h-3 w-3" />
                      {new Date(log.modifiedAt).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </span>
                  </div>
                  <p className="mt-1 font-medium text-slate-700 leading-relaxed">
                    {log.changesSummary}
                  </p>
                  {log.note && (
                    <p className="mt-1 text-[11px] text-slate-500 italic bg-white p-1.5 rounded border border-slate-100">
                      Note: &ldquo;{log.note}&rdquo;
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-6 flex justify-end border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
