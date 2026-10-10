'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Trash2,
  Building2,
  Calendar,
  FileText,
  DollarSign,
  Calculator,
  ArrowLeft,
  Search,
  CheckCircle,
  AlertCircle,
  Clock,
  Sparkles,
  CreditCard,
} from 'lucide-react';
import { invoicesApi, bankAccountsApi } from '../api';
import type { Invoice, InvoiceType, InvoiceStatus, BankAccount } from '../types';
import { RecentPricesWidget } from './RecentPricesWidget';
import { BankAccountModal } from './BankAccountModal';
import { api } from '@/shared/api/client';
import { formatCurrency } from '../utils/formatters';

interface LineItemState {
  name: string;
  description: string;
  hsn: string;
  quantity: number;
  unit: string;
  discountRupees?: number;
  rateRupees: number;
  taxPercent: number;
}

interface InvoiceFormProps {
  initialInvoice?: Invoice;
  defaultType?: InvoiceType;
  isEdit?: boolean;
}

const COMMON_OOH_ITEMS = [
  { name: 'Billboard Hoarding Display', hsn: '998361', unit: 'Month', tax: 18, rate: 50000 },
  { name: 'Digital LED Screen Slot', hsn: '998362', unit: 'Month', tax: 18, rate: 75000 },
  { name: 'Bus Shelter Branding', hsn: '998361', unit: 'Nos', tax: 18, rate: 25000 },
  { name: 'Metro Pillar Advertising', hsn: '998361', unit: 'Nos', tax: 18, rate: 35000 },
  { name: 'Mall Kiosk / Facade Branding', hsn: '998361', unit: 'Month', tax: 18, rate: 60000 },
  { name: 'Vinyl Printing & Mounting Services', hsn: '9988', unit: 'Sq Ft', tax: 18, rate: 45 },
  { name: 'Flex Banner Fabrication & Installation', hsn: '9988', unit: 'Sq Ft', tax: 18, rate: 65 },
  { name: 'Site Maintenance & Illumination Charge', hsn: '9987', unit: 'Month', tax: 18, rate: 10000 },
];

export function InvoiceForm({ initialInvoice, defaultType = 'sales_invoice', isEdit = false }: InvoiceFormProps) {
  const router = useRouter();

  // Invoice basic info
  const [type, setType] = useState<InvoiceType>(initialInvoice?.type || defaultType);
  const [invoicePrefix, setInvoicePrefix] = useState(
    initialInvoice?.invoicePrefix || (defaultType === 'proforma' ? 'PI-TEST' : 'INV-TEST')
  );
  const [invoiceNumber, setInvoiceNumber] = useState(initialInvoice?.invoiceNumber || '');
  const [status, setStatus] = useState<InvoiceStatus>(initialInvoice?.status || 'Draft');

  // Party info
  const [partyId, setPartyId] = useState<string | null>(initialInvoice?.partyId || null);
  const [partyName, setPartyName] = useState(initialInvoice?.partyName || '');
  const [billingAddress, setBillingAddress] = useState(initialInvoice?.billingAddress || '');
  const [shippingAddress, setShippingAddress] = useState(initialInvoice?.shippingAddress || '');
  const [gstin, setGstin] = useState(initialInvoice?.gstin || '');
  const [placeOfSupply, setPlaceOfSupply] = useState(initialInvoice?.placeOfSupply || 'Maharashtra (27)');
  const [contactPerson, setContactPerson] = useState(initialInvoice?.contactPerson || '');
  const [contactMobile, setContactMobile] = useState(initialInvoice?.contactMobile || '');
  const [contactEmail, setContactEmail] = useState(initialInvoice?.contactEmail || '');

  // Dates
  const [invoiceDate, setInvoiceDate] = useState<string>(
    initialInvoice?.invoiceDate ? initialInvoice.invoiceDate.split('T')[0] : new Date().toISOString().split('T')[0]
  );
  const [dueDate, setDueDate] = useState<string>(
    initialInvoice?.dueDate
      ? initialInvoice.dueDate.split('T')[0]
      : new Date(Date.now() + (defaultType === 'proforma' ? 7 : 15) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );

  // Campaign
  const [campaignId, setCampaignId] = useState<string>(initialInvoice?.campaignId || '');

  // Line items (in Rupees for input, converted to paise on submit)
  const [items, setItems] = useState<LineItemState[]>(
    initialInvoice?.items?.length
      ? initialInvoice.items.map((i) => ({
          name: i.name,
          description: i.description || '',
          hsn: i.hsn || '998361',
          quantity: i.quantity || 1,
          unit: i.unit || 'Nos',
          discountRupees: (i.discount || 0) / 100,
          rateRupees: (i.rate || 0) / 100,
          taxPercent: i.taxPercent ?? 18,
        }))
      : [
          {
            name: '',
            description: '',
            hsn: '998361',
            quantity: 1,
            unit: 'Nos',
            discountRupees: 0,
            rateRupees: 0,
            taxPercent: 18,
          },
        ]
  );

  // Active item index for recent prices widget
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(0);

  // Financial adjustments (in Rupees)
  const [discountRupees, setDiscountRupees] = useState<number>((initialInvoice?.discount || 0) / 100);
  const [additionalChargesRupees, setAdditionalChargesRupees] = useState<number>(
    (initialInvoice?.additionalCharges || 0) / 100
  );
  const [tcsRupees, setTcsRupees] = useState<number>((initialInvoice?.tcs || 0) / 100);
  const [roundOffRupees, setRoundOffRupees] = useState<number>((initialInvoice?.roundOff || 0) / 100);

  // Bank & terms
  const [bankName, setBankName] = useState(initialInvoice?.bankDetails?.bankName || 'HDFC Bank');
  const [accountNumber, setAccountNumber] = useState(initialInvoice?.bankDetails?.accountNumber || '50200088991122');
  const [ifsc, setIfsc] = useState(initialInvoice?.bankDetails?.ifsc || 'HDFC0000123');
  const [branch, setBranch] = useState(initialInvoice?.bankDetails?.branch || 'Bandra West, Mumbai');
  const [accountHolderName, setAccountHolderName] = useState(
    initialInvoice?.bankDetails?.accountHolderName || 'Media Octus Pvt Ltd'
  );
  const [termsAndConditions, setTermsAndConditions] = useState(
    initialInvoice?.termsAndConditions ||
      '1. Payment due within the stipulated due date.\n2. Invoices overdue beyond 15 days will incur 18% p.a. interest.\n3. All disputes subject to Mumbai jurisdiction.'
  );
  const [notes, setNotes] = useState(initialInvoice?.notes || '');
  const [editNote, setEditNote] = useState('');

  // Dropdown lists
  const [leads, setLeads] = useState<Array<{ id: string; _id?: string; companyName: string; companyAddress?: string; gstin?: string; contactPerson?: string; mobile?: string; email?: string; city?: string }>>([]);
  const [campaigns, setCampaigns] = useState<Array<{ id: string; _id?: string; name: string; campaignCode?: string }>>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>('');
  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBankAccounts = () => {
    bankAccountsApi.getBankAccounts()
      .then((res) => {
        const list = res.data || [];
        setBankAccounts(list);
        if (!initialInvoice?.bankDetails?.accountNumber && list.length > 0) {
          const defaultAcc = list.find((a) => a.isDefault) || list[0];
          if (defaultAcc) {
            setSelectedBankAccountId(defaultAcc.id);
            setBankName(defaultAcc.bankName);
            setAccountHolderName(defaultAcc.accountHolderName);
            setAccountNumber(defaultAcc.accountNumber);
            setIfsc(defaultAcc.ifsc);
            setBranch(defaultAcc.branch);
          }
        }
      })
      .catch(() => {});
  };

  // Fetch leads, campaigns, and bank accounts for auto-population
  useEffect(() => {
    fetchBankAccounts();

    api.get<{ leads?: any[]; data?: any[] }>('/api/leads?limit=100')
      .then((res) => {
        setLeads(res.leads || res.data || []);
      })
      .catch(() => {});

    api.get<{ campaigns?: any[]; data?: any[] }>('/api/campaigns?limit=100')
      .then((res) => {
        setCampaigns(res.campaigns || res.data || []);
      })
      .catch(() => {});
  }, []);

  const handleSelectBankAccount = (accId: string) => {
    setSelectedBankAccountId(accId);
    const acc = bankAccounts.find((a) => a.id === accId);
    if (acc) {
      setBankName(acc.bankName);
      setAccountHolderName(acc.accountHolderName);
      setAccountNumber(acc.accountNumber);
      setIfsc(acc.ifsc);
      setBranch(acc.branch);
    }
  };

  // Handle party selection and auto-fill
  const handleSelectParty = (selectedPartyId: string) => {
    if (!selectedPartyId) {
      setPartyId(null);
      return;
    }

    const lead = leads.find((l) => (l._id || l.id) === selectedPartyId);
    if (lead) {
      setPartyId(lead._id || lead.id);
      setPartyName(lead.companyName || '');
      if (lead.companyAddress) {
        setBillingAddress(lead.companyAddress);
        setShippingAddress(lead.companyAddress);
      }
      if (lead.gstin) setGstin(lead.gstin);
      if (lead.contactPerson) setContactPerson(lead.contactPerson);
      if (lead.mobile) setContactMobile(lead.mobile);
      if (lead.email) setContactEmail(lead.email);
      if (lead.city) {
        setPlaceOfSupply(`${lead.city}, Maharashtra (27)`);
      }
    }
  };

  // Line item handlers
  const handleItemChange = (index: number, field: keyof LineItemState, value: any) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleApplyPreset = (index: number, preset: typeof COMMON_OOH_ITEMS[0]) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        name: preset.name,
        hsn: preset.hsn,
        unit: preset.unit,
        taxPercent: preset.tax,
        rateRupees: preset.rate,
      };
      return copy;
    });
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        name: '',
        description: '',
        hsn: '998361',
        quantity: 1,
        unit: 'Nos',
        discountRupees: 0,
        rateRupees: 0,
        taxPercent: 18,
      },
    ]);
    setActiveItemIndex(items.length);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
    if (activeItemIndex === index) {
      setActiveItemIndex(Math.max(0, index - 1));
    }
  };

  // Real-time calculation of invoice totals
  const calculations = useMemo(() => {
    let subtotalRupees = 0;
    let totalItemDiscountRupees = 0;
    let taxAmountRupees = 0;

    const lineCalculations = items.map((item) => {
      const qty = Number(item.quantity) || 0;
      const rate = Number(item.rateRupees) || 0;
      const disc = Math.max(0, Number(item.discountRupees) || 0);
      const taxPct = Math.max(0, Number(item.taxPercent) || 0);

      const base = qty * rate;
      const taxable = Math.max(0, base - disc);
      const tax = (taxable * taxPct) / 100;
      const total = taxable + tax;

      subtotalRupees += base;
      totalItemDiscountRupees += disc;
      taxAmountRupees += tax;

      return {
        base,
        discount: disc,
        taxable,
        tax,
        total,
      };
    });

    const overallDisc = Number(discountRupees) || 0;
    const charges = Number(additionalChargesRupees) || 0;
    const taxableRupees = Math.max(0, subtotalRupees - totalItemDiscountRupees - overallDisc + charges);
    const tcs = Number(tcsRupees) || 0;
    const roundOff = Number(roundOffRupees) || 0;
    const grandTotalRupees = Math.max(0, taxableRupees + taxAmountRupees + tcs + roundOff);

    return {
      lineCalculations,
      subtotalRupees,
      totalItemDiscountRupees,
      taxableRupees,
      taxAmountRupees,
      grandTotalRupees,
    };
  }, [items, discountRupees, additionalChargesRupees, tcsRupees, roundOffRupees]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyName.trim()) {
      setError('Please provide a Party / Customer Name.');
      return;
    }

    if (items.some((i) => !i.name.trim())) {
      setError('All line items must have a valid item name.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        type,
        invoicePrefix,
        invoiceNumber: invoiceNumber.trim() || undefined,
        partyId: partyId || undefined,
        partyName: partyName.trim(),
        billingAddress,
        shippingAddress,
        gstin,
        placeOfSupply,
        contactPerson,
        contactMobile,
        contactEmail,
        campaignId: campaignId || undefined,
        invoiceDate: new Date(invoiceDate).toISOString(),
        dueDate: new Date(dueDate).toISOString(),
        items: items.map((i) => ({
          name: i.name.trim(),
          description: i.description.trim(),
          hsn: i.hsn.trim() || '998361',
          quantity: Number(i.quantity) || 1,
          unit: i.unit.trim() || 'Nos',
          discount: Math.round((Number(i.discountRupees) || 0) * 100), // convert to paise
          rate: Math.round((Number(i.rateRupees) || 0) * 100), // convert to paise
          taxPercent: Number(i.taxPercent) || 0,
        })),
        discount: Math.round((Number(discountRupees) || 0) * 100),
        additionalCharges: Math.round((Number(additionalChargesRupees) || 0) * 100),
        tcs: Math.round((Number(tcsRupees) || 0) * 100),
        roundOff: Math.round((Number(roundOffRupees) || 0) * 100),
        bankDetails: {
          bankName,
          accountNumber,
          ifsc,
          branch,
          accountHolderName,
        },
        termsAndConditions,
        notes,
        status,
        editNote: isEdit ? editNote || 'Updated via Invoice Editor' : undefined,
      };

      if (isEdit && initialInvoice) {
        const res = await invoicesApi.updateInvoice(initialInvoice.id || (initialInvoice as any)._id, payload);
        const targetType = res.invoice?.type || type;
        router.push(targetType === 'proforma' ? `/finance/proforma-invoices/${res.invoice.id}` : `/finance/invoices/${res.invoice.id}`);
      } else {
        const res = await invoicesApi.createInvoice(payload);
        const targetType = res.invoice?.type || type;
        router.push(targetType === 'proforma' ? `/finance/proforma-invoices/${res.invoice.id}` : `/finance/invoices/${res.invoice.id}`);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to save invoice. Please check all fields.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              {isEdit ? `Edit ${type === 'proforma' ? 'Proforma' : 'Sales'} Invoice` : `Create ${type === 'proforma' ? 'Proforma' : 'Sales'} Invoice`}
            </h1>
            <p className="text-xs text-slate-500">
              {type === 'proforma' ? 'Draft quotation / proforma billing document' : 'Tax-compliant sales invoice & GST billing'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Type Toggle */}
          {!isEdit && (
            <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setType('sales_invoice');
                  setInvoicePrefix('INV');
                }}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  type === 'sales_invoice' ? 'bg-white text-[#6E1D1D] shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sales Invoice
              </button>
              <button
                type="button"
                onClick={() => {
                  setType('proforma');
                  setInvoicePrefix('PI');
                }}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  type === 'proforma' ? 'bg-white text-[#6E1D1D] shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Proforma Invoice
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-[#6E1D1D] px-5 py-2 text-xs font-semibold text-white shadow hover:bg-[#581717] focus:ring-2 focus:ring-[#6E1D1D]/50 transition-all disabled:opacity-50"
          >
            <CheckCircle className="h-4 w-4" />
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Save Invoice'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Top Grid: Party Details & Invoice Metadata */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer / Party Section (2 Cols) */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-[#6E1D1D]" />
              Customer / Party Information
            </h2>
            <span className="text-[11px] text-slate-400">Auto-populates from CRM Leads</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Existing Party Select */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Select Existing Client / Lead
              </label>
              <select
                value={partyId || ''}
                onChange={(e) => handleSelectParty(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#6E1D1D] focus:ring-1 focus:ring-[#6E1D1D] outline-none"
              >
                <option value="">-- Choose from CRM Leads or Enter Custom Below --</option>
                {leads.map((l) => (
                  <option key={l._id || l.id} value={l._id || l.id}>
                    {l.companyName} {l.city ? `(${l.city})` : ''} {l.contactPerson ? `- ${l.contactPerson}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Party / Company Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={partyName}
                onChange={(e) => setPartyName(e.target.value)}
                placeholder="e.g. Acme Retail Ltd"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-[#6E1D1D] focus:ring-1 focus:ring-[#6E1D1D] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Customer GSTIN</label>
              <input
                type="text"
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                placeholder="27AABCU9603R1ZM"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-[#6E1D1D] focus:ring-1 focus:ring-[#6E1D1D] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Billing Address</label>
              <textarea
                rows={2}
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
                placeholder="Full billing address..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-[#6E1D1D] focus:ring-1 focus:ring-[#6E1D1D] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Shipping / Site Address</label>
              <textarea
                rows={2}
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                placeholder="Shipping/display location address..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-[#6E1D1D] focus:ring-1 focus:ring-[#6E1D1D] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Place of Supply</label>
              <input
                type="text"
                value={placeOfSupply}
                onChange={(e) => setPlaceOfSupply(e.target.value)}
                placeholder="Maharashtra (27)"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-[#6E1D1D] focus:ring-1 focus:ring-[#6E1D1D] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Person & Phone</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="Person name"
                  className="w-1/2 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-[#6E1D1D] focus:ring-1 focus:ring-[#6E1D1D] outline-none"
                />
                <input
                  type="text"
                  value={contactMobile}
                  onChange={(e) => setContactMobile(e.target.value)}
                  placeholder="Mobile"
                  className="w-1/2 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-[#6E1D1D] focus:ring-1 focus:ring-[#6E1D1D] outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Invoice Metadata (1 Col) */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#6E1D1D]" />
              Invoice Details
            </h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#F8E6E6] text-[#6E1D1D]">
              {type === 'proforma' ? 'Proforma' : 'Tax Invoice'}
            </span>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Prefix</label>
                <input
                  type="text"
                  value={invoicePrefix}
                  onChange={(e) => setInvoicePrefix(e.target.value.toUpperCase())}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-[#6E1D1D] outline-none text-center font-semibold"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Invoice Number</label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="[Auto Generated]"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-[#6E1D1D] outline-none bg-slate-50 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Invoice Date</label>
              <input
                type="date"
                required
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-[#6E1D1D] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Due Date</label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-[#6E1D1D] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Link to Campaign (Optional)</label>
              <select
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#6E1D1D] outline-none"
              >
                <option value="">-- No Campaign Linked --</option>
                {campaigns.map((c) => (
                  <option key={c._id || c.id} value={c._id || c.id}>
                    {c.campaignCode ? `[${c.campaignCode}] ` : ''}
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as InvoiceStatus)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#6E1D1D] outline-none"
              >
                <option value="Draft">Draft</option>
                <option value="Sent">Sent / Issued</option>
                <option value="Partially Paid">Partially Paid</option>
                <option value="Paid">Paid</option>
                <option value="Overdue">Overdue</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Items Section */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Calculator className="h-4 w-4 text-[#6E1D1D]" />
              Items & Bill of Services
            </h2>
            <p className="text-[11px] text-slate-500">Add media display sites, printing, mounting or service charges</p>
          </div>

          {/* Quick presets dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium hidden sm:inline">Quick Add:</span>
            <select
              onChange={(e) => {
                const preset = COMMON_OOH_ITEMS.find((p) => p.name === e.target.value);
                if (preset) {
                  const targetIdx = activeItemIndex !== null ? activeItemIndex : items.length - 1;
                  handleApplyPreset(targetIdx, preset);
                }
                e.target.value = '';
              }}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 focus:border-[#6E1D1D] outline-none"
            >
              <option value="">-- Quick OOH Preset --</option>
              {COMMON_OOH_ITEMS.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name} (₹{p.rate}/{p.unit})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold">
                <th className="py-2.5 px-3 w-10 text-center">#</th>
                <th className="py-2.5 px-3 min-w-[200px]">Item & Description</th>
                <th className="py-2.5 px-3 w-24">HSN/SAC</th>
                <th className="py-2.5 px-3 w-20">Qty</th>
                <th className="py-2.5 px-3 w-24">Unit</th>
                <th className="py-2.5 px-3 w-28 text-right">Discount (₹)</th>
                <th className="py-2.5 px-3 w-28 text-right">Rate (₹)</th>
                <th className="py-2.5 px-3 min-w-[140px] text-right">Tax (%)</th>
                <th className="py-2.5 px-3 w-28 text-right">Tax (₹)</th>
                <th className="py-2.5 px-3 w-32 text-right">Amount (₹)</th>
                <th className="py-2.5 px-2 w-10 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, idx) => {
                const calc = calculations.lineCalculations[idx] || { base: 0, discount: 0, taxable: 0, tax: 0, total: 0 };
                return (
                  <tr
                    key={idx}
                    onClick={() => setActiveItemIndex(idx)}
                    className={`transition-colors ${activeItemIndex === idx ? 'bg-amber-50/20' : 'hover:bg-slate-50/50'}`}
                  >
                    <td className="py-3 px-3 text-center text-slate-400 font-semibold">{idx + 1}</td>
                    <td className="py-3 px-3 space-y-1">
                      <input
                        type="text"
                        required
                        value={item.name}
                        onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                        placeholder="e.g. Bandra Billboard Hoarding"
                        className="w-full rounded border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900 font-medium focus:border-[#6E1D1D] outline-none"
                      />
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                        placeholder="Size, location, specific details..."
                        className="w-full rounded border border-slate-100 bg-slate-50/50 px-2 py-1 text-[11px] text-slate-600 focus:border-[#6E1D1D] outline-none"
                      />
                    </td>
                    <td className="py-3 px-3">
                      <input
                        type="text"
                        value={item.hsn}
                        onChange={(e) => handleItemChange(idx, 'hsn', e.target.value)}
                        placeholder="998361"
                        className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs text-slate-800 text-center focus:border-[#6E1D1D] outline-none"
                      />
                    </td>
                    <td className="py-3 px-3">
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        required
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs text-slate-900 text-center font-medium focus:border-[#6E1D1D] outline-none"
                      />
                    </td>
                    <td className="py-3 px-3">
                      <select
                        value={item.unit}
                        onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                        className="w-full rounded border border-slate-200 bg-white px-1.5 py-1.5 text-xs text-slate-800 focus:border-[#6E1D1D] outline-none"
                      >
                        <option value="Nos">Nos</option>
                        <option value="Month">Month</option>
                        <option value="Days">Days</option>
                        <option value="Sq Ft">Sq Ft</option>
                        <option value="Units">Units</option>
                        <option value="Pkg">Pkg</option>
                      </select>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={item.discountRupees !== undefined && item.discountRupees > 0 ? item.discountRupees : ''}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          handleItemChange(idx, 'discountRupees', isNaN(val) ? 0 : Math.max(0, val));
                        }}
                        placeholder="0.00"
                        className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs text-slate-900 text-right font-medium focus:border-[#6E1D1D] outline-none"
                      />
                    </td>
                    <td className="py-3 px-3 text-right">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        required
                        value={item.rateRupees || ''}
                        onChange={(e) => handleItemChange(idx, 'rateRupees', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs text-slate-900 text-right font-medium focus:border-[#6E1D1D] outline-none"
                      />
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="any"
                          value={item.taxPercent !== undefined ? item.taxPercent : 18}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            handleItemChange(idx, 'taxPercent', isNaN(val) ? 0 : Math.max(0, Math.min(100, val)));
                          }}
                          placeholder="18"
                          className="w-14 rounded border border-slate-200 px-1.5 py-1.5 text-xs text-slate-900 text-right font-semibold focus:border-[#6E1D1D] outline-none"
                        />
                        <select
                          value={[0, 5, 12, 18, 28].includes(Number(item.taxPercent)) ? Number(item.taxPercent) : 'custom'}
                          onChange={(e) => {
                            if (e.target.value !== 'custom') {
                              handleItemChange(idx, 'taxPercent', parseFloat(e.target.value) || 0);
                            }
                          }}
                          className="rounded border border-slate-200 bg-white px-1 py-1.5 text-xs text-slate-700 font-medium focus:border-[#6E1D1D] outline-none"
                          title="Tax rate preset"
                        >
                          <option value="0">0%</option>
                          <option value="5">5%</option>
                          <option value="12">12%</option>
                          <option value="18">18%</option>
                          <option value="28">28%</option>
                          {![0, 5, 12, 18, 28].includes(Number(item.taxPercent)) && (
                            <option value="custom">Custom</option>
                          )}
                        </select>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right text-slate-600 font-medium">
                      ₹{calc.tax.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900">
                      ₹{calc.total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        disabled={items.length <= 1}
                        className="text-slate-300 hover:text-red-600 transition-colors disabled:opacity-20"
                        title="Remove Item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Add Row Button & Price History Helper */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-100">
          <button
            type="button"
            onClick={handleAddItem}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-[#6E1D1D] hover:bg-[#F8E6E6] hover:text-[#6E1D1D] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Another Item
          </button>

          <span className="text-[11px] text-slate-400">
            {items.length} item{items.length > 1 ? 's' : ''} in this invoice
          </span>
        </div>

        {/* Recent Sales Prices Widget for active item */}
        {activeItemIndex !== null && items[activeItemIndex]?.name && partyId && (
          <RecentPricesWidget
            partyId={partyId}
            itemName={items[activeItemIndex].name}
            onSelectRate={(ratePaise) => {
              handleItemChange(activeItemIndex, 'rateRupees', ratePaise / 100);
            }}
          />
        )}
      </div>

      {/* Bottom Section: Bank Details, Terms & Calculations Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bank & Terms (Left) */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-[#6E1D1D]" />
              <h3 className="text-sm font-bold text-slate-900">Bank Details & Terms</h3>
            </div>
            <button
              type="button"
              onClick={() => setBankModalOpen(true)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#6E1D1D] hover:underline"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Bank Account
            </button>
          </div>

          {/* Quick Bank Account Selector */}
          {bankAccounts.length > 0 && (
            <div>
              <label className="block text-slate-600 font-medium text-xs mb-1">Select Saved Bank Account</label>
              <select
                value={selectedBankAccountId}
                onChange={(e) => handleSelectBankAccount(e.target.value)}
                className="w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-[#6E1D1D]"
              >
                <option value="">-- Custom / Manual Bank Entry --</option>
                {bankAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.bankName} - {acc.accountNumber} ({acc.branch}){acc.isDefault ? ' [DEFAULT]' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-slate-600 font-medium mb-1">Bank Name</label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full rounded border border-slate-200 px-2.5 py-1.5 outline-none focus:border-[#6E1D1D]"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">A/C Number</label>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className="w-full rounded border border-slate-200 px-2.5 py-1.5 outline-none focus:border-[#6E1D1D] font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">IFSC Code</label>
              <input
                type="text"
                value={ifsc}
                onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                className="w-full rounded border border-slate-200 px-2.5 py-1.5 outline-none focus:border-[#6E1D1D] font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Branch</label>
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="w-full rounded border border-slate-200 px-2.5 py-1.5 outline-none focus:border-[#6E1D1D]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Terms & Conditions</label>
            <textarea
              rows={2}
              value={termsAndConditions}
              onChange={(e) => setTermsAndConditions(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-[#6E1D1D] outline-none"
            />
          </div>

          {isEdit && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Edit Reason / Note (Audit Log)</label>
              <input
                type="text"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="Reason for modifying this invoice..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-[#6E1D1D] outline-none"
              />
            </div>
          )}
        </div>

        {/* Summary & Totals Box (Right) */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 shadow-2xs space-y-3">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2">
            Invoice Summary & Calculations
          </h3>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal (Base Total):</span>
              <span className="font-semibold text-slate-900">
                ₹{calculations.subtotalRupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {calculations.totalItemDiscountRupees > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Item Discounts (-):</span>
                <span className="font-semibold">
                  -₹{calculations.totalItemDiscountRupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 text-slate-600">
              <span>Discount (-):</span>
              <div className="flex items-center gap-1 w-32">
                <span className="text-slate-400">₹</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={discountRupees || ''}
                  onChange={(e) => setDiscountRupees(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-right text-xs focus:border-[#6E1D1D] outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 text-slate-600">
              <span>Additional Charges (+):</span>
              <div className="flex items-center gap-1 w-32">
                <span className="text-slate-400">₹</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={additionalChargesRupees || ''}
                  onChange={(e) => setAdditionalChargesRupees(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-right text-xs focus:border-[#6E1D1D] outline-none"
                />
              </div>
            </div>

            <div className="flex justify-between border-t border-slate-200 pt-2 text-slate-700 font-medium">
              <span>Taxable Value:</span>
              <span>
                ₹{calculations.taxableRupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex justify-between text-slate-600">
              <span>Total GST / Tax (+):</span>
              <span className="font-semibold text-slate-900">
                ₹{calculations.taxAmountRupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 text-slate-600">
              <span>TCS (+):</span>
              <div className="flex items-center gap-1 w-32">
                <span className="text-slate-400">₹</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={tcsRupees || ''}
                  onChange={(e) => setTcsRupees(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-right text-xs focus:border-[#6E1D1D] outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 text-slate-600">
              <span>Round Off:</span>
              <div className="flex items-center gap-1 w-32">
                <span className="text-slate-400">₹</span>
                <input
                  type="number"
                  step="any"
                  value={roundOffRupees || ''}
                  onChange={(e) => setRoundOffRupees(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-right text-xs focus:border-[#6E1D1D] outline-none"
                />
              </div>
            </div>

            <div className="flex justify-between border-t-2 border-slate-300 pt-3 text-sm font-bold text-[#6E1D1D]">
              <span>Total Invoice Amount:</span>
              <span className="text-base">
                ₹{calculations.grandTotalRupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      </form>

      {/* Bank Account Creation Modal */}
      {bankModalOpen && (
        <BankAccountModal
          isOpen={bankModalOpen}
          onClose={() => setBankModalOpen(false)}
          onSuccess={(newAcc) => {
            fetchBankAccounts();
            setSelectedBankAccountId(newAcc.id);
            setBankName(newAcc.bankName);
            setAccountHolderName(newAcc.accountHolderName);
            setAccountNumber(newAcc.accountNumber);
            setIfsc(newAcc.ifsc);
            setBranch(newAcc.branch);
          }}
        />
      )}
    </>
  );
}
