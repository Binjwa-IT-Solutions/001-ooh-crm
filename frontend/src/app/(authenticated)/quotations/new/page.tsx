'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { quotationsApi } from '@/modules/quotations/api';
import { leadsApi } from '@/modules/leads/api';
import { api } from '@/shared/api/client';
import type { Lead } from '@/modules/leads/types';

interface SiteOption {
  _id: string;
  siteCode: string;
  city?: string;
  baseCostPerDay?: number;
  type?: string;
}

interface QuotationLineForm {
  siteId: string;
  description: string;
  ratePerDay: number;
  startDate: string;
  endDate: string;
}

export default function NewQuotationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryLeadId = searchParams.get('leadId');

  const [leads, setLeads] = useState<Lead[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');
  const [clientName, setClientName] = useState<string>('');
  const [clientEmail, setClientEmail] = useState<string>('');
  const [clientPhone, setClientPhone] = useState<string>('');
  const [validUntil, setValidUntil] = useState<string>(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  );

  const [lineItems, setLineItems] = useState<QuotationLineForm[]>([
    {
      siteId: '',
      description: '',
      ratePerDay: 1000,
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    },
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLeadsAndSites();
  }, []);

  async function loadLeadsAndSites() {
    try {
      const [leadsRes, sitesRes] = await Promise.all([
        leadsApi.list({ limit: 100 }),
        api.get<{ data?: SiteOption[]; sites?: SiteOption[] }>('/api/sites?limit=100').catch(() => ({ data: [], sites: [] })),
      ]);

      const loadedLeads: Lead[] = (leadsRes as any).data || leadsRes.leads || [];
      setLeads(loadedLeads);
      if (loadedLeads.length > 0) {
        const targetLead = queryLeadId
          ? loadedLeads.find((l) => (l.id || (l as any)._id) === queryLeadId) || loadedLeads[0]
          : loadedLeads[0];

        const targetId = targetLead._id || targetLead.id;
        setSelectedLeadId(targetId);
        setClientName(targetLead.companyName || '');
        setClientEmail(targetLead.email || '');
        setClientPhone(targetLead.mobile || '');
      }

      const loadedSites: SiteOption[] = (sitesRes as any).data || sitesRes.sites || [];
      setSites(loadedSites);
      if (loadedSites.length > 0) {
        setLineItems((prev) =>
          prev.map((item) => ({ ...item, siteId: item.siteId || loadedSites[0]._id })),
        );
      }
    } catch (err: any) {
      console.error('Failed to load leads and sites for quotation builder', err);
    }
  }

  function handleLeadChange(leadId: string) {
    setSelectedLeadId(leadId);
    const found = leads.find((l) => (l.id || (l as any)._id) === leadId);
    if (found) {
      setClientName(found.companyName || '');
      setClientEmail(found.email || '');
      setClientPhone(found.mobile || '');
    }
  }

  function addLineItem() {
    const defaultSiteId = sites.length > 0 ? sites[0]._id : '';
    const today = new Date().toISOString().slice(0, 10);
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    setLineItems((prev) => [
      ...prev,
      {
        siteId: defaultSiteId,
        description: '',
        ratePerDay: 1000,
        startDate: today,
        endDate: nextWeek,
      },
    ]);
  }

  function removeLineItem(index: number) {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateLineItem(index: number, field: keyof QuotationLineForm, value: any) {
    setLineItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, [field]: value };
        if (field === 'siteId') {
          const selectedSite = sites.find((s) => s._id === value);
          if (selectedSite?.baseCostPerDay) {
            updated.ratePerDay = selectedSite.baseCostPerDay / 100;
          }
        }
        return updated;
      }),
    );
  }

  function calculateInclusiveDays(startStr: string, endStr: string): number {
    const start = new Date(startStr);
    const end = new Date(endStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0;
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1;
  }

  // Preview Totals
  const subtotalRupees = lineItems.reduce((acc, item) => {
    const days = calculateInclusiveDays(item.startDate, item.endDate);
    return acc + days * Number(item.ratePerDay || 0);
  }, 0);

  const gstRupees = subtotalRupees * 0.18;
  const totalRupees = subtotalRupees + gstRupees;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedLeadId) {
      setError('Please select a lead');
      return;
    }
    if (lineItems.length === 0) {
      setError('Please add at least one site');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const created = await quotationsApi.create({
        leadId: selectedLeadId,
        clientName: clientName.trim(),
        clientEmail: clientEmail.trim(),
        clientPhone: clientPhone.trim(),
        validUntil,
        sites: lineItems.map((item) => ({
          siteId: item.siteId,
          description: item.description.trim(),
          ratePerDay: Number(item.ratePerDay),
          startDate: item.startDate,
          endDate: item.endDate,
        })),
      });

      router.push(`/quotations/${created.id || created._id}`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to create quotation');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Create Quotation</h1>
          <p className="text-sm text-slate-500">
            Build a proposal from a qualified lead and selected OOH sites. Rates and dates are calculated server-side.
          </p>
        </div>
        <Link
          href="/quotations"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Back to Quotations
        </Link>
      </div>

      {error && (
        <div className="rounded-md bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Client & Lead Section */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">1. Client & Lead Information</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
              <span className="font-medium">Select Lead *</span>
              <select
                value={selectedLeadId}
                onChange={(e) => handleLeadChange(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                required
              >
                {leads.map((lead) => (
                  <option key={lead.id || (lead as any)._id} value={lead.id || (lead as any)._id}>
                    {lead.companyName} ({lead.contactPerson} - {lead.city || 'No City'})
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
              <span className="font-medium">Client Name</span>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </label>

            <label className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
              <span className="font-medium">Client Email</span>
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </label>

            <label className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
              <span className="font-medium">Proposal Valid Until</span>
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </label>
          </div>
        </div>

        {/* Site Selection & Line Items */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">2. Outdoor Media Sites & Dates</h2>
            <button
              type="button"
              onClick={addLineItem}
              className="rounded bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300"
            >
              + Add Site Line Item
            </button>
          </div>

          <div className="space-y-4">
            {lineItems.map((item, idx) => {
              const days = calculateInclusiveDays(item.startDate, item.endDate);
              const lineAmount = days * Number(item.ratePerDay || 0);

              return (
                <div key={idx} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                  <div className="grid gap-3 sm:grid-cols-6">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-500">Site Location *</label>
                      <select
                        value={item.siteId}
                        onChange={(e) => updateLineItem(idx, 'siteId', e.target.value)}
                        className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                        required
                      >
                        {sites.map((s) => (
                          <option key={s._id} value={s._id}>
                            {s.siteCode} ({s.city || 'City'}) - {s.type || 'Hoarding'}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-500">Start Date *</label>
                      <input
                        type="date"
                        value={item.startDate}
                        onChange={(e) => updateLineItem(idx, 'startDate', e.target.value)}
                        className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-500">End Date *</label>
                      <input
                        type="date"
                        value={item.endDate}
                        onChange={(e) => updateLineItem(idx, 'endDate', e.target.value)}
                        className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-500">Rate / Day (₹)</label>
                      <input
                        type="number"
                        value={item.ratePerDay}
                        onChange={(e) => updateLineItem(idx, 'ratePerDay', e.target.value)}
                        className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                        min={0}
                        required
                      />
                    </div>

                    <div className="flex items-center justify-between sm:justify-end sm:gap-2">
                      <div className="text-right">
                        <span className="block text-[10px] text-slate-400">{days} days (Inclusive)</span>
                        <span className="font-semibold text-slate-900 dark:text-white">₹{lineAmount.toLocaleString('en-IN')}</span>
                      </div>
                      {lineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLineItem(idx)}
                          className="ml-2 text-xs text-rose-600 hover:underline"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Financial Preview Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">3. Server Financial Summary Preview</h2>
          <div className="max-w-md space-y-2 text-sm text-slate-700 dark:text-slate-300">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-medium">₹{subtotalRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span>GST (18%):</span>
              <span className="font-medium text-slate-500">₹{gstRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900 dark:border-slate-800 dark:text-white">
              <span>Total Amount:</span>
              <span className="text-emerald-600 dark:text-emerald-400">₹{totalRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Link
            href="/quotations"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-[#8B2424] px-5 py-2 text-sm font-semibold text-white hover:bg-primary disabled:opacity-50 shadow-sm"
          >
            {loading ? 'Creating Draft Quotation...' : 'Create Draft Quotation'}
          </button>
        </div>
      </form>
    </div>
  );
}
