'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Field, Button, Alert, TextAreaField, SelectField } from '@/shared/ui';
import { LeadsSelect } from '@/modules/leads/components/leads-select';
import { leadsApi } from '@/modules/leads/api';
import { ChevronDown, ChevronUp, Users, Building2, Plus, X, Sparkles, Loader2 } from 'lucide-react';
import {
  Lead,
  LeadSource,
  FOLLOW_UP_TYPES,
  FOLLOW_UP_REASONS,
  type FollowUpType,
  type LocationPreference,
} from '@/modules/leads/types';

const SOURCES: { label: string; value: LeadSource }[] = [
  { label: 'JustDial', value: 'JustDial' },
  { label: 'Website', value: 'Website' },
  { label: 'WhatsApp', value: 'WhatsApp' },
  { label: 'Facebook', value: 'Facebook' },
  { label: 'Instagram', value: 'Instagram' },
  { label: 'Email', value: 'Email' },
  { label: 'Referral', value: 'Referral' },
  { label: 'Manual', value: 'Manual' },
];

export default function NewLeadPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showFollowUpSection, setShowFollowUpSection] = useState(true);
  const [showSecondaryContact, setShowSecondaryContact] = useState(false);

  // Form State for client profile (enables autocomplete & auto-fill)
  const [formState, setFormState] = useState({
    source: 'Manual' as LeadSource,
    companyName: '',
    email: '',
    city: '',
    companyLocation: '',
    companyAddress: '',
    contactPerson: '',
    designation: '',
    mobile: '',
    secondaryContactPerson: '',
    secondaryDesignation: '',
    secondaryMobile: '',
  });

  // Autocomplete / Typeahead State
  const [companySuggestions, setCompanySuggestions] = useState<Lead[]>([]);
  const [isSearchingCompany, setIsSearchingCompany] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [autofilledNotice, setAutofilledNotice] = useState<string | null>(null);

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const suggestionsContainerRef = useRef<HTMLDivElement | null>(null);

  // Field-level validations
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Close suggestions dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (suggestionsContainerRef.current && !suggestionsContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCompanyNameChange = (val: string) => {
    setFormState((prev) => ({ ...prev, companyName: val }));
    if (errors.companyName) setErrors((prev) => ({ ...prev, companyName: '' }));

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!val.trim() || val.trim().length < 2) {
      setCompanySuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsSearchingCompany(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await leadsApi.list({ search: val.trim(), limit: 6 });
        const seen = new Set<string>();
        const uniqueLeads: Lead[] = [];
        for (const l of res.data || []) {
          const norm = (l.companyName || '').trim().toLowerCase();
          if (norm && !seen.has(norm)) {
            seen.add(norm);
            uniqueLeads.push(l);
          }
        }
        setCompanySuggestions(uniqueLeads);
        setShowSuggestions(uniqueLeads.length > 0);
      } catch {
        setCompanySuggestions([]);
      } finally {
        setIsSearchingCompany(false);
      }
    }, 300);
  };

  const handleSelectCompany = (lead: Lead) => {
    setFormState((prev) => ({
      ...prev,
      companyName: lead.companyName || prev.companyName,
      contactPerson: lead.contactPerson || prev.contactPerson,
      designation: lead.designation || prev.designation,
      mobile: lead.mobile || prev.mobile,
      email: lead.email || prev.email,
      city: lead.city || prev.city,
      companyLocation: lead.companyLocation || prev.companyLocation,
      companyAddress: lead.companyAddress || prev.companyAddress,
      secondaryContactPerson: lead.secondaryContactPerson || prev.secondaryContactPerson,
      secondaryDesignation: lead.secondaryDesignation || prev.secondaryDesignation,
      secondaryMobile: lead.secondaryMobile || prev.secondaryMobile,
    }));

    if (lead.secondaryContactPerson || lead.secondaryMobile) {
      setShowSecondaryContact(true);
    }

    setAutofilledNotice(
      `Autofilled client details from "${lead.companyName}" (${lead.contactPerson || lead.mobile})`
    );
    setShowSuggestions(false);
    setCompanySuggestions([]);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setErrors({});

    const formData = new FormData(e.currentTarget);

    const {
      companyName,
      companyAddress,
      companyLocation,
      city,
      email,
      source,
      contactPerson,
      designation,
      mobile,
      secondaryContactPerson,
      secondaryDesignation,
      secondaryMobile,
    } = formState;

    // Optional follow-up & ATR fields
    const followUpType = formData.get('followUpType') as FollowUpType;
    const reason = formData.get('reason') as string;
    const remarks = formData.get('remarks') as string;
    const nextActionDate = formData.get('nextActionDate') as string;

    // Optional qualification fields
    const budget = formData.get('budget') ? Number(formData.get('budget')) : undefined;
    const locationPreference = formData.get('locationPreference') as LocationPreference;
    const campaignDuration = formData.get('campaignDuration') as string;

    // Basic frontend validation
    const newErrors: Record<string, string> = {};
    if (!source) newErrors.source = 'Source is required';
    if (!companyName.trim()) newErrors.companyName = 'Company name is required';
    if (!contactPerson.trim()) newErrors.contactPerson = 'Primary contact person is required';
    if (!mobile.trim()) newErrors.mobile = 'Primary mobile number is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setIsSubmitting(false);
      return;
    }

    const payload: any = {
      source,
      companyName: companyName.trim(),
      companyAddress: companyAddress.trim() || undefined,
      companyLocation: companyLocation.trim() || undefined,
      city: city.trim() || undefined,
      email: email.trim() || undefined,

      // Primary Concern Person
      contactPerson: contactPerson.trim(),
      designation: designation.trim() || undefined,
      mobile: mobile.trim(),

      // Secondary Concern Person (Optional)
      secondaryContactPerson: secondaryContactPerson.trim() || undefined,
      secondaryDesignation: secondaryDesignation.trim() || undefined,
      secondaryMobile: secondaryMobile.trim() || undefined,
    };

    if (remarks && remarks.trim()) {
      payload.followUpType = followUpType || 'Call';
      payload.reason = reason || 'Initial Contact';
      payload.remarks = remarks.trim();
      payload.note = remarks.trim();
    }

    if (nextActionDate) {
      const scheduled = new Date(`${nextActionDate}T11:00:00`);
      payload.nextActionDate = isNaN(scheduled.getTime())
        ? new Date(nextActionDate).toISOString()
        : scheduled.toISOString();
    }

    if (budget || locationPreference || campaignDuration) {
      payload.qualification = {
        budget,
        locationPreference: locationPreference || undefined,
        campaignDuration: campaignDuration || undefined,
        city: city.trim() || undefined,
      };
    }

    try {
      const lead = await leadsApi.createLead(payload);
      router.push(`/leads/${lead._id || lead.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create lead');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Create New Lead</h1>
        <p className="text-sm text-slate-500">
          Enter lead contact details and optionally log the first follow-up action / next schedule.
        </p>
      </div>

      {error && (
        <Alert tone="error" title="Submission Failed">
          {error}
        </Alert>
      )}

      {autofilledNotice && (
        <div className="flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300 shadow-xs">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{autofilledNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setAutofilledNotice(null)}
            className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 p-0.5 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
            title="Dismiss notice"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Company & Office Location Details */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-4 h-4 text-slate-500" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                1. Company & Office Location
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <LeadsSelect
                label="Source *"
                name="source"
                options={SOURCES}
                placeholder="Select source..."
                error={errors.source}
                defaultValue="Manual"
                value={formState.source}
                onValueChange={(val) => setFormState((p) => ({ ...p, source: val as LeadSource }))}
              />

              {/* Company Name with Autocomplete */}
              <div ref={suggestionsContainerRef} className="relative">
                <Field
                  label="Company Name *"
                  name="companyName"
                  placeholder="e.g. Sigma Trade Wings"
                  value={formState.companyName}
                  onChange={(e) => handleCompanyNameChange(e.target.value)}
                  onFocus={() => {
                    if (companySuggestions.length > 0) setShowSuggestions(true);
                  }}
                  autoComplete="off"
                  error={errors.companyName}
                />
                {isSearchingCompany && (
                  <div className="absolute right-3 top-9 text-slate-400 pointer-events-none">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                )}

                {/* Suggestions Dropdown */}
                {showSuggestions && companySuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-800 dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800/60">
                    <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider bg-slate-50/60 dark:bg-slate-900/60">
                      Existing Clients (Click to Auto-fill)
                    </div>
                    {companySuggestions.map((s) => (
                      <button
                        key={s._id || s.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelectCompany(s);
                        }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors flex flex-col gap-0.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {s.companyName}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {s.source}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-slate-700 dark:text-slate-300">{s.contactPerson}</span>
                          {s.mobile && <span>• {s.mobile}</span>}
                          {s.city && <span>• {s.city}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <Field
                label="Official Email (Optional)"
                name="email"
                type="email"
                placeholder="contact@company.com"
                value={formState.email}
                onChange={(e) => setFormState((p) => ({ ...p, email: e.target.value }))}
                error={errors.email}
              />

              <Field
                label="City (Optional)"
                name="city"
                placeholder="e.g. Mumbai"
                value={formState.city}
                onChange={(e) => setFormState((p) => ({ ...p, city: e.target.value }))}
                error={errors.city}
              />

              <Field
                label="Company Location / Landmark (Optional)"
                name="companyLocation"
                placeholder="e.g. BKC / Andheri East / Industrial Area"
                value={formState.companyLocation}
                onChange={(e) => setFormState((p) => ({ ...p, companyLocation: e.target.value }))}
              />

              <Field
                label="Company Address (Optional)"
                name="companyAddress"
                placeholder="e.g. Suite 402, Trade Tower, Opposite Metro Station"
                value={formState.companyAddress}
                onChange={(e) => setFormState((p) => ({ ...p, companyAddress: e.target.value }))}
              />
            </div>
          </div>

          {/* Section 2: Concern Persons (Contact Details) */}
          <div className="pt-5 border-t border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-500" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  2. Concern Person (Contact Details)
                </h2>
              </div>
              {!showSecondaryContact && (
                <button
                  type="button"
                  onClick={() => setShowSecondaryContact(true)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#8B2424] hover:text-[#6E1D1D] dark:text-red-400 dark:hover:text-red-300 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Secondary Contact</span>
                </button>
              )}
            </div>

            {/* Primary Contact Row */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field
                label="Contact Person Name *"
                name="contactPerson"
                placeholder="e.g. Rajesh Sharma"
                value={formState.contactPerson}
                onChange={(e) => setFormState((p) => ({ ...p, contactPerson: e.target.value }))}
                error={errors.contactPerson}
              />

              <Field
                label="Designation (Optional)"
                name="designation"
                placeholder="e.g. Marketing Director / CMO"
                value={formState.designation}
                onChange={(e) => setFormState((p) => ({ ...p, designation: e.target.value }))}
              />

              <Field
                label="Mobile Number *"
                name="mobile"
                type="tel"
                placeholder="+91 98765 43210"
                value={formState.mobile}
                onChange={(e) => setFormState((p) => ({ ...p, mobile: e.target.value }))}
                error={errors.mobile}
              />
            </div>

            {/* Secondary Contact Row */}
            {showSecondaryContact && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-900/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Secondary Concern Person (Optional)
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowSecondaryContact(false)}
                    className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Field
                    label="Secondary Person Name"
                    name="secondaryContactPerson"
                    placeholder="e.g. Amit Verma"
                    value={formState.secondaryContactPerson}
                    onChange={(e) => setFormState((p) => ({ ...p, secondaryContactPerson: e.target.value }))}
                  />

                  <Field
                    label="Secondary Designation"
                    name="secondaryDesignation"
                    placeholder="e.g. Media Planner / Manager"
                    value={formState.secondaryDesignation}
                    onChange={(e) => setFormState((p) => ({ ...p, secondaryDesignation: e.target.value }))}
                  />

                  <Field
                    label="Secondary Mobile Number"
                    name="secondaryMobile"
                    type="tel"
                    placeholder="+91 91234 56789"
                    value={formState.secondaryMobile}
                    onChange={(e) => setFormState((p) => ({ ...p, secondaryMobile: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Initial Follow-up & ATR Details (Optional) */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                  3. Initial Follow-up & Next Action (Optional — ATR)
                </h2>
                <p className="text-xs text-slate-500">Record what was discussed in the initial inquiry.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowFollowUpSection(!showFollowUpSection)}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition"
              >
                {showFollowUpSection ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    <span>Collapse</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span>Expand</span>
                  </>
                )}
              </button>
            </div>

            {showFollowUpSection && (
              <div className="space-y-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 p-4 border border-slate-200 dark:border-slate-800">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <SelectField
                    label="Type of Follow-up"
                    name="followUpType"
                    defaultValue="Call"
                    options={FOLLOW_UP_TYPES.map((t) => ({ value: t, label: t }))}
                  />

                  <SelectField
                    label="Reason for Follow-up"
                    name="reason"
                    defaultValue="Requirement Gathering"
                    options={FOLLOW_UP_REASONS.map((r) => ({ value: r, label: r }))}
                  />
                </div>

                <TextAreaField
                  label="Initial Conversation Remarks"
                  name="remarks"
                  placeholder="e.g. Client called regarding hoarding availability on Western Express Highway for Diwali campaign..."
                  rows={3}
                />

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field
                    label="Scheduled Next Action Date"
                    name="nextActionDate"
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                  />

                  <Field
                    label="Estimated Budget (₹ Rupees)"
                    name="budget"
                    type="number"
                    min="0"
                    placeholder="e.g. 250000"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <SelectField
                    label="Location Preference"
                    name="locationPreference"
                    placeholder="Select preference..."
                    options={[
                      { label: 'Airport', value: 'Airport' },
                      { label: 'Highway', value: 'Highway' },
                      { label: 'Mall', value: 'Mall' },
                      { label: 'Metro', value: 'Metro' },
                      { label: 'Other', value: 'Other' },
                    ]}
                  />

                  <Field
                    label="Campaign Duration"
                    name="campaignDuration"
                    placeholder="e.g. 30 days"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.back()}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Create Lead
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
