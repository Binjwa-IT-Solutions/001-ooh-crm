'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Field, Button, Alert, TextAreaField, SelectField } from '@/shared/ui';
import { LeadsSelect } from '@/modules/leads/components/leads-select';
import { leadsApi } from '@/modules/leads/api';
import { ChevronDown, ChevronUp, User, Users, Building2, MapPin, Phone, Briefcase, Plus, X } from 'lucide-react';
import {
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

  // Field-level validations
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setErrors({});

    const formData = new FormData(e.currentTarget);
    const companyName = (formData.get('companyName') as string) || '';
    const companyAddress = (formData.get('companyAddress') as string) || '';
    const companyLocation = (formData.get('companyLocation') as string) || '';
    const city = (formData.get('city') as string) || '';
    const email = (formData.get('email') as string) || '';
    const source = (formData.get('source') as LeadSource) || 'Manual';

    // Primary Concern Person (Mandatory)
    const contactPerson = (formData.get('contactPerson') as string) || '';
    const designation = (formData.get('designation') as string) || '';
    const mobile = (formData.get('mobile') as string) || '';

    // Secondary Concern Person (Optional)
    const secondaryContactPerson = (formData.get('secondaryContactPerson') as string) || '';
    const secondaryDesignation = (formData.get('secondaryDesignation') as string) || '';
    const secondaryMobile = (formData.get('secondaryMobile') as string) || '';

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
      payload.nextActionDate = new Date(nextActionDate).toISOString();
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
              />

              <Field
                label="Company Name *"
                name="companyName"
                placeholder="e.g. Sigma Trade Wings"
                error={errors.companyName}
              />

              <Field
                label="Official Email (Optional)"
                name="email"
                type="email"
                placeholder="contact@company.com"
                error={errors.email}
              />

              <Field
                label="City (Optional)"
                name="city"
                placeholder="e.g. Mumbai"
                error={errors.city}
              />

              <Field
                label="Company Location / Landmark (Optional)"
                name="companyLocation"
                placeholder="e.g. BKC / Andheri East / Industrial Area"
              />

              <Field
                label="Company Address (Optional)"
                name="companyAddress"
                placeholder="e.g. Suite 402, Trade Tower, Opposite Metro Station"
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
                  <span>+ Add Secondary Contact</span>
                </button>
              )}
            </div>

            {/* Primary Contact Row */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field
                label="Contact Person Name *"
                name="contactPerson"
                placeholder="e.g. Rajesh Sharma"
                error={errors.contactPerson}
              />

              <Field
                label="Designation (Optional)"
                name="designation"
                placeholder="e.g. Marketing Director / CMO"
              />

              <Field
                label="Mobile Number *"
                name="mobile"
                type="tel"
                placeholder="+91 98765 43210"
                error={errors.mobile}
              />
            </div>

            {/* Secondary Contact Row (Smooth toggle) */}
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
                  />

                  <Field
                    label="Secondary Designation"
                    name="secondaryDesignation"
                    placeholder="e.g. Media Planner / Manager"
                  />

                  <Field
                    label="Secondary Mobile Number"
                    name="secondaryMobile"
                    type="tel"
                    placeholder="+91 91234 56789"
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
                    type="datetime-local"
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
