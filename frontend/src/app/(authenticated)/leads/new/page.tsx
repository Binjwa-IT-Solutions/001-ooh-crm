'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Field, Button, Alert, TextAreaField, SelectField } from '@/shared/ui';
import { LeadsSelect } from '@/modules/leads/components/leads-select';
import { leadsApi } from '@/modules/leads/api';
import { ChevronDown, ChevronUp } from 'lucide-react';
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

  // Field-level validations
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setErrors({});

    const formData = new FormData(e.currentTarget);
    const companyName = (formData.get('companyName') as string) || '';
    const contactPerson = (formData.get('contactPerson') as string) || '';
    const mobile = (formData.get('mobile') as string) || '';
    const email = (formData.get('email') as string) || '';
    const city = (formData.get('city') as string) || '';
    const source = (formData.get('source') as LeadSource) || 'Manual';

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
    if (!contactPerson.trim()) newErrors.contactPerson = 'Contact person is required';
    if (!mobile.trim()) newErrors.mobile = 'Mobile is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setIsSubmitting(false);
      return;
    }

    const payload: any = {
      source,
      companyName: companyName.trim(),
      contactPerson: contactPerson.trim(),
      mobile: mobile.trim(),
      email: email.trim() || undefined,
      city: city.trim() || undefined,
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
          {/* Section 1: Basic Lead Details */}
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4">
              1. Basic Lead Information
            </h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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
                label="Contact Person *"
                name="contactPerson"
                placeholder="e.g. Rajesh Sharma"
                error={errors.contactPerson}
              />

              <Field
                label="Mobile Number *"
                name="mobile"
                type="tel"
                placeholder="+91 98765 43210"
                error={errors.mobile}
              />

              <Field
                label="Email Address (Optional)"
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
            </div>
          </div>

          {/* Section 2: Initial Follow-up & ATR Details (Optional) */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                  2. Initial Follow-up & Next Action (Optional — ATR)
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
