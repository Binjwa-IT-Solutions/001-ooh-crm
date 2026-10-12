'use client';

import { useEffect, useRef, useState } from 'react';
import {
  TrendingUp,
  Building2,
  CalendarDays,
  Clock,
  MapPin,
  Layers,
  ShieldCheck,
  FileText,
} from 'lucide-react';

import type {
  CampaignOption,
  PurchaseOrder,
  PurchaseOrderFormData,
  PurchaseOrderLineItem,
  VendorOption,
} from '../types';

import { getCampaignOptionsForPO, getVendorOptionsForPO } from '../api';
import { getVendors } from '@/modules/vendors/api';
import { DatePicker } from '@/shared/ui';

interface Props {
  order: PurchaseOrder | null;
  saving: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onSubmit: (data: PurchaseOrderFormData) => Promise<boolean>;
}

const SPACE_TYPES = [
  'Billboard',
  'Hoarding',
  'Transit',
  'Unipole',
  'Gantry',
  'Bus Shelter',
  'Metro',
  'Mall',
  'Airport',
  'Digital',
  'Other',
];

export default function PurchaseOrderForm({ order, saving, onClose, onSuccess, onSubmit }: Props) {
  const [vendorId, setVendorId] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [city, setCity] = useState('');
  const [spaceType, setSpaceType] = useState('Billboard');

  // Rates
  const [cardRate, setCardRate] = useState<number>(0);
  const [negotiatedRate, setNegotiatedRate] = useState<number>(0);
  const [lineItems, setLineItems] = useState<PurchaseOrderLineItem[]>([]);

  // Company prices
  const [companyCostPrice, setCompanyCostPrice] = useState<number>(0);
  const [companySellingPrice, setCompanySellingPrice] = useState<number>(0);

  // Duration & Validity
  const [durationDays, setDurationDays] = useState<number>(30);
  const [validityFrom, setValidityFrom] = useState('');
  const [validityTo, setValidityTo] = useState('');

  // Negotiation & Approval
  const [negotiationRounds, setNegotiationRounds] = useState<number>(1);
  const [negotiationNotes, setNegotiationNotes] = useState('');
  const [approvedBy, setApprovedBy] = useState('');
  const [pricingId, setPricingId] = useState('');

  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [error, setError] = useState('');

  // Load options
  useEffect(() => {
    let mounted = true;

    async function loadOptions() {
      try {
        setLoadingCampaigns(true);
        setLoadingVendors(true);

        const [campaignRes, vendorRes] = await Promise.allSettled([
          getCampaignOptionsForPO(),
          getVendorOptionsForPO().catch(() => getVendors({ status: 'Active' })),
        ]);

        if (!mounted) return;

        if (campaignRes.status === 'fulfilled' && campaignRes.value?.data) {
          setCampaigns(Array.isArray(campaignRes.value.data) ? campaignRes.value.data : []);
        }

        if (vendorRes.status === 'fulfilled' && vendorRes.value?.data) {
          const rawVendors = Array.isArray(vendorRes.value.data) ? vendorRes.value.data : [];
          const activeVendors: VendorOption[] = rawVendors
            .filter((vendor: any) => !vendor.status || vendor.status === 'Active')
            .map((vendor: any) => ({
              _id: String(vendor._id),
              name: vendor.name || 'Unnamed Vendor',
              state: vendor.state,
              city:
                vendor.city || (Array.isArray(vendor.citiesServed) ? vendor.citiesServed[0] : ''),
              status: vendor.status || 'Active',
              contactPerson: vendor.contactPerson,
              mobile: vendor.mobile,
            }));

          setVendors(activeVendors);
        }
      } catch (err) {
        console.error('Failed to load options for PO:', err);
      } finally {
        if (mounted) {
          setLoadingCampaigns(false);
          setLoadingVendors(false);
        }
      }
    }

    loadOptions();

    return () => {
      mounted = false;
    };
  }, []);

  // Populate when editing
  useEffect(() => {
    if (!order) {
      setVendorId('');
      setCampaignId('');
      setCity('');
      setSpaceType('Billboard');
      setCardRate(0);
      setNegotiatedRate(0);
      setLineItems([]);
      setCompanyCostPrice(0);
      setCompanySellingPrice(0);
      setDurationDays(30);
      setValidityFrom('');
      setValidityTo('');
      setNegotiationRounds(1);
      setNegotiationNotes('');
      setApprovedBy('');
      setPricingId('');
      setError('');
      return;
    }

    const resolvedVendorId = !order.vendorId
      ? ''
      : typeof order.vendorId === 'string'
        ? order.vendorId
        : String((order.vendorId as any)._id || '');

    const resolvedCampaignId = !order.campaignId
      ? ''
      : typeof order.campaignId === 'string'
        ? order.campaignId
        : String((order.campaignId as any)._id || '');

    setVendorId(resolvedVendorId);
    setCampaignId(resolvedCampaignId);
    setCity(order.city || '');
    setSpaceType(order.spaceType || 'Billboard');

    setCardRate(Number(order.cardRate) || 0);
    setNegotiatedRate(Number(order.negotiatedRate) || Number(order.totalAmount) || 0);
    setLineItems(order.lineItems || []);
    setCompanyCostPrice(Number(order.companyCostPrice) || Number(order.negotiatedRate) || 0);
    setCompanySellingPrice(Number(order.companySellingPrice) || 0);

    setDurationDays(Number(order.durationDays) || 30);
    setValidityFrom(order.validityFrom ? String(order.validityFrom).slice(0, 10) : '');
    setValidityTo(order.validityTo ? String(order.validityTo).slice(0, 10) : '');

    setNegotiationRounds(Number(order.negotiationRounds) || 1);
    setNegotiationNotes(order.negotiationNotes || '');
    setApprovedBy(order.approvedBy || '');
    setPricingId(order.pricingId || order.poNumber || '');
    setError('');
  }, [order]);

  // When vendor changes, auto-fill city if empty
  const handleVendorSelect = (id: string) => {
    setVendorId(id);
    const selected = vendors.find((v) => v._id === id);
    if (selected && selected.city && !city) {
      setCity(selected.city);
    }
  };

  // When dates change, auto-calculate duration in days
  const handleValidityChange = (fromStr: string, toStr: string) => {
    setValidityFrom(fromStr);
    setValidityTo(toStr);
    if (fromStr && toStr) {
      const fromD = new Date(fromStr);
      const toD = new Date(toStr);
      if (!Number.isNaN(fromD.getTime()) && !Number.isNaN(toD.getTime()) && toD >= fromD) {
        const days = Math.floor((toD.getTime() - fromD.getTime()) / 86400000) + 1;
        setDurationDays(days);
      }
    }
  };

  function updateItem(
    index: number,
    key: 'siteId' | 'from' | 'to' | 'negotiatedRatePerDay',
    value: string | number,
  ) {
    setLineItems((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) return item;

        const updated = { ...item };
        if (key === 'negotiatedRatePerDay') {
          updated.negotiatedRatePerDay = Number(value) || 0;
        } else {
          updated[key] = String(value);
        }

        let days = 0;
        if (updated.from && updated.to) {
          const from = new Date(updated.from);
          const to = new Date(updated.to);
          if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && to >= from) {
            days = Math.floor((to.getTime() - from.getTime()) / 86400000) + 1;
          }
        }

        updated.days = days;
        updated.amount = (Number(updated.negotiatedRatePerDay) || 0) * days;
        return updated;
      }),
    );
  }

  function removeItem(index: number) {
    setLineItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  // When negotiated rate changes, auto-suggest company cost price
  const handleNegotiatedRateChange = (rate: number) => {
    setNegotiatedRate(rate);
    if (companyCostPrice === 0 || companyCostPrice === negotiatedRate) {
      setCompanyCostPrice(rate);
    }
  };

  // Calculations
  const discountGiven = Math.max(0, cardRate - negotiatedRate);
  const discountPercent = cardRate > 0 ? Number(((discountGiven / cardRate) * 100).toFixed(2)) : 0;

  const profitPerUnit = companySellingPrice - companyCostPrice;
  const profitMarginPercent =
    companyCostPrice > 0 ? Number(((profitPerUnit / companyCostPrice) * 100).toFixed(2)) : 0;

  // Submit form
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!vendorId.trim()) {
      setError('Vendor is required');
      return;
    }

    if (!city.trim()) {
      setError('City is required');
      return;
    }

    if (cardRate < 0 || negotiatedRate < 0) {
      setError('Rates cannot be negative');
      return;
    }

    const payload: PurchaseOrderFormData = {
      pricingId: pricingId.trim() || undefined,
      vendorId,
      campaignId: campaignId.trim() || undefined,
      city: city.trim(),
      spaceType,
      cardRate,
      negotiatedRate,
      discountGiven,
      discountPercent,
      companyCostPrice,
      companySellingPrice,
      profitPerUnit,
      profitMarginPercent,
      durationDays: Number(durationDays) || 30,
      validityFrom: validityFrom || undefined,
      validityTo: validityTo || undefined,
      negotiationRounds: Number(negotiationRounds) || 1,
      negotiationNotes: negotiationNotes.trim(),
      approvedBy: approvedBy.trim(),
      totalAmount: negotiatedRate,
      lineItems: lineItems
        .filter(
          (item) => item.siteId || item.from || item.to || Number(item.negotiatedRatePerDay) > 0,
        )
        .map((item) => ({
          siteId: item.siteId || undefined,
          city: city.trim() || undefined,
          spaceType,
          from: item.from || undefined,
          to: item.to || undefined,
          negotiatedRatePerDay: Number(item.negotiatedRatePerDay) || 0,
        })),
    };

    const success = await onSubmit(payload);
    if (success) {
      onSuccess();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-[#E8E8EC] bg-white px-6 py-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#8B2424]/10 px-2.5 py-0.5 text-xs font-semibold text-[#8B2424]">
                <FileText className="h-3 w-3" />
                Purchase Order / Pricing
              </span>
              {pricingId && (
                <span className="font-mono text-xs text-gray-500 font-semibold">#{pricingId}</span>
              )}
            </div>
            <h2 className="mt-1.5 text-xl font-bold text-[#1F2937]">
              {order ? 'Edit Purchase Order & Pricing' : 'New Purchase Order & Pricing'}
            </h2>
            <p className="text-xs text-[#667085]">
              Configure vendor rates, discounts, cost margins and approval workflow
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
          >
            ✕
          </button>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="space-y-6 p-6">
            {/* Error Banner */}
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-700">{error}</p>
              </div>
            )}

            {/* LIVE KPI METRICS BANNER */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-xl border border-[#E8E8EC] bg-[#FAFAFB] p-4">
              <div className="rounded-lg bg-white p-3 border border-gray-100 shadow-xs">
                <div className="text-[11px] font-semibold uppercase text-gray-500">
                  Discount Given
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-lg font-bold text-emerald-600">
                    ₹{discountGiven.toLocaleString('en-IN')}
                  </span>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                    {discountPercent}%
                  </span>
                </div>
              </div>

              <div className="rounded-lg bg-white p-3 border border-gray-100 shadow-xs">
                <div className="text-[11px] font-semibold uppercase text-gray-500">Cost Price</div>
                <div className="mt-1 text-lg font-bold text-gray-900">
                  ₹{companyCostPrice.toLocaleString('en-IN')}
                </div>
              </div>

              <div className="rounded-lg bg-white p-3 border border-gray-100 shadow-xs">
                <div className="text-[11px] font-semibold uppercase text-gray-500">
                  Selling Price
                </div>
                <div className="mt-1 text-lg font-bold text-[#8B2424]">
                  ₹{companySellingPrice.toLocaleString('en-IN')}
                </div>
              </div>

              <div className="rounded-lg bg-white p-3 border border-gray-100 shadow-xs">
                <div className="text-[11px] font-semibold uppercase text-gray-500">
                  Profit / Margin
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span
                    className={`text-lg font-bold ${profitPerUnit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}
                  >
                    ₹{profitPerUnit.toLocaleString('en-IN')}
                  </span>
                  <span
                    className={`text-xs font-bold px-1.5 py-0.5 rounded ${profitMarginPercent >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}
                  >
                    {profitMarginPercent}%
                  </span>
                </div>
              </div>
            </div>

            {/* SECTION 1: VENDOR & LOCATION DETAILS */}
            <section className="rounded-xl border border-[#E8E8EC] p-5">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#1F2937]">
                <Building2 className="h-4 w-4 text-[#8B2424]" />
                Vendor & Space Details
              </h3>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                {/* Vendor Selector */}
                <div className="md:col-span-2">
                  <VendorSelector
                    value={vendorId}
                    vendors={vendors}
                    loading={loadingVendors}
                    disabled={saving}
                    fallbackName={
                      typeof order?.vendorId === 'object' ? order.vendorId?.name : undefined
                    }
                    onChange={handleVendorSelect}
                  />
                </div>

                {/* City */}
                <div>
                  <label className="mb-1.5 flex items-center gap-1 text-xs font-bold text-gray-700">
                    <MapPin className="h-3.5 w-3.5 text-gray-400" />
                    City / Location <span className="text-[#8B2424]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Indore, Bhopal..."
                    className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-[#8B2424] focus:ring-2 focus:ring-[#8B2424]/10"
                  />
                </div>

                {/* Space Type */}
                <div>
                  <label className="mb-1.5 flex items-center gap-1 text-xs font-bold text-gray-700">
                    <Layers className="h-3.5 w-3.5 text-gray-400" />
                    Space Type <span className="text-[#8B2424]">*</span>
                  </label>
                  <select
                    value={spaceType}
                    onChange={(e) => setSpaceType(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-[#8B2424] focus:ring-2 focus:ring-[#8B2424]/10"
                  >
                    {SPACE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Campaign (Optional) */}
                <div className="md:col-span-2">
                  <CampaignSelector
                    value={campaignId}
                    campaigns={campaigns}
                    loading={loadingCampaigns}
                    disabled={saving}
                    fallbackName={
                      typeof order?.campaignId === 'object' ? order.campaignId?.name : undefined
                    }
                    onChange={setCampaignId}
                  />
                </div>
              </div>
            </section>

            {/* SECTION 2: TIMELINE & DURATION */}
            <section className="rounded-xl border border-[#E8E8EC] p-5">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#1F2937]">
                <CalendarDays className="h-4 w-4 text-[#8B2424]" />
                Validity Period & Duration
              </h3>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {/* Validity From */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-gray-700">
                    Valid From Date
                  </label>
                  <input
                    type="date"
                    value={validityFrom}
                    onChange={(e) => handleValidityChange(e.target.value, validityTo)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-[#8B2424] focus:ring-2 focus:ring-[#8B2424]/10"
                  />
                </div>

                {/* Validity To */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-gray-700">
                    Valid Till Date
                  </label>
                  <input
                    type="date"
                    value={validityTo}
                    onChange={(e) => handleValidityChange(validityFrom, e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-[#8B2424] focus:ring-2 focus:ring-[#8B2424]/10"
                  />
                </div>

                {/* Duration (Days) */}
                <div>
                  <label className="mb-1.5 flex items-center gap-1 text-xs font-bold text-gray-700">
                    <Clock className="h-3.5 w-3.5 text-gray-400" />
                    Duration (Days) <span className="text-[#8B2424]">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={durationDays}
                    onChange={(e) => setDurationDays(Number(e.target.value) || 0)}
                    placeholder="30"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-[#8B2424] focus:ring-2 focus:ring-[#8B2424]/10"
                  />
                </div>
              </div>
            </section>

            {/* SECTION 3: RATES & NEGOTIATION FORMULAS */}
            <section className="rounded-xl border border-[#E8E8EC] p-5">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#1F2937]">
                <TrendingUp className="h-4 w-4 text-[#8B2424]" />
                Rate & Negotiation Calculations
              </h3>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
                {/* Card Rate */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-gray-700">
                    Card Rate (₹)
                    <span className="block text-[11px] font-normal text-gray-400">
                      Vendor standard rate
                    </span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={cardRate || ''}
                    onChange={(e) => setCardRate(Number(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-medium text-gray-900 outline-none transition focus:border-[#8B2424] focus:ring-2 focus:ring-[#8B2424]/10"
                  />
                </div>

                {/* Negotiated Rate */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-gray-700">
                    Negotiated Rate (₹) <span className="text-[#8B2424]">*</span>
                    <span className="block text-[11px] font-normal text-gray-400">
                      Final negotiated rate
                    </span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={negotiatedRate || ''}
                    onChange={(e) => handleNegotiatedRateChange(Number(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-[#8B2424]/30 bg-white px-3.5 py-2.5 text-sm font-bold text-[#8B2424] outline-none transition focus:border-[#8B2424] focus:ring-2 focus:ring-[#8B2424]/10"
                  />
                </div>

                {/* Discount Given (Auto) */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-gray-700">
                    Discount Given (₹)
                    <span className="block text-[11px] font-normal text-gray-400">
                      Card - Negotiated Rate
                    </span>
                  </label>
                  <div className="rounded-xl border border-gray-200 bg-gray-50/70 px-3.5 py-2.5 text-sm font-bold text-emerald-600">
                    ₹{discountGiven.toLocaleString('en-IN')}
                  </div>
                </div>

                {/* Discount % (Auto) */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-gray-700">
                    Discount %
                    <span className="block text-[11px] font-normal text-gray-400">
                      (Discount / Card) * 100
                    </span>
                  </label>
                  <div className="rounded-xl border border-gray-200 bg-gray-50/70 px-3.5 py-2.5 text-sm font-bold text-emerald-600">
                    {discountPercent}%
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {lineItems.map((item, index) => (
                  <div
                    key={`${item.siteId || 'new-site'}-${index}`}
                    className="rounded-xl border border-[#E8E8EC] bg-[#FAFAFB] p-4"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <p className="text-sm font-bold text-[#1F2937]">Site {index + 1}</p>

                      {lineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          disabled={saving}
                          className="text-xs font-bold text-[#8B2424] hover:underline disabled:opacity-50"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                      {/* Site ID */}
                      <Field
                        label="Site ID"
                        value={item.siteId || ''}
                        placeholder="Site ID"
                        onChange={(value) => updateItem(index, 'siteId', value)}
                      />

                      {/* From */}
                      <DatePicker
                        label="From Date"
                        value={item.from}
                        onChange={(value) => updateItem(index, 'from', value)}
                      />

                      {/* To */}
                      <DatePicker
                        label="To Date"
                        value={item.to}
                        onChange={(value) => updateItem(index, 'to', value)}
                      />

                      {/* Rate */}
                      <Field
                        label="Rate / Day"
                        type="number"
                        value={String(item.negotiatedRatePerDay || '')}
                        placeholder="0"
                        onChange={(value) =>
                          updateItem(index, 'negotiatedRatePerDay', Number(value))
                        }
                      />

                      {/* Amount */}
                      <div>
                        <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#667085]">
                          Amount
                        </label>

                        <div className="rounded-xl border border-[#E8E8EC] bg-white px-4 py-3 text-sm font-bold text-[#8B2424]">
                          ₹{Number(item.amount || 0).toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>

                    {/* Days calculation */}
                    {(item.days || 0) > 0 && (
                      <p className="mt-3 text-xs font-semibold text-[#667085]">
                        {item.days || 0} day
                        {item.days !== 1 ? 's' : ''} × ₹
                        {Number(item.negotiatedRatePerDay || 0).toLocaleString('en-IN')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* SECTION 4: COMPANY PRICING & PROFITABILITY */}
            <section className="rounded-xl border border-[#E8E8EC] p-5">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#1F2937]">
                <TrendingUp className="h-4 w-4 text-[#8B2424]" />
                Company Pricing & Profitability
              </h3>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
                {/* Company Cost Price */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-gray-700">
                    Company Cost Price (₹)
                    <span className="block text-[11px] font-normal text-gray-400">
                      Our unit cost
                    </span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={companyCostPrice || ''}
                    onChange={(e) => setCompanyCostPrice(Number(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-medium text-gray-900 outline-none transition focus:border-[#8B2424] focus:ring-2 focus:ring-[#8B2424]/10"
                  />
                </div>

                {/* Company Selling Price */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-gray-700">
                    Company Selling Price (₹)
                    <span className="block text-[11px] font-normal text-gray-400">
                      Client offer price
                    </span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={companySellingPrice || ''}
                    onChange={(e) => setCompanySellingPrice(Number(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-medium text-gray-900 outline-none transition focus:border-[#8B2424] focus:ring-2 focus:ring-[#8B2424]/10"
                  />
                </div>

                {/* Profit Per Unit (Auto) */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-gray-700">
                    Profit Per Unit (₹)
                    <span className="block text-[11px] font-normal text-gray-400">
                      Selling - Cost Price
                    </span>
                  </label>
                  <div
                    className={`rounded-xl border border-gray-200 bg-gray-50/70 px-3.5 py-2.5 text-sm font-bold ${profitPerUnit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}
                  >
                    ₹{profitPerUnit.toLocaleString('en-IN')}
                  </div>
                </div>

                {/* Profit Margin % (Auto) */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-gray-700">
                    Profit Margin %
                    <span className="block text-[11px] font-normal text-gray-400">
                      (Profit / Cost) * 100
                    </span>
                  </label>
                  <div
                    className={`rounded-xl border border-gray-200 bg-gray-50/70 px-3.5 py-2.5 text-sm font-bold ${profitMarginPercent >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}
                  >
                    {profitMarginPercent}%
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION 5: NEGOTIATION NOTES & APPROVAL */}
            <section className="rounded-xl border border-[#E8E8EC] p-5">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#1F2937]">
                <ShieldCheck className="h-4 w-4 text-[#8B2424]" />
                Negotiation History & Approval
              </h3>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Negotiation Rounds */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-gray-700">
                    Negotiation Rounds
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={negotiationRounds}
                    onChange={(e) => setNegotiationRounds(Number(e.target.value) || 1)}
                    placeholder="1"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-[#8B2424] focus:ring-2 focus:ring-[#8B2424]/10"
                  />
                </div>

                {/* Approved By */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-gray-700">
                    Approved By (User / Employee)
                  </label>
                  <input
                    type="text"
                    value={approvedBy}
                    onChange={(e) => setApprovedBy(e.target.value)}
                    placeholder="e.g. Sales Manager, Operational Head..."
                    className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-[#8B2424] focus:ring-2 focus:ring-[#8B2424]/10"
                  />
                </div>

                {/* Negotiation Notes */}
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-bold text-gray-700">
                    Negotiation Notes
                    <span className="block text-[11px] font-normal text-gray-400">
                      Strategy, vendor constraints, special conditions or discount terms
                    </span>
                  </label>
                  <textarea
                    rows={3}
                    value={negotiationNotes}
                    onChange={(e) => setNegotiationNotes(e.target.value)}
                    placeholder="Enter negotiation notes..."
                    className="w-full rounded-xl border border-gray-200 bg-white p-3.5 text-sm text-gray-900 outline-none transition focus:border-[#8B2424] focus:ring-2 focus:ring-[#8B2424]/10"
                  />
                </div>
              </div>
            </section>
          </div>

          {/* FOOTER */}
          <div className="flex items-center justify-between border-t border-[#E8E8EC] bg-[#FAFAFB] px-6 py-4">
            <div>
              <span className="text-xs text-gray-500 font-medium">Final Purchase Amount: </span>
              <span className="text-lg font-bold text-[#8B2424]">
                ₹{negotiatedRate.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving || !vendorId || !city}
                className="rounded-xl bg-[#8B2424] px-6 py-2.5 text-sm font-bold text-white shadow-xs hover:bg-[#A8383B] transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Saving...' : order ? 'Update Purchase Order' : 'Save Purchase Order'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  placeholder,
  type = 'text',
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  type?: 'text' | 'number';
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold text-gray-700">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-[#8B2424] focus:ring-2 focus:ring-[#8B2424]/10"
      />
    </div>
  );
}

/**
 * Searchable Campaign Selector Component
 */
function CampaignSelector({
  value,
  campaigns,
  loading,
  disabled,
  fallbackName,
  onChange,
}: {
  value: string;
  campaigns: CampaignOption[];
  loading?: boolean;
  disabled?: boolean;
  fallbackName?: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const selectedCampaign = campaigns.find((c) => c._id === value);

  const filteredCampaigns = campaigns.filter((c) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      (c.name || '').toLowerCase().includes(term) ||
      (c.campaignCode || '').toLowerCase().includes(term) ||
      (c.city || '').toLowerCase().includes(term)
    );
  });

  return (
    <div ref={dropdownRef} className="relative">
      <label className="mb-1.5 block text-xs font-bold text-gray-700">Campaign (Optional)</label>

      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-left text-sm text-gray-900 outline-none transition hover:border-[#8B2424] focus:border-[#8B2424] focus:ring-2 focus:ring-[#F9DADA] disabled:cursor-not-allowed disabled:bg-[#F7F8FA]"
      >
        <div className="truncate">
          {selectedCampaign ? (
            <div>
              <span className="font-bold text-[#1F2937]">{selectedCampaign.name}</span>
              {selectedCampaign.campaignCode && (
                <span className="ml-2 text-xs font-semibold text-[#8B2424]">
                  ({selectedCampaign.campaignCode})
                </span>
              )}
              {selectedCampaign.city && (
                <span className="ml-2 text-xs text-[#667085]">• {selectedCampaign.city}</span>
              )}
            </div>
          ) : fallbackName ? (
            <span className="font-semibold text-gray-900">{fallbackName}</span>
          ) : value ? (
            <span className="text-gray-700">Campaign #{value.slice(-6)}</span>
          ) : (
            <span className="text-gray-400">
              {loading ? 'Loading campaigns...' : 'Select Campaign'}
            </span>
          )}
        </div>
        <span className="text-gray-500">▾</span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 p-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search campaigns..."
              className="w-full rounded-lg bg-gray-50 px-3 py-1.5 text-xs text-gray-900 outline-none focus:ring-1 focus:ring-[#8B2424]"
            />
          </div>

          <div className="p-1">
            <button
              type="button"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
              className="w-full px-3 py-2 text-left text-xs font-medium text-gray-500 hover:bg-gray-50 rounded-lg"
            >
              None (No Campaign)
            </button>
            {loading && <div className="p-3 text-center text-xs text-gray-400">Loading...</div>}
            {!loading && filteredCampaigns.length === 0 && (
              <div className="p-3 text-center text-xs text-gray-400">No campaigns found</div>
            )}
            <div className="max-h-48 overflow-y-auto divide-y divide-gray-50">
              {filteredCampaigns.map((c) => {
                const isSelected = c._id === value;
                return (
                  <button
                    key={c._id}
                    type="button"
                    onClick={() => {
                      onChange(c._id);
                      setOpen(false);
                      setSearch('');
                    }}
                    className={`block w-full px-4 py-2.5 text-left text-sm transition hover:bg-[#F9DADA] hover:text-[#8B2424] ${
                      isSelected ? 'bg-[#FFF5F5] font-semibold text-[#8B2424]' : 'text-gray-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold">{c.name}</span>
                      {c.campaignCode && (
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600">
                          {c.campaignCode}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-[#667085]">
                      {c.city || 'No city specified'}
                      {c.status ? ` • ${c.status}` : ''}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Searchable Vendor Selector Component
 */
function VendorSelector({
  value,
  vendors,
  loading,
  disabled,
  fallbackName,
  onChange,
}: {
  value: string;
  vendors: VendorOption[];
  loading?: boolean;
  disabled?: boolean;
  fallbackName?: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const selectedVendor = vendors.find((v) => v._id === value);

  const filteredVendors = vendors.filter((v) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      (v.name || '').toLowerCase().includes(term) ||
      (v.city || '').toLowerCase().includes(term) ||
      (v.contactPerson || '').toLowerCase().includes(term)
    );
  });

  return (
    <div ref={dropdownRef} className="relative">
      <label className="mb-1.5 block text-xs font-bold text-gray-700">
        Vendor <span className="text-[#8B2424]">*</span>
      </label>

      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-left text-sm text-gray-900 outline-none transition hover:border-[#8B2424] focus:border-[#8B2424] focus:ring-2 focus:ring-[#F9DADA] disabled:cursor-not-allowed disabled:bg-[#F7F8FA]"
      >
        <div className="truncate">
          {selectedVendor ? (
            <div>
              <span className="font-bold text-[#1F2937]">{selectedVendor.name}</span>
              {selectedVendor.city && (
                <span className="ml-2 text-xs text-[#667085]">
                  — {selectedVendor.city}
                  {selectedVendor.state ? `, ${selectedVendor.state}` : ''}
                </span>
              )}
            </div>
          ) : fallbackName ? (
            <span className="font-semibold text-gray-900">{fallbackName}</span>
          ) : value ? (
            <span className="text-gray-700">Vendor #{value.slice(-6)}</span>
          ) : (
            <span className="text-gray-400">
              {loading ? 'Loading vendors...' : 'Select Active Vendor'}
            </span>
          )}
        </div>
        <span className="text-gray-500">▾</span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 p-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search vendors..."
              className="w-full rounded-lg bg-gray-50 px-3 py-1.5 text-xs text-gray-900 outline-none focus:ring-1 focus:ring-[#8B2424]"
            />
          </div>

          <div className="p-1">
            {loading && <div className="p-3 text-center text-xs text-gray-400">Loading...</div>}
            {!loading && filteredVendors.length === 0 && (
              <div className="p-3 text-center text-xs text-gray-400">No vendors found</div>
            )}
            <div className="max-h-48 overflow-y-auto divide-y divide-gray-50">
              {filteredVendors.map((v) => {
                const isSelected = v._id === value;
                return (
                  <button
                    key={v._id}
                    type="button"
                    onClick={() => {
                      onChange(v._id);
                      setOpen(false);
                      setSearch('');
                    }}
                    className={`block w-full px-4 py-2.5 text-left text-sm transition hover:bg-[#F9DADA] hover:text-[#8B2424] ${
                      isSelected ? 'bg-[#FFF5F5] font-semibold text-[#8B2424]' : 'text-gray-900'
                    }`}
                  >
                    <div className="text-sm font-bold">{v.name}</div>
                    <div className="mt-0.5 text-xs text-[#667085]">
                      {v.contactPerson ? `${v.contactPerson} • ` : ''}
                      {v.city ? `${v.city}${v.state ? `, ${v.state}` : ''}` : 'No location'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
