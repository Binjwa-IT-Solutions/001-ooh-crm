'use client';

import { useState, useEffect } from 'react';
import { leadsApi } from '@/modules/leads/api';
import { Lead, LeadSource } from '@/modules/leads/types';
import { Button, Field, Alert, SelectField } from '@/shared/ui';
import { Building2, User, Users, ChevronDown, ChevronUp, X } from 'lucide-react';

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

interface EditLeadModalProps {
  isOpen: boolean;
  lead: Lead | null;
  onClose: () => void;
  onSuccess?: (updatedLead: Lead) => void;
}

export default function EditLeadModal({ isOpen, lead, onClose, onSuccess }: EditLeadModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showSecondaryContact, setShowSecondaryContact] = useState(false);

  // Form State
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyLocation, setCompanyLocation] = useState('');
  const [city, setCity] = useState('');
  const [email, setEmail] = useState('');
  const [source, setSource] = useState<LeadSource>('Manual');

  // Primary Contact
  const [contactPerson, setContactPerson] = useState('');
  const [designation, setDesignation] = useState('');
  const [mobile, setMobile] = useState('');

  // Secondary Contact
  const [secondaryContactPerson, setSecondaryContactPerson] = useState('');
  const [secondaryDesignation, setSecondaryDesignation] = useState('');
  const [secondaryMobile, setSecondaryMobile] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (lead) {
      setCompanyName(lead.companyName || '');
      setCompanyAddress(lead.companyAddress || '');
      setCompanyLocation(lead.companyLocation || '');
      setCity(lead.city || '');
      setEmail(lead.email || '');
      setSource(lead.source || 'Manual');

      setContactPerson(lead.contactPerson || '');
      setDesignation(lead.designation || '');
      setMobile(lead.mobile || '');

      setSecondaryContactPerson(lead.secondaryContactPerson || '');
      setSecondaryDesignation(lead.secondaryDesignation || '');
      setSecondaryMobile(lead.secondaryMobile || '');

      if (lead.secondaryContactPerson || lead.secondaryMobile) {
        setShowSecondaryContact(true);
      } else {
        setShowSecondaryContact(false);
      }

      setError('');
      setErrors({});
    }
  }, [lead, isOpen]);

  if (!isOpen || !lead) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const newErrors: Record<string, string> = {};

    if (!companyName.trim()) newErrors.companyName = 'Company name is required';
    if (!contactPerson.trim()) newErrors.contactPerson = 'Primary contact person is required';
    if (!mobile.trim()) newErrors.mobile = 'Primary mobile number is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);

    const payload: any = {
      companyName: companyName.trim(),
      companyAddress: companyAddress.trim() || undefined,
      companyLocation: companyLocation.trim() || undefined,
      city: city.trim() || undefined,
      email: email.trim() || undefined,
      source,

      contactPerson: contactPerson.trim(),
      designation: designation.trim() || undefined,
      mobile: mobile.trim(),

      secondaryContactPerson: secondaryContactPerson.trim() || undefined,
      secondaryDesignation: secondaryDesignation.trim() || undefined,
      secondaryMobile: secondaryMobile.trim() || undefined,
    };

    try {
      const updated = await leadsApi.updateLead(lead._id || lead.id, payload);
      onSuccess?.(updated as any);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update lead');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Edit Lead Details</h3>
            <p className="text-xs text-slate-500">Update company profile, contact details, and location.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4">
            <Alert tone="error" title="Error">
              {error}
            </Alert>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-5">
          {/* Company Details */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              <Building2 className="w-3.5 h-3.5 text-primary" />
              <span>Company Information</span>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field
                label="Company Name *"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                error={errors.companyName}
                placeholder="e.g. Acme Corp"
              />

              <SelectField
                label="Lead Source *"
                value={source}
                onChange={(e) => setSource(e.target.value as LeadSource)}
                options={SOURCES.map((s) => ({ value: s.value, label: s.label }))}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field
                label="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Indore, Mumbai"
              />

              <Field
                label="Company Location / Area"
                value={companyLocation}
                onChange={(e) => setCompanyLocation(e.target.value)}
                placeholder="e.g. Vijay Nagar, Palasia"
              />
            </div>

            <Field
              label="Company Address"
              value={companyAddress}
              onChange={(e) => setCompanyAddress(e.target.value)}
              placeholder="e.g. 101 Corporate Park, AB Road"
            />
          </div>

          {/* Primary Contact Person */}
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:divide-slate-800">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              <User className="w-3.5 h-3.5 text-primary" />
              <span>Primary Contact Person</span>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Field
                label="Contact Person Name *"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                error={errors.contactPerson}
                placeholder="e.g. Rajesh Sharma"
              />

              <Field
                label="Designation"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="e.g. Marketing Head"
              />

              <Field
                label="Mobile Number *"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                error={errors.mobile}
                placeholder="e.g. 9876543210"
              />
            </div>

            <Field
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. rajesh@acme.com"
            />
          </div>

          {/* Secondary Contact Person Toggle */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowSecondaryContact(!showSecondaryContact)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary dark:text-red-400 hover:underline cursor-pointer"
              >
                <Users className="w-3.5 h-3.5" />
                <span>{showSecondaryContact ? 'Hide Secondary Contact' : '+ Add / View Secondary Contact Person'}</span>
                {showSecondaryContact ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {showSecondaryContact && (
              <div className="mt-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 grid grid-cols-1 gap-3 md:grid-cols-3">
                <Field
                  label="Secondary Person Name"
                  value={secondaryContactPerson}
                  onChange={(e) => setSecondaryContactPerson(e.target.value)}
                  placeholder="e.g. Amit Verma"
                />

                <Field
                  label="Secondary Designation"
                  value={secondaryDesignation}
                  onChange={(e) => setSecondaryDesignation(e.target.value)}
                  placeholder="e.g. Media Manager"
                />

                <Field
                  label="Secondary Mobile"
                  value={secondaryMobile}
                  onChange={(e) => setSecondaryMobile(e.target.value)}
                  placeholder="e.g. 9876543211"
                />
              </div>
            )}
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
