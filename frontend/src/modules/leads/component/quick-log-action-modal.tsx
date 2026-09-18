'use client';

import { useState, useEffect, useRef } from 'react';
import { Modal, Button, Field, TextAreaField, SelectField, Spinner, Badge } from '@/shared/ui';
import { leadsApi } from '../api';
import {
  Lead,
  LeadStatus,
  FOLLOW_UP_TYPES,
  FOLLOW_UP_REASONS,
  type FollowUpType,
  type FollowUpReason,
  type LogCallValues,
} from '../types';
import {
  Search,
  Phone,
  MessageSquare,
  Users,
  Calendar,
  Building2,
  Clock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  X,
  ExternalLink,
} from 'lucide-react';

interface QuickLogActionModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function QuickLogActionModal({
  open,
  onClose,
  onSuccess,
}: QuickLogActionModalProps) {
  // Search & Selection State
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Lead[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [leadDetails, setLeadDetails] = useState<Lead | null>(null);

  // Form State
  const [followUpType, setFollowUpType] = useState<FollowUpType>('Call');
  const [reason, setReason] = useState<FollowUpReason>('General Follow-up');
  const [contactedPerson, setContactedPerson] = useState('');
  const [note, setNote] = useState('');
  const [nextActionDate, setNextActionDate] = useState('');
  const [statusUpdate, setStatusUpdate] = useState<string>('');
  const [lostReason, setLostReason] = useState<string>('');
  const [durationSec, setDurationSec] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Quick Profile updates
  const [showProfileUpdates, setShowProfileUpdates] = useState(false);
  const [budgetRupees, setBudgetRupees] = useState('');
  const [email, setEmail] = useState('');
  const [secondaryContact, setSecondaryContact] = useState('');
  const [secondaryMobile, setSecondaryMobile] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');

  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Reset state on open/close
  useEffect(() => {
    if (open) {
      setSearchTerm('');
      setSearchResults([]);
      setSelectedLead(null);
      setLeadDetails(null);
      setFollowUpType('Call');
      setReason('General Follow-up');
      setContactedPerson('');
      setNote('');
      setNextActionDate('');
      setStatusUpdate('');
      setLostReason('');
      setDurationSec('');
      setErrorMsg('');
      setShowProfileUpdates(false);
      setBudgetRupees('');
      setEmail('');
      setSecondaryContact('');
      setSecondaryMobile('');
      setCompanyAddress('');
    }
  }, [open]);

  // Live Debounced Lead Search
  useEffect(() => {
    if (!open || selectedLead) return;

    if (!searchTerm.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    searchDebounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await leadsApi.list({ search: searchTerm.trim(), limit: 8 });
        setSearchResults(res.data || []);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchTerm, open, selectedLead]);

  // Load Lead details upon selection
  const handleSelectLead = async (lead: Lead) => {
    setSelectedLead(lead);
    setSearchTerm('');
    setSearchResults([]);
    setContactedPerson(lead.contactPerson || '');
    setBudgetRupees(lead.qualification?.budget ? String(Math.round(lead.qualification.budget / 100)) : '');
    setEmail(lead.email || '');
    setSecondaryContact(lead.secondaryContactPerson || '');
    setSecondaryMobile(lead.secondaryMobile || '');
    setCompanyAddress(lead.companyAddress || '');
    setStatusUpdate('');
    setLostReason('');
    setDurationSec('');

    setLoadingDetails(true);
    try {
      const full = await leadsApi.getLead(lead._id || lead.id);
      setLeadDetails(full);
      if (full.contactPerson) setContactedPerson(full.contactPerson);
      if (full.email) setEmail(full.email);
    } catch {
      setLeadDetails(lead);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleResetSelection = () => {
    setSelectedLead(null);
    setLeadDetails(null);
    setContactedPerson('');
    setNote('');
    setStatusUpdate('');
    setLostReason('');
    setDurationSec('');
    setEmail('');
    setErrorMsg('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) {
      setErrorMsg('Please search and select a lead first');
      return;
    }
    if (!note.trim()) {
      setErrorMsg('Please enter discussion notes / remarks');
      return;
    }
    if (statusUpdate === 'Lost' && !lostReason.trim() && !note.trim()) {
      setErrorMsg('Please specify a reason for marking this lead as Lost');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const payload: LogCallValues = {
        followUpType,
        reason,
        contactedPerson: contactedPerson.trim() || selectedLead.contactPerson,
        remarks: note.trim(),
        note: note.trim(),
        ...(nextActionDate ? { nextActionDate } : {}),
      };

      if (followUpType === 'Call' && durationSec.trim()) {
        const sec = Number(durationSec);
        if (!isNaN(sec) && sec >= 0) payload.durationSec = sec;
      }

      if (showProfileUpdates) {
        if (budgetRupees.trim()) {
          const num = Number(budgetRupees);
          if (!isNaN(num) && num >= 0) payload.budget = num;
        }
        if (email.trim()) payload.email = email.trim();
        if (secondaryContact.trim()) payload.secondaryContactPerson = secondaryContact.trim();
        if (secondaryMobile.trim()) payload.secondaryMobile = secondaryMobile.trim();
        if (companyAddress.trim()) payload.companyAddress = companyAddress.trim();
      }

      await leadsApi.logFollowUp(selectedLead._id || selectedLead.id, payload);

      if (statusUpdate && statusUpdate !== selectedLead.status) {
        await leadsApi.changeStatus(selectedLead._id || selectedLead.id, {
          status: statusUpdate as LeadStatus,
          lostReason: statusUpdate === 'Lost' ? (lostReason.trim() || note.trim()) : undefined,
        });
      }

      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save action record');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Find latest call log
  const latestLog = leadDetails?.callLogs && leadDetails.callLogs.length > 0
    ? leadDetails.callLogs[leadDetails.callLogs.length - 1]
    : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Quick Log Action (ATR)"
      className="!max-w-xl max-h-[90vh] overflow-y-auto"
    >
      <div className="space-y-4 pt-1">
        {/* Step 1: Lead Search (if no lead is selected) */}
        {!selectedLead ? (
          <div className="space-y-3">
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Search Lead to Log Action *
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Type Company Name, Contact Person, or Mobile Number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-8 h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-3 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Live Search Results List */}
            {isSearching ? (
              <div className="py-6 flex justify-center items-center gap-2 text-xs text-slate-500">
                <Spinner className="w-4 h-4" />
                <span>Searching active leads...</span>
              </div>
            ) : searchResults.length > 0 ? (
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg divide-y divide-slate-100 dark:divide-slate-800 max-h-60 overflow-y-auto">
                {searchResults.map((lead) => (
                  <button
                    key={lead._id || lead.id}
                    type="button"
                    onClick={() => handleSelectLead(lead)}
                    className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex items-center justify-between gap-3 group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-900 dark:text-white group-hover:text-primary transition-colors truncate">
                          {lead.companyName}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-medium shrink-0">
                          {lead.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-3">
                        <span>{lead.contactPerson}</span>
                        <span>•</span>
                        <span>{lead.mobile}</span>
                        {lead.city && (
                          <>
                            <span>•</span>
                            <span>{lead.city}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded">
                        Select
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : searchTerm.trim() ? (
              <div className="py-6 text-center text-xs text-slate-400">
                No matching leads found for "{searchTerm}".
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-500 space-y-1">
                <p className="font-medium text-slate-700 dark:text-slate-300">💡 Quick Dial / Log Action Shortcut:</p>
                <p>Type any client's name or mobile number above to select them and log a call or meeting note immediately.</p>
              </div>
            )}
          </div>
        ) : (
          /* Step 2: Selected Lead View & Action Form */
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Selected Lead Banner */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 bg-slate-50 dark:bg-slate-900/60 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-slate-900 dark:text-white">
                    {selectedLead.companyName}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300 font-medium">
                    {selectedLead.status}
                  </span>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 flex items-center gap-3 flex-wrap">
                  <span>Contact: <strong>{selectedLead.contactPerson}</strong></span>
                  <span>•</span>
                  <span>Phone: <strong>{selectedLead.mobile}</strong></span>
                  {selectedLead.city && (
                    <>
                      <span>•</span>
                      <span>City: {selectedLead.city}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2.5 shrink-0 text-xs">
                <a
                  href={`/leads/${selectedLead._id || selectedLead.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Lead</span>
                </a>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <button
                  type="button"
                  onClick={handleResetSelection}
                  className="text-slate-500 hover:text-primary underline font-medium"
                >
                  Change
                </button>
              </div>
            </div>

            {/* Context Card: Previous Interaction History */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-amber-50/60 dark:bg-amber-950/20 p-3 text-xs">
              <div className="flex items-center gap-1.5 text-amber-900 dark:text-amber-300 font-semibold mb-1">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Last Interaction / Previous Note:</span>
              </div>
              {loadingDetails ? (
                <div className="py-2 flex items-center gap-2 text-slate-400">
                  <Spinner className="w-3 h-3" />
                  <span>Loading past logs...</span>
                </div>
              ) : latestLog ? (
                <div className="space-y-1 text-slate-700 dark:text-slate-300">
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-wrap">
                    <span className="font-medium text-amber-800 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-900/40 px-1.5 py-0.5 rounded">
                      {latestLog.followUpType || 'Call'}
                    </span>
                    <span>with {latestLog.contactedPerson || selectedLead.contactPerson}</span>
                    <span>•</span>
                    <span>{new Date(latestLog.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="italic bg-white/70 dark:bg-slate-900/60 p-2 rounded border border-amber-200/50 dark:border-amber-900/40 text-slate-800 dark:text-slate-200">
                    &ldquo;{latestLog.note || latestLog.remarks || 'No discussion note'}&rdquo;
                  </p>
                  {latestLog.nextActionDate && (
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1 font-medium">
                      Next Follow-up set to: {new Date(latestLog.nextActionDate).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-slate-500 italic">
                  No previous follow-up calls or meetings logged for this lead yet. This will be the first action record.
                </p>
              )}
            </div>

            {/* Action Entry Form */}
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <SelectField
                  label="Interaction Type *"
                  value={followUpType}
                  onChange={(e) => setFollowUpType(e.target.value as FollowUpType)}
                  options={FOLLOW_UP_TYPES.map((t) => ({ label: t, value: t }))}
                />
                <SelectField
                  label="Reason / Purpose *"
                  value={reason}
                  onChange={(e) => setReason(e.target.value as FollowUpReason)}
                  options={FOLLOW_UP_REASONS.map((r) => ({ label: r, value: r }))}
                />
              </div>

              {/* Status Update & Duration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <SelectField
                  label="Update Lead Status (Optional)"
                  value={statusUpdate}
                  onChange={(e) => setStatusUpdate(e.target.value)}
                  options={[
                    { label: `Keep Current (${selectedLead.status})`, value: '' },
                    { label: 'Contacted', value: 'Contacted' },
                    { label: 'Interested', value: 'Interested' },
                    { label: 'Qualified', value: 'Qualified' },
                    { label: 'Proposal Sent', value: 'Proposal Sent' },
                    { label: 'Negotiation', value: 'Negotiation' },
                    { label: 'Won', value: 'Won' },
                    { label: 'Lost', value: 'Lost' },
                  ]}
                />
                {followUpType === 'Call' ? (
                  <Field
                    label="Call Duration (seconds)"
                    type="number"
                    min="0"
                    placeholder="e.g. 120 (2 mins)"
                    value={durationSec}
                    onChange={(e) => setDurationSec(e.target.value)}
                  />
                ) : (
                  <div className="hidden sm:block" />
                )}
              </div>

              {statusUpdate === 'Lost' && (
                <Field
                  label="Reason for Marking Lost *"
                  placeholder="e.g. Budget constraint, competitor chosen, timeline delayed..."
                  value={lostReason}
                  onChange={(e) => setLostReason(e.target.value)}
                  required
                />
              )}

              {/* Contacted Person */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Contacted Person
                </label>
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <button
                    type="button"
                    onClick={() => setContactedPerson(selectedLead.contactPerson || '')}
                    className={`px-2.5 py-1 rounded border transition-colors ${
                      contactedPerson === selectedLead.contactPerson
                        ? 'border-primary bg-primary/10 text-primary font-medium'
                        : 'border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700'
                    }`}
                  >
                    Primary: {selectedLead.contactPerson}
                  </button>
                  {selectedLead.secondaryContactPerson && (
                    <button
                      type="button"
                      onClick={() => setContactedPerson(selectedLead.secondaryContactPerson || '')}
                      className={`px-2.5 py-1 rounded border transition-colors ${
                        contactedPerson === selectedLead.secondaryContactPerson
                          ? 'border-primary bg-primary/10 text-primary font-medium'
                          : 'border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700'
                      }`}
                    >
                      Secondary: {selectedLead.secondaryContactPerson}
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Or type specific person name..."
                  value={contactedPerson}
                  onChange={(e) => setContactedPerson(e.target.value)}
                  className="w-full mt-1.5 px-3 h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Discussion Notes */}
              <TextAreaField
                label="Discussion Notes / Remarks *"
                placeholder="What was discussed with the client? e.g. Agreed on budget, requested billboard locations, follow-up scheduled..."
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                required
              />

              {/* Next Action Date */}
              <Field
                label="Next Follow-up Date & Time"
                type="datetime-local"
                min={new Date().toISOString().slice(0, 16)}
                value={nextActionDate}
                onChange={(e) => setNextActionDate(e.target.value)}
              />

              {/* Toggle Profile Updates */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowProfileUpdates(!showProfileUpdates)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                >
                  {showProfileUpdates ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  <span>Quick Lead Profile Updates (Optional)</span>
                </button>

                {showProfileUpdates && (
                  <div className="space-y-3 mt-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field
                        label="Budget (₹ Rupees)"
                        type="number"
                        placeholder="e.g. 500000"
                        value={budgetRupees}
                        onChange={(e) => setBudgetRupees(e.target.value)}
                      />
                      <Field
                        label="Official Email ID"
                        type="email"
                        placeholder="e.g. contact@client.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field
                        label="Secondary Contact Person"
                        placeholder="e.g. Rahul Sharma"
                        value={secondaryContact}
                        onChange={(e) => setSecondaryContact(e.target.value)}
                      />
                      <Field
                        label="Secondary Mobile"
                        placeholder="e.g. 9876543210"
                        value={secondaryMobile}
                        onChange={(e) => setSecondaryMobile(e.target.value)}
                      />
                    </div>
                    <Field
                      label="Company Address / Location"
                      placeholder="e.g. AB Road, Indore"
                      value={companyAddress}
                      onChange={(e) => setCompanyAddress(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>

            {errorMsg && (
              <p className="text-xs text-rose-600 font-medium bg-rose-50 dark:bg-rose-950/40 p-2 rounded">
                {errorMsg}
              </p>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                isLoading={isSubmitting}
                className="bg-primary hover:bg-primary-600 text-white text-xs font-semibold"
              >
                Save Action Record
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
