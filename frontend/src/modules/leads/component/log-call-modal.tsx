'use client';

import { useState } from 'react';
import { Button, Field, TextAreaField, SelectField } from '@/shared/ui';
import { FOLLOW_UP_TYPES, FOLLOW_UP_REASONS, type FollowUpType, type FollowUpReason } from '../types';

export interface LogFollowUpPayload {
  followUpType?: FollowUpType;
  campaignId?: string;
  reason?: string;
  remarks?: string;
  note?: string;
  nextActionDate?: string;
  delayResponsibility?: string;
  durationSec?: number;
}

export interface CampaignOption {
  id: string;
  name: string;
  campaignCode?: string;
}

export default function LogCallModal({
  open,
  onClose,
  onSubmit,
  campaigns = [],
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: LogFollowUpPayload) => Promise<void> | void;
  campaigns?: CampaignOption[];
}) {
  const [followUpType, setFollowUpType] = useState<FollowUpType>('Call');
  const [campaignId, setCampaignId] = useState<string>('');
  const [reason, setReason] = useState<string>('General Follow-up');
  const [remarks, setRemarks] = useState('');
  const [nextActionDate, setNextActionDate] = useState('');
  const [delayResponsibility, setDelayResponsibility] = useState('');
  const [durationSec, setDurationSec] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Log Follow-up / Action (ATR)</h3>
            <p className="text-xs text-slate-500">Record interaction summary, next action date, and reason.</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectField
              label="Type of Follow-Up *"
              value={followUpType}
              onChange={(e) => setFollowUpType(e.target.value as FollowUpType)}
              options={FOLLOW_UP_TYPES.map((t) => ({ value: t, label: t }))}
            />

            <SelectField
              label="Reason for Follow-up"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              options={FOLLOW_UP_REASONS.map((r) => ({ value: r, label: r }))}
            />
          </div>

          <TextAreaField
            label="Conversation Remarks & Key Points *"
            placeholder="What was discussed? (e.g. Client requested 10% discount on Bandra Billboard, agreed to review quotation by Thursday)..."
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={3}
          />

          {campaigns.length > 0 && (
            <SelectField
              label="Tag to Campaign (Optional)"
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              placeholder="-- General / No specific campaign --"
              options={[
                { value: '', label: '-- General / No specific campaign --' },
                ...campaigns.map((c) => ({
                  value: c.id,
                  label: c.campaignCode ? `${c.name} (${c.campaignCode})` : c.name,
                })),
              ]}
            />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Next Action Date"
              type="datetime-local"
              min={new Date().toISOString().slice(0, 16)}
              value={nextActionDate}
              onChange={(e) => setNextActionDate(e.target.value)}
            />

            <SelectField
              label="Delay Responsibility (If any)"
              value={delayResponsibility}
              onChange={(e) => setDelayResponsibility(e.target.value)}
              placeholder="None / On Time"
              options={[
                { value: 'Agent / Sales Rep', label: 'Agent / Sales Rep' },
                { value: 'Client Delay', label: 'Client Delay' },
                { value: 'Operations / Media Site', label: 'Operations / Media Site' },
                { value: 'Management Review', label: 'Management Review' },
              ]}
            />
          </div>

          {followUpType === 'Call' && (
            <Field
              label="Call Duration (seconds)"
              type="number"
              min="0"
              placeholder="e.g. 120"
              value={durationSec}
              onChange={(e) => setDurationSec(e.target.value)}
            />
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            disabled={!remarks.trim()}
            onClick={async () => {
              setIsSubmitting(true);
              try {
                await onSubmit({
                  followUpType,
                  campaignId: campaignId || undefined,
                  reason,
                  remarks: remarks.trim(),
                  note: remarks.trim(),
                  nextActionDate: nextActionDate ? new Date(nextActionDate).toISOString() : undefined,
                  delayResponsibility: delayResponsibility || undefined,
                  durationSec: durationSec ? Number(durationSec) : undefined,
                });
                onClose();
              } finally {
                setIsSubmitting(false);
              }
            }}
            isLoading={isSubmitting}
          >
            Save Action Record
          </Button>
        </div>
      </div>
    </div>
  );
}
