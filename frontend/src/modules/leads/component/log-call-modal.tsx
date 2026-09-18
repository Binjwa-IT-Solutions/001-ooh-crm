'use client';

import { useState } from 'react';
import { Button, Field, TextAreaField, SelectField } from '@/shared/ui';
import { ChevronDown } from 'lucide-react';
import { FOLLOW_UP_TYPES, FOLLOW_UP_REASONS, type FollowUpType } from '../types';

function toLocalDatetimeString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getMinLoggedAt(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(0, 0, 0, 0);
  return toLocalDatetimeString(d);
}

function getMaxLoggedAt(): string {
  return toLocalDatetimeString(new Date());
}

export interface LogFollowUpPayload {
  followUpType?: FollowUpType;
  contactedPerson?: string;
  campaignId?: string;
  reason?: string;
  remarks?: string;
  note?: string;
  loggedAt?: string;
  nextActionDate?: string;
  delayResponsibility?: string;
  durationSec?: number;
  // Quick profile updates
  budget?: number;
  companyAddress?: string;
  companyLocation?: string;
  email?: string;
  secondaryContactPerson?: string;
  secondaryDesignation?: string;
  secondaryMobile?: string;
}

export interface CampaignOption {
  id: string;
  name: string;
  campaignCode?: string;
}

export interface ContactOption {
  name: string;
  role?: string;
  designation?: string;
  phone?: string;
}

interface LogCallModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: LogFollowUpPayload) => Promise<void> | void;
  campaigns?: CampaignOption[];
  contacts?: ContactOption[];
  leadDefaults?: {
    budget?: number;
    companyAddress?: string;
    companyLocation?: string;
    email?: string;
    secondaryContactPerson?: string;
    secondaryDesignation?: string;
    secondaryMobile?: string;
  };
}

export default function LogCallModal(props: LogCallModalProps) {
  if (!props.open) return null;
  return <LogCallModalContent {...props} />;
}

function LogCallModalContent({
  onClose,
  onSubmit,
  campaigns = [],
  contacts = [],
  leadDefaults,
}: LogCallModalProps) {
  const [followUpType, setFollowUpType] = useState<FollowUpType>('Call');
  const [contactedPerson, setContactedPerson] = useState<string>(() => {
    if (contacts.length > 0) {
      return contacts[0].designation ? `${contacts[0].name} (${contacts[0].designation})` : contacts[0].name;
    }
    return '';
  });
  const [campaignId, setCampaignId] = useState<string>('');
  const [reason, setReason] = useState<string>('General Follow-up');
  const [remarks, setRemarks] = useState('');
  const [loggedAt, setLoggedAt] = useState(() => toLocalDatetimeString(new Date()));
  const [nextActionDate, setNextActionDate] = useState('');
  const [delayResponsibility, setDelayResponsibility] = useState('');
  const [durationSec, setDurationSec] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Quick profile updates
  const [showQuickUpdate, setShowQuickUpdate] = useState(false);
  const [quickBudget, setQuickBudget] = useState(() => (leadDefaults?.budget ? String(leadDefaults.budget / 100) : ''));
  const [quickEmail, setQuickEmail] = useState(() => leadDefaults?.email || '');
  const [quickAddress, setQuickAddress] = useState(() => leadDefaults?.companyAddress || '');
  const [quickLocation, setQuickLocation] = useState(() => leadDefaults?.companyLocation || '');
  const [quickSecondaryName, setQuickSecondaryName] = useState(() => leadDefaults?.secondaryContactPerson || '');
  const [quickSecondaryDesignation, setQuickSecondaryDesignation] = useState(() => leadDefaults?.secondaryDesignation || '');
  const [quickSecondaryPhone, setQuickSecondaryPhone] = useState(() => leadDefaults?.secondaryMobile || '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Log Follow-up / Action (ATR)</h3>
            <p className="text-xs text-slate-500">Record interaction summary, contacted person, and next action.</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {/* Contacted Person Selector */}
          {contacts && contacts.length > 0 && (
            <SelectField
              label="Contacted Person / Followed up with *"
              value={contactedPerson}
              onChange={(e) => setContactedPerson(e.target.value)}
              options={[
                ...contacts.map((c) => ({
                  value: c.designation ? `${c.name} (${c.designation})` : c.name,
                  label: `${c.name}${c.designation ? ` (${c.designation})` : ''} ${c.role ? `• ${c.role}` : ''} ${c.phone ? `(${c.phone})` : ''}`,
                })),
                { value: 'Both Contacts', label: 'Both Primary & Secondary Contacts' },
                { value: 'Other / Office Rep', label: 'Other Representative / Reception' },
              ]}
            />
          )}

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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Field
                label="Logged At (Interaction Time) *"
                type="datetime-local"
                min={getMinLoggedAt()}
                max={getMaxLoggedAt()}
                value={loggedAt}
                onChange={(e) => setLoggedAt(e.target.value)}
                required
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Backdating allowed up to 1 day prior (yesterday).
              </p>
            </div>

            {followUpType === 'Call' ? (
              <Field
                label="Call Duration (seconds)"
                type="number"
                min="0"
                placeholder="e.g. 120"
                value={durationSec}
                onChange={(e) => setDurationSec(e.target.value)}
              />
            ) : (
              <div className="hidden sm:block" />
            )}
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
              type="date"
              min={new Date().toISOString().slice(0, 10)}
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

          {/* Quick Profile Updates Toggle */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowQuickUpdate(!showQuickUpdate)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8B2424] hover:text-[#6E1D1D] dark:text-red-400 dark:hover:text-red-300 transition"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showQuickUpdate ? 'rotate-180' : ''}`} />
              <span>{showQuickUpdate ? 'Hide Quick Profile Updates' : '+ Update Lead Details (Budget / Email / Address / 2nd Contact)'}</span>
            </button>

            {showQuickUpdate && (
              <div className="mt-3 p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3 text-xs">
                <p className="text-slate-500 font-medium">Record any new details shared by client during this interaction:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field
                    label="Estimated Budget (₹ Rupees)"
                    type="number"
                    min="0"
                    placeholder="e.g. 500000"
                    value={quickBudget}
                    onChange={(e) => setQuickBudget(e.target.value)}
                  />
                  <Field
                    label="Official Email ID"
                    type="email"
                    placeholder="e.g. contact@client.com"
                    value={quickEmail}
                    onChange={(e) => setQuickEmail(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field
                    label="Company Location / Area"
                    placeholder="e.g. BKC / Andheri East"
                    value={quickLocation}
                    onChange={(e) => setQuickLocation(e.target.value)}
                  />
                  <Field
                    label="Company Address"
                    placeholder="e.g. Suite 402, Trade Tower"
                    value={quickAddress}
                    onChange={(e) => setQuickAddress(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-slate-200 dark:border-slate-700">
                  <Field
                    label="2nd Contact Name"
                    placeholder="e.g. Amit Verma"
                    value={quickSecondaryName}
                    onChange={(e) => setQuickSecondaryName(e.target.value)}
                  />
                  <Field
                    label="2nd Designation"
                    placeholder="e.g. Media Planner"
                    value={quickSecondaryDesignation}
                    onChange={(e) => setQuickSecondaryDesignation(e.target.value)}
                  />
                  <Field
                    label="2nd Mobile"
                    type="tel"
                    placeholder="+91 91234 56789"
                    value={quickSecondaryPhone}
                    onChange={(e) => setQuickSecondaryPhone(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            disabled={!remarks.trim()}
            onClick={async () => {
              if (loggedAt) {
                const loggedDate = new Date(loggedAt);
                const minAllowed = new Date();
                minAllowed.setDate(minAllowed.getDate() - 1);
                minAllowed.setHours(0, 0, 0, 0);
                const maxAllowed = new Date(Date.now() + 5 * 60 * 1000);

                if (loggedDate > maxAllowed) {
                  alert('Logged At date & time cannot be in the future.');
                  return;
                }
                if (loggedDate < minAllowed) {
                  alert('Logged At date cannot be more than 1 day in the past.');
                  return;
                }
              }

              setIsSubmitting(true);
              try {
                const payload: LogFollowUpPayload = {
                  followUpType,
                  contactedPerson: contactedPerson || undefined,
                  campaignId: campaignId || undefined,
                  reason,
                  remarks: remarks.trim(),
                  note: remarks.trim(),
                  loggedAt: loggedAt ? new Date(loggedAt).toISOString() : undefined,
                  nextActionDate: nextActionDate ? new Date(nextActionDate).toISOString() : undefined,
                  delayResponsibility: delayResponsibility || undefined,
                  durationSec: durationSec ? Number(durationSec) : undefined,
                };

                if (showQuickUpdate) {
                  if (quickBudget) payload.budget = Number(quickBudget);
                  if (quickEmail.trim()) payload.email = quickEmail.trim();
                  if (quickAddress.trim()) payload.companyAddress = quickAddress.trim();
                  if (quickLocation.trim()) payload.companyLocation = quickLocation.trim();
                  if (quickSecondaryName.trim()) payload.secondaryContactPerson = quickSecondaryName.trim();
                  if (quickSecondaryDesignation.trim()) payload.secondaryDesignation = quickSecondaryDesignation.trim();
                  if (quickSecondaryPhone.trim()) payload.secondaryMobile = quickSecondaryPhone.trim();
                }

                await onSubmit(payload);
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
