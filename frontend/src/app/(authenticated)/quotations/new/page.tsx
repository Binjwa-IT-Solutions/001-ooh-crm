'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { quotationsApi } from '@/modules/quotations/api';
import { leadsApi } from '@/modules/leads/api';
import { api } from '@/shared/api/client';
import { DatePicker, Dropdown, SiteSearchSelect, SignatureInput } from '@/shared/ui';
import type { Lead } from '@/modules/leads/types';
import { Search, ChevronDown, Check, X, Plus, Trash2, CreditCard, ArrowLeft } from 'lucide-react';

interface SiteOption {
  _id: string;
  code?: string;
  siteCode?: string;
  name?: string;
  city?: string;
  baseCostPerDay?: number;
  type?: string;
  sizeWidth?: number;
  sizeHeight?: number;
  width?: number;
  height?: number;
  address?: string;
}

function getSiteDimensionsString(s: SiteOption): string {
  const w = s.sizeWidth || s.width;
  const h = s.sizeHeight || s.height;
  const dims = (w && h) ? ` (${w}ft x ${h}ft - ${w * h} sq.ft)` : '';
  const type = s.type ? s.type : 'Hoarding';
  return `${type}${dims}`;
}

interface QuotationLineForm {
  siteId: string;
  description: string;
  ratePerDay: number;
  discountPercent: number;
  taxPercent: number;
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
  const [clientContactPerson, setClientContactPerson] = useState<string>('');
  const [clientEmail, setClientEmail] = useState<string>('');
  const [clientPhone, setClientPhone] = useState<string>('');
  const [clientGstin, setClientGstin] = useState<string>('');
  const [clientAddress, setClientAddress] = useState<string>('');
  const [clientCity, setClientCity] = useState<string>('');
  const [clientState, setClientState] = useState<string>('');
  const [isInterState, setIsInterState] = useState<boolean>(false);
  const [overallDiscount, setOverallDiscount] = useState<number>(0);
  const [overallTaxRate, setOverallTaxRate] = useState<number>(18);
  const [notes, setNotes] = useState<string>('');
  const [validUntil, setValidUntil] = useState<string>(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  );

  // Bank Details State (Matches User Screenshot)
  const [showBankDetails, setShowBankDetails] = useState<boolean>(true);
  const [bankName, setBankName] = useState<string>('HDFC Bank');
  const [accountName, setAccountName] = useState<string>('Media Octus Private Limited');
  const [accountNumber, setAccountNumber] = useState<string>('50200012345678');
  const [ifscCode, setIfscCode] = useState<string>('HDFC0001234');
  const [branch, setBranch] = useState<string>('Vijay Nagar Branch, Indore');

  // E-Signature / Authorized Signatory State
  const [showSignature, setShowSignature] = useState<boolean>(true);
  const [signatureImage, setSignatureImage] = useState<string | undefined>(undefined);
  const [signatoryName, setSignatoryName] = useState<string>('Rishabh Jain');
  const [signatoryDesignation, setSignatoryDesignation] = useState<string>('Authorized Signatory');

  // Terms & Conditions Dynamic List (Default matching company quotation)
  const [termsList, setTermsList] = useState<string[]>([
    'Gst applicable .',
    'for any query please feel free to call or message any time .',
    '100%Payment in Advance.',
    'please visit https://www.mediaoctus.com.',
  ]);

  function handleAddCondition() {
    setTermsList((prev) => [...prev, '']);
  }

  function handleUpdateCondition(index: number, value: string) {
    setTermsList((prev) => prev.map((term, i) => (i === index ? value : term)));
  }

  function handleRemoveCondition(index: number) {
    setTermsList((prev) => prev.filter((_, i) => i !== index));
  }

  // Searchable Lead Combobox state
  const [leadSearchQuery, setLeadSearchQuery] = useState('');
  const [isLeadDropdownOpen, setIsLeadDropdownOpen] = useState(false);
  const leadComboboxRef = useRef<HTMLDivElement>(null);

  const [lineItems, setLineItems] = useState<QuotationLineForm[]>([
    {
      siteId: '',
      description: '',
      ratePerDay: 1000,
      discountPercent: 0,
      taxPercent: 18,
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    },
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLeadsAndSites();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (leadComboboxRef.current && !leadComboboxRef.current.contains(event.target as Node)) {
        setIsLeadDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function loadLeadsAndSites() {
    try {
      const [leadsRes, sitesRes] = await Promise.all([
        leadsApi.list({ limit: 100 }),
        api.get<{ data?: SiteOption[]; sites?: SiteOption[] }>('/api/sites?limit=100').catch(() => ({ data: [], sites: [] })),
      ]);

      const loadedLeads: Lead[] = (leadsRes as any).data || leadsRes.leads || [];
      setLeads(loadedLeads);
      if (loadedLeads.length > 0 && queryLeadId) {
        const targetLead = loadedLeads.find((l) => (l.id || (l as any)._id) === queryLeadId);
        if (targetLead) {
          const targetId = targetLead._id || targetLead.id;
          setSelectedLeadId(targetId);
          setLeadSearchQuery(targetLead.companyName ? `${targetLead.companyName} (${targetLead.contactPerson || 'Lead'})` : '');
          setClientName(targetLead.companyName || '');
          setClientContactPerson(targetLead.contactPerson || '');
          setClientEmail(targetLead.email || '');
          setClientPhone(targetLead.mobile || '');
          setClientCity(targetLead.city || '');
          setClientAddress(targetLead.companyAddress || '');

          if (targetLead.qualification?.startDate && targetLead.qualification?.endDate) {
            const startStr = new Date(targetLead.qualification.startDate).toISOString().slice(0, 10);
            const endStr = new Date(targetLead.qualification.endDate).toISOString().slice(0, 10);
            setLineItems((prev) =>
              prev.map((item) => ({ ...item, startDate: startStr, endDate: endStr }))
            );
          }
        }
      }

      const loadedSites: SiteOption[] = (sitesRes as any).data || sitesRes.sites || [];
      setSites(loadedSites);
      if (loadedSites.length > 0) {
        setLineItems((prev) =>
          prev.map((item) => {
            const currentSite = loadedSites.find((s) => s._id === item.siteId) || loadedSites[0];
            const defaultDesc = getSiteDimensionsString(currentSite);
            const defaultRate = currentSite.baseCostPerDay ? currentSite.baseCostPerDay / 100 : item.ratePerDay;
            return {
              ...item,
              siteId: currentSite._id,
              description: item.description && item.description !== currentSite.type ? item.description : defaultDesc,
              ratePerDay: item.ratePerDay || defaultRate,
            };
          }),
        );
      }
    } catch (err: any) {
      console.error('Failed to load leads and sites for quotation builder', err);
    }
  }

  function handleSelectLead(lead: Lead) {
    const leadId = lead.id || (lead as any)._id;
    setSelectedLeadId(leadId);
    setLeadSearchQuery(lead.companyName ? `${lead.companyName} (${lead.contactPerson || 'Lead'})` : '');
    setIsLeadDropdownOpen(false);

    setClientName(lead.companyName || '');
    setClientContactPerson(lead.contactPerson || '');
    setClientEmail(lead.email || '');
    setClientPhone(lead.mobile || '');
    setClientCity(lead.city || '');
    setClientAddress(lead.companyAddress || '');

    if (lead.qualification?.startDate && lead.qualification?.endDate) {
      const startStr = new Date(lead.qualification.startDate).toISOString().slice(0, 10);
      const endStr = new Date(lead.qualification.endDate).toISOString().slice(0, 10);
      setLineItems((prev) =>
        prev.map((item) => ({ ...item, startDate: startStr, endDate: endStr }))
      );
    }
  }

  function handleClearLead() {
    setSelectedLeadId('');
    setLeadSearchQuery('');
    setClientName('');
    setClientContactPerson('');
    setClientEmail('');
    setClientPhone('');
    setClientGstin('');
    setClientAddress('');
    setClientCity('');
    setClientState('');
    setIsLeadDropdownOpen(true);
  }

  const filteredLeads = leads.filter((l) => {
    if (!leadSearchQuery.trim()) return true;
    const q = leadSearchQuery.toLowerCase().trim();
    const company = (l.companyName || '').toLowerCase();
    const contact = (l.contactPerson || '').toLowerCase();
    const mobile = (l.mobile || '').toLowerCase();
    const city = (l.city || '').toLowerCase();
    const email = (l.email || '').toLowerCase();
    return company.includes(q) || contact.includes(q) || mobile.includes(q) || city.includes(q) || email.includes(q);
  });

  function addLineItem() {
    const defaultSite = sites.length > 0 ? sites[0] : null;
    const defaultSiteId = defaultSite?._id || '';
    const defaultDesc = defaultSite ? getSiteDimensionsString(defaultSite) : '';
    const defaultRate = defaultSite?.baseCostPerDay ? defaultSite.baseCostPerDay / 100 : 1000;
    const today = new Date().toISOString().slice(0, 10);
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    setLineItems((prev) => [
      ...prev,
      {
        siteId: defaultSiteId,
        description: defaultDesc,
        ratePerDay: defaultRate,
        discountPercent: overallDiscount,
        taxPercent: overallTaxRate,
        startDate: today,
        endDate: nextWeek,
      },
    ]);
  }

  function handleApplyOverallDiscount(val: number) {
    const clamped = Math.max(0, Math.min(100, val));
    setOverallDiscount(clamped);
    setLineItems((prev) => prev.map((item) => ({ ...item, discountPercent: clamped })));
  }

  function handleApplyOverallTax(val: number) {
    const clamped = Math.max(0, Math.min(100, val));
    setOverallTaxRate(clamped);
    setLineItems((prev) => prev.map((item) => ({ ...item, taxPercent: clamped })));
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
          if (selectedSite) {
            updated.description = getSiteDimensionsString(selectedSite);
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

  // Preview Totals with row-level discount & tax
  const grossTotalRupees = lineItems.reduce((acc, item) => {
    const days = calculateInclusiveDays(item.startDate, item.endDate);
    return acc + days * Number(item.ratePerDay || 0);
  }, 0);

  const totalDiscountRupees = lineItems.reduce((acc, item) => {
    const days = calculateInclusiveDays(item.startDate, item.endDate);
    const base = days * Number(item.ratePerDay || 0);
    const disc = Number(item.discountPercent || 0);
    return acc + (base * disc) / 100;
  }, 0);

  const subtotalRupees = Math.max(0, grossTotalRupees - totalDiscountRupees);

  const gstRupees = lineItems.reduce((acc, item) => {
    const days = calculateInclusiveDays(item.startDate, item.endDate);
    const base = days * Number(item.ratePerDay || 0);
    const disc = Number(item.discountPercent || 0);
    const net = Math.max(0, base - (base * disc) / 100);
    const tax = Number(item.taxPercent ?? 18);
    return acc + (net * tax) / 100;
  }, 0);

  const totalRupees = subtotalRupees + gstRupees;
  const effectiveTaxPercent = subtotalRupees > 0 ? Math.round((gstRupees / subtotalRupees) * 100) : 18;

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
        clientContactPerson: clientContactPerson.trim(),
        clientEmail: clientEmail.trim(),
        clientPhone: clientPhone.trim(),
        clientGstin: clientGstin.trim(),
        clientAddress: clientAddress.trim(),
        clientCity: clientCity.trim(),
        clientState: clientState.trim(),
        isInterState,
        taxPercent: effectiveTaxPercent,
        taxAmount: Math.round(gstRupees),
        notes: notes.trim(),
        terms: termsList.map((t) => t.trim()).filter(Boolean),
        bankDetails: showBankDetails ? {
          bankName: bankName.trim(),
          accountName: accountName.trim(),
          accountNumber: accountNumber.trim(),
          ifscCode: ifscCode.trim(),
          branch: branch.trim(),
        } : undefined,
        signatureImage: showSignature ? signatureImage : undefined,
        signatoryName: showSignature ? (signatoryName.trim() || undefined) : undefined,
        signatoryDesignation: showSignature ? (signatoryDesignation.trim() || undefined) : undefined,
        validUntil,
        sites: lineItems.map((item) => ({
          siteId: item.siteId,
          description: item.description.trim(),
          ratePerDay: Number(item.ratePerDay),
          discountPercent: Number(item.discountPercent || 0),
          taxPercent: Number(item.taxPercent ?? 18),
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
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#8B2424] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#721c1c] transition"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          <span>Back to Quotations</span>
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
          <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3 dark:border-slate-800">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#6A1B21] text-[11px] font-bold text-white">1</span>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Client & Billing Information</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {/* Row 1 */}
            {/* Interactive Lead Search + Dropdown Combobox */}
            <div className="relative" ref={leadComboboxRef}>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                Search & Select Lead <span className="text-[#8B2424]">*</span>
              </label>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={leadSearchQuery}
                  onChange={(e) => {
                    setLeadSearchQuery(e.target.value);
                    if (!isLeadDropdownOpen) setIsLeadDropdownOpen(true);
                  }}
                  onFocus={() => setIsLeadDropdownOpen(true)}
                  placeholder="Search company, contact, phone, city..."
                  className="w-full h-10 rounded-md border border-slate-300 bg-white pl-9 pr-8 text-sm text-slate-900 outline-none focus:border-[#6A1B21] focus:ring-1 focus:ring-[#6A1B21] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
                {leadSearchQuery ? (
                  <button
                    type="button"
                    onClick={handleClearLead}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    title="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                )}
              </div>

              {/* Filtered Dropdown Popover */}
              {isLeadDropdownOpen && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-800 dark:bg-slate-900">
                  <div className="px-2.5 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                    {filteredLeads.length} Lead{filteredLeads.length === 1 ? '' : 's'} Available
                  </div>

                  {filteredLeads.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">
                      No leads matching &quot;{leadSearchQuery}&quot;
                    </div>
                  ) : (
                    filteredLeads.map((lead) => {
                      const leadId = lead.id || (lead as any)._id;
                      const isSelected = selectedLeadId === leadId;

                      return (
                        <div
                          key={leadId}
                          onClick={() => handleSelectLead(lead)}
                          className={`flex items-start justify-between gap-2 rounded-md p-2.5 text-xs cursor-pointer transition ${
                            isSelected
                              ? 'bg-[#6A1B21]/10 text-[#6A1B21] font-medium'
                              : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          <div className="space-y-0.5">
                            <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>{lead.companyName || 'Unknown Company'}</span>
                              {lead.city && (
                                <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-600 dark:text-slate-300 font-normal">
                                  {lead.city}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {lead.contactPerson || 'No contact'} · {lead.mobile || 'No phone'}
                            </div>
                          </div>

                          {isSelected && <Check className="h-4 w-4 text-[#6A1B21] shrink-0 mt-0.5" />}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                Client / Company Name <span className="text-[#8B2424]">*</span>
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Sigma Trade Wings"
                className="w-full h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#6A1B21] focus:ring-1 focus:ring-[#6A1B21] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                Contact Person
              </label>
              <input
                type="text"
                value={clientContactPerson}
                onChange={(e) => setClientContactPerson(e.target.value)}
                placeholder="e.g. Rajesh Sharma"
                className="w-full h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#6A1B21] focus:ring-1 focus:ring-[#6A1B21] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>

            {/* Row 2 */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                Phone Number
              </label>
              <input
                type="tel"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="e.g. 9876543210"
                className="w-full h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#6A1B21] focus:ring-1 focus:ring-[#6A1B21] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                Client Email
              </label>
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="e.g. client@company.com"
                className="w-full h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#6A1B21] focus:ring-1 focus:ring-[#6A1B21] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                Client GSTIN (Tax ID)
              </label>
              <input
                type="text"
                value={clientGstin}
                onChange={(e) => setClientGstin(e.target.value.toUpperCase())}
                placeholder="e.g. 23AAAAA0000A1Z5"
                className="w-full h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#6A1B21] focus:ring-1 focus:ring-[#6A1B21] dark:border-slate-700 dark:bg-slate-950 dark:text-white uppercase"
              />
            </div>

            {/* Row 3 */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                Billing Address
              </label>
              <input
                type="text"
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                placeholder="e.g. Plot 45, Scheme 54, Vijay Nagar"
                className="w-full h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#6A1B21] focus:ring-1 focus:ring-[#6A1B21] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>

            <div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                    City
                  </label>
                  <input
                    type="text"
                    value={clientCity}
                    onChange={(e) => setClientCity(e.target.value)}
                    placeholder="e.g. Indore"
                    className="w-full h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#6A1B21] focus:ring-1 focus:ring-[#6A1B21] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                    State
                  </label>
                  <input
                    type="text"
                    value={clientState}
                    onChange={(e) => setClientState(e.target.value)}
                    placeholder="e.g. MP"
                    className="w-full h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#6A1B21] focus:ring-1 focus:ring-[#6A1B21] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>
              </div>
            </div>

            <div>
              <DatePicker
                label="Proposal Valid Until"
                value={validUntil}
                onChange={setValidUntil}
                triggerClassName="w-full h-10 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Site Selection & Line Items (Compact Spreadsheet Table) */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#6A1B21] text-[11px] font-bold text-white">2</span>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Outdoor Media Sites & Displays</h2>
                <p className="text-[11px] text-slate-500">Compact spreadsheet view — add media inventory, dates, dimensions, and daily card rates.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={addLineItem}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#6A1B21]/10 border border-[#6A1B21]/20 px-3 py-1.5 text-xs font-semibold text-[#6A1B21] hover:bg-[#6A1B21]/20 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Site Item</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="min-w-[1140px] w-full border-collapse text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase tracking-wider text-[10px] text-slate-600 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300">
                <tr>
                  <th className="w-10 py-3 px-2 text-center">#</th>
                  <th className="w-[260px] min-w-[210px] py-3 px-3">Media Site Inventory *</th>
                  <th className="w-[220px] min-w-[180px] py-3 px-3">Display Dimensions / Remarks</th>
                  <th className="w-[280px] min-w-[260px] py-3 px-3">Campaign Dates (Start - End) *</th>
                  <th className="w-14 py-3 px-2 text-center">Days</th>
                  <th className="w-[110px] min-w-[95px] py-3 px-2">Rate/Day (₹) *</th>
                  <th className="w-[95px] min-w-[85px] py-3 px-2">Discount</th>
                  <th className="w-[95px] min-w-[85px] py-3 px-2">Tax</th>
                  <th className="w-[130px] min-w-[110px] py-3 px-3 text-right">Amount (₹)</th>
                  <th className="w-10 py-3 px-2 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {lineItems.map((item, idx) => {
                  const days = calculateInclusiveDays(item.startDate, item.endDate);
                  const baseAmount = days * Number(item.ratePerDay || 0);
                  const discountPercent = Number(item.discountPercent || 0);
                  const discountAmount = (baseAmount * discountPercent) / 100;
                  const lineAmount = Math.max(0, baseAmount - discountAmount);

                  return (
                    <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      {/* Index # */}
                      <td className="py-3 px-2 text-center align-middle">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-400">
                          {idx + 1}
                        </span>
                      </td>

                      {/* Media Site Inventory Smart Search Dropdown */}
                      <td className="py-3 px-3 align-middle">
                        <SiteSearchSelect
                          value={item.siteId}
                          sites={sites}
                          onChange={(val) => updateLineItem(idx, 'siteId', val)}
                          placeholder="Search & select site..."
                          triggerClassName="h-10 text-xs shadow-2xs"
                        />
                      </td>

                      {/* Display Dimensions / Remarks */}
                      <td className="py-3 px-3 align-middle">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateLineItem(idx, 'description', e.target.value)}
                          placeholder="e.g. 30ft x 15ft (450 sq.ft)"
                          className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-[#6A1B21] focus:ring-1 focus:ring-[#6A1B21] dark:border-slate-700 dark:bg-slate-950 dark:text-white shadow-2xs"
                        />
                      </td>

                      {/* Campaign Dates */}
                      <td className="py-3 px-3 align-middle">
                        <div className="grid grid-cols-2 gap-2">
                          <DatePicker
                            value={item.startDate}
                            onChange={(val) => updateLineItem(idx, 'startDate', val)}
                            triggerClassName="w-full h-10 pl-2.5 pr-2 py-2 text-xs rounded-lg shadow-2xs whitespace-nowrap"
                            placeholder="Start Date"
                          />
                          <DatePicker
                            value={item.endDate}
                            onChange={(val) => updateLineItem(idx, 'endDate', val)}
                            triggerClassName="w-full h-10 pl-2.5 pr-2 py-2 text-xs rounded-lg shadow-2xs whitespace-nowrap"
                            placeholder="End Date"
                          />
                        </div>
                      </td>

                      {/* Days badge */}
                      <td className="py-3 px-2 text-center align-middle">
                        <span className="inline-block rounded-md bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {days}d
                        </span>
                      </td>

                      {/* Daily Rate (₹) */}
                      <td className="py-3 px-2 align-middle">
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">₹</span>
                          <input
                            type="number"
                            min={0}
                            value={item.ratePerDay}
                            onChange={(e) => updateLineItem(idx, 'ratePerDay', e.target.value)}
                            className="w-full h-10 rounded-lg border border-slate-300 bg-white pl-6 pr-2.5 py-2 text-xs font-semibold text-slate-900 outline-none focus:border-[#6A1B21] focus:ring-1 focus:ring-[#6A1B21] dark:border-slate-700 dark:bg-slate-950 dark:text-white shadow-2xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            required
                          />
                        </div>
                      </td>

                      {/* Discount (%) */}
                      <td className="py-3 px-2 align-middle">
                        <div className="relative">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            placeholder="0"
                            value={item.discountPercent === 0 ? '' : item.discountPercent}
                            onChange={(e) => {
                              const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                              updateLineItem(idx, 'discountPercent', val);
                            }}
                            className="w-full h-10 rounded-lg border border-slate-300 bg-white pl-2.5 pr-6 py-2 text-xs font-semibold text-slate-900 outline-none focus:border-[#6A1B21] focus:ring-1 focus:ring-[#6A1B21] dark:border-slate-700 dark:bg-slate-950 dark:text-white shadow-2xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">%</span>
                        </div>
                      </td>

                      {/* Tax (%) */}
                      <td className="py-3 px-2 align-middle">
                        <div className="relative">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.5}
                            placeholder="18"
                            value={item.taxPercent ?? 18}
                            onChange={(e) => {
                              const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                              updateLineItem(idx, 'taxPercent', val);
                            }}
                            className="w-full h-10 rounded-lg border border-slate-300 bg-white pl-2.5 pr-6 py-2 text-xs font-semibold text-slate-900 outline-none focus:border-[#6A1B21] focus:ring-1 focus:ring-[#6A1B21] dark:border-slate-700 dark:bg-slate-950 dark:text-white shadow-2xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">%</span>
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-3 text-right align-middle">
                        <div className="text-sm font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          ₹{Math.round(lineAmount).toLocaleString('en-IN')}
                        </div>
                        {discountPercent > 0 && (
                          <div className="text-[10px] text-emerald-600 font-medium whitespace-nowrap">
                            -₹{Math.round(discountAmount).toLocaleString('en-IN')} ({discountPercent}%)
                          </div>
                        )}
                      </td>

                      {/* Remove action */}
                      <td className="py-3 px-2 text-center align-middle">
                        {lineItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLineItem(idx)}
                            className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950 transition"
                            title="Remove site item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Dashed Add Item Row */}
            <div className="p-2.5 bg-slate-50/50 dark:bg-slate-800/20 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={addLineItem}
                className="w-full py-2.5 border-2 border-dashed border-[#6A1B21]/30 hover:border-[#6A1B21] hover:bg-[#6A1B21]/5 text-[#6A1B21] rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Another Media Site Item</span>
              </button>
            </div>
          </div>
        </div>

        {/* Section 3: GST Tax Application & Bank Details */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Left: GST Mode & Optional Remarks */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#6A1B21] text-[11px] font-bold text-white">3</span>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">GST Tax & Overall Settings</h2>
                <p className="text-[11px] text-slate-400">Set overall discount and tax to auto-fill all sites (can still be tweaked per row).</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Supply Location / GST Type
              </label>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setIsInterState(false)}
                  className={`flex flex-col items-start p-3 rounded-lg border text-left transition ${
                    !isInterState
                      ? 'border-[#6A1B21] bg-[#6A1B21]/5 text-[#6A1B21] font-semibold ring-1 ring-[#6A1B21]'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600 dark:border-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span className="text-xs font-bold">Intra-State Supply</span>
                  <span className="text-[11px] font-normal text-slate-500 mt-0.5">CGST + SGST (50:50 Split)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsInterState(true)}
                  className={`flex flex-col items-start p-3 rounded-lg border text-left transition ${
                    isInterState
                      ? 'border-[#6A1B21] bg-[#6A1B21]/5 text-[#6A1B21] font-semibold ring-1 ring-[#6A1B21]'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600 dark:border-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span className="text-xs font-bold">Inter-State Supply</span>
                  <span className="text-[11px] font-normal text-slate-500 mt-0.5">IGST (Full Tax)</span>
                </button>
              </div>
            </div>

            {/* Overall Campaign Discount & Tax (Auto-fills All Sites) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Overall Discount (%)
                  </label>
                  <span className="text-[10px] text-[#6A1B21] font-medium bg-[#6A1B21]/10 px-1.5 py-0.5 rounded">
                    Auto-fills all
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={overallDiscount === 0 ? '' : overallDiscount}
                    onChange={(e) => handleApplyOverallDiscount(Number(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full h-9 rounded-lg border border-slate-300 bg-white pl-3 pr-7 py-1.5 text-xs font-semibold text-slate-900 outline-none focus:border-[#6A1B21] focus:ring-1 focus:ring-[#6A1B21] dark:border-slate-700 dark:bg-slate-950 dark:text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none shadow-2xs"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">%</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Overall Tax Rate (%)
                  </label>
                  <span className="text-[10px] text-[#6A1B21] font-medium bg-[#6A1B21]/10 px-1.5 py-0.5 rounded">
                    Auto-fills all
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="relative w-20">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={overallTaxRate}
                      onChange={(e) => handleApplyOverallTax(Number(e.target.value) || 0)}
                      className="w-full h-9 rounded-lg border border-slate-300 bg-white pl-3 pr-6 py-1.5 text-xs font-semibold text-slate-900 outline-none focus:border-[#6A1B21] focus:ring-1 focus:ring-[#6A1B21] dark:border-slate-700 dark:bg-slate-950 dark:text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none shadow-2xs"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {[18, 12, 5, 0].map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => handleApplyOverallTax(rate)}
                        className={`h-9 px-2 rounded-lg text-xs font-bold transition ${
                          overallTaxRate === rate
                            ? 'bg-[#6A1B21] text-white'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                        title={`Apply ${rate}% to all sites`}
                      >
                        {rate}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Quotation Remarks / Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional internal remark or special note for this quotation..."
                className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900 outline-none focus:border-[#6A1B21] focus:ring-1 focus:ring-[#6A1B21] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
          </div>

          {/* Right: Bank Details Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-white">
                <CreditCard className="w-4 h-4 text-[#6A1B21]" />
                <span>BANK DETAILS</span>
              </div>
              {showBankDetails ? (
                <button
                  type="button"
                  onClick={() => setShowBankDetails(false)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Bank Details</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowBankDetails(true)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#6A1B21] hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Bank Details</span>
                </button>
              )}
            </div>

            {showBankDetails ? (
              <div className="space-y-3.5 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Bank Name
                    </label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="e.g. HDFC Bank, SBI, ICICI"
                      className="w-full h-9 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-[#6A1B21] focus:ring-1 focus:ring-[#6A1B21] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Person / Account Name
                    </label>
                    <input
                      type="text"
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      placeholder="e.g. Account Holder / Beneficiary Name"
                      className="w-full h-9 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-[#6A1B21] focus:ring-1 focus:ring-[#6A1B21] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Account Number
                    </label>
                    <input
                      type="text"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      placeholder="e.g. 50200012345678"
                      className="w-full h-9 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-[#6A1B21] focus:ring-1 focus:ring-[#6A1B21] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      IFSC Code
                    </label>
                    <input
                      type="text"
                      value={ifscCode}
                      onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                      placeholder="e.g. HDFC0001234"
                      className="w-full h-9 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-[#6A1B21] focus:ring-1 focus:ring-[#6A1B21] dark:border-slate-700 dark:bg-slate-950 dark:text-white uppercase"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Branch
                  </label>
                  <input
                    type="text"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="e.g. Vijay Nagar Branch, Indore"
                    className="w-full h-9 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-[#6A1B21] focus:ring-1 focus:ring-[#6A1B21] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                Bank details hidden from this quotation. Click &quot;+ Add Bank Details&quot; to include them.
              </div>
            )}
          </div>
        </div>

        {/* Section 4: Terms & Conditions and Commercial Breakdown */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Left: Terms & Conditions */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800 mb-4">
                <div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider text-[#6A1B21]">
                  <span>+</span>
                  <span>Terms & Conditions</span>
                </div>
                <button
                  type="button"
                  onClick={handleAddCondition}
                  className="text-xs font-semibold text-[#6A1B21] hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Condition</span>
                </button>
              </div>

              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {termsList.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No terms added. Click &quot;+ Add Condition&quot; to specify proposal terms.
                  </div>
                ) : (
                  termsList.map((term, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="w-5 text-right text-xs font-semibold text-slate-400 select-none">
                        {index + 1}.
                      </span>
                      <input
                        type="text"
                        value={term}
                        onChange={(e) => handleUpdateCondition(index, e.target.value)}
                        placeholder="Enter condition..."
                        className="flex-1 h-9 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-[#6A1B21] focus:ring-1 focus:ring-[#6A1B21] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveCondition(index)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition"
                        title="Remove condition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-3 text-[11px] text-slate-400 border-t border-slate-100 dark:border-slate-800 mt-4">
              These terms will be numbered and printed directly on the client PDF proposal.
            </div>
          </div>

          {/* Right: Commercial Breakdown Card (Directly above Create Draft Quotation) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800 mb-3">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Commercial Breakdown</h2>
                <span className="text-[11px] px-2 py-0.5 rounded font-semibold bg-[#6A1B21]/10 text-[#6A1B21]">
                  {lineItems.length} Site{lineItems.length > 1 ? 's' : ''}
                </span>
              </div>

              <div className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-500">Gross Inventory Total:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    ₹{grossTotalRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {totalDiscountRupees > 0 && (
                  <div className="flex justify-between py-0.5 text-emerald-600 font-semibold">
                    <span>Total Discount Applied:</span>
                    <span>- ₹{totalDiscountRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}

                <div className="flex justify-between py-0.5 border-t border-slate-100 dark:border-slate-800 pt-2 font-medium">
                  <span className="text-slate-600 dark:text-slate-400">Taxable Subtotal:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    ₹{subtotalRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {!isInterState ? (
                  <>
                    <div className="flex justify-between py-0.5 text-slate-500">
                      <span>CGST:</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        ₹{(gstRupees / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between py-0.5 text-slate-500">
                      <span>SGST:</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        ₹{(gstRupees / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between py-0.5 text-slate-500">
                    <span>IGST:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      ₹{gstRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                {/* Grand Total */}
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-3.5 mt-3">
                  <div className="flex justify-between items-center text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                    <span>Grand Total (All Taxes Included):</span>
                    <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                      ₹{Math.round(totalRupees).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 text-[11px] text-slate-400 border-t border-slate-100 dark:border-slate-800 mt-4">
              * Rates, line discounts, and GST slabs calculated dynamically per site.
            </div>
          </div>
        </div>

        {/* Section 5: Authorized Signatory / Company Stamp (Compact Row) */}
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#6A1B21] text-[11px] font-bold text-white shrink-0">5</span>
            <div>
              <h2 className="text-xs font-bold text-slate-900 dark:text-white">Authorized Signatory / Company Stamp</h2>
              <p className="text-[11px] text-slate-500">Attach digital signature or official company stamp to print on proposal PDF.</p>
            </div>
          </div>

          <SignatureInput
            signatureImage={signatureImage}
            onChange={(data) => {
              setSignatureImage(data.signatureImage);
            }}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Link
            href="/quotations"
            className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-[#6A1B21] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#521419] disabled:opacity-50 shadow-sm transition"
          >
            {loading ? 'Creating Draft Quotation...' : 'Create Draft Quotation'}
          </button>
        </div>
      </form>
    </div>
  );
}
