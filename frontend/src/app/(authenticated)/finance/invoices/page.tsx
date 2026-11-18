'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { RequireAuth } from '@/shared/auth/require-auth';
import { useAuth } from '@/shared/auth/auth-context';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Download,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  DollarSign,
  Copy,
  History,
  ChevronDown,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Building2,
  CreditCard,
  ExternalLink,
  X,
} from 'lucide-react';
import { invoicesApi } from '@/modules/finance/api';
import type { Invoice, InvoiceEditLog } from '@/modules/finance/types';
import { formatCurrency, formatDate } from '@/modules/finance/utils/formatters';
import { InvoiceEditHistoryModal } from '@/modules/finance/components/InvoiceEditHistoryModal';
import QuotationForm from '@/modules/quotations/components/QuotationForm';
import PurchaseOrderForm from '@/modules/purchase-orders/components/PurchaseOrderForm';
import { quotationsApi } from '@/modules/quotations/api';
import {
  createPurchaseOrder,
  getPurchaseOrders,
  issuePurchaseOrder,
  updatePurchaseOrder,
} from '@/modules/purchase-orders/api';
import { getVendorName, getCampaignName } from '@/modules/purchase-orders/format';
import type { PurchaseOrder, PurchaseOrderFormData } from '@/modules/purchase-orders/types';
import type { Quotation } from '@/modules/quotations/types';

type InvoiceTab = 'sales' | 'proforma' | 'quotations' | 'purchase_orders';

function InvoicesManagementContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, hasPermission } = useAuth();

  // RBAC Permission checks for document creation
  const canCreateInvoice = hasPermission('finance.manage') || user?.role === 'finance' || user?.role === 'admin';
  const canCreateQuotation = hasPermission('quotations.create') || user?.role === 'finance' || user?.role === 'admin';
  const canCreatePO = hasPermission('purchase_orders.manage') || user?.role === 'finance' || user?.role === 'admin';
  const hasAnyCreationPermission = canCreateInvoice || canCreateQuotation || canCreatePO;

  const creationOptionsCount = 4;

  const tabParam = searchParams.get('tab');
  const initialTab: InvoiceTab =
    tabParam === 'proforma'
      ? 'proforma'
      : tabParam === 'quotations'
      ? 'quotations'
      : tabParam === 'purchase_orders' || tabParam === 'purchase-orders'
      ? 'purchase_orders'
      : 'sales';

  const [activeTab, setActiveTab] = useState<InvoiceTab>(initialTab);

  // Invoices data state
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [totalStats, setTotalStats] = useState({
    totalAmount: 0,
    totalReceived: 0,
    totalBalance: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);

  // Quotations data state (fetched from existing Quotations module)
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loadingQuotations, setLoadingQuotations] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Quotation | null>(null);

  // Purchase Orders data state (fetched from existing Operations/Purchase Orders module)
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loadingPO, setLoadingPO] = useState(false);
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null);

  // Tab badge counters
  const [salesCount, setSalesCount] = useState(0);
  const [proformaCount, setProformaCount] = useState(0);
  const [quotationsCount, setQuotationsCount] = useState(0);
  const [poCount, setPoCount] = useState(0);

  // Filter & Pagination state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Dropdown create menu state
  const [createDropdownOpen, setCreateDropdownOpen] = useState(false);

  // Reused Creation Form State
  const [activeCreationForm, setActiveCreationForm] = useState<'quotation' | 'purchase_order' | null>(null);
  const [savingPO, setSavingPO] = useState(false);
  const [creationNotification, setCreationNotification] = useState<{
    type: 'quotation' | 'purchase_order';
    title: string;
    message: string;
    viewHref: string;
    docNumber?: string;
  } | null>(null);

  // History modal state
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState<InvoiceEditLog[]>([]);
  const [historyInvoiceNum, setHistoryInvoiceNum] = useState('');

  // Sync URL action parameter (e.g. ?action=create-quotation or ?action=create-po)
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'create-quotation' && canCreateQuotation) {
      setEditingQuote(null);
      setActiveCreationForm('quotation');
    } else if (action === 'create-po' && canCreatePO) {
      setEditingPO(null);
      setActiveCreationForm('purchase_order');
    }
  }, [searchParams, canCreateQuotation, canCreatePO]);

  // Initial tab badge counts loader
  useEffect(() => {
    invoicesApi
      .getInvoices({ type: 'sales_invoice', pageSize: 1 })
      .then((res) => setSalesCount(res.total || 0))
      .catch(() => {});

    invoicesApi
      .getInvoices({ type: 'proforma', pageSize: 1 })
      .then((res) => setProformaCount(res.total || 0))
      .catch(() => {});

    quotationsApi
      .list({ limit: 1 })
      .then((res) => setQuotationsCount(res.meta?.total || (res.quotations ? res.quotations.length : 0)))
      .catch(() => {});

    getPurchaseOrders()
      .then((res) => setPoCount(res.data ? res.data.length : 0))
      .catch(() => {});
  }, []);

  const handleCloseCreationForm = () => {
    setActiveCreationForm(null);
    setEditingQuote(null);
    setEditingPO(null);
    const params = new URLSearchParams(searchParams.toString());
    if (params.has('action')) {
      params.delete('action');
      const queryStr = params.toString() ? `?${params.toString()}` : '';
      router.replace(`/finance/invoices${queryStr}`);
    }
  };

  const handleQuotationSuccess = (savedQuote: Quotation) => {
    handleCloseCreationForm();
    handleTabChange('quotations');
    fetchQuotations();
    setCreationNotification({
      type: 'quotation',
      title: 'Quotation Proposal Created',
      message: `Quotation proposal ${savedQuote.quoteNumber || ''} saved successfully from Invoices.`,
      viewHref: `/quotations?id=${savedQuote._id || savedQuote.id}&step=3`,
      docNumber: savedQuote.quoteNumber,
    });
  };

  const handlePOSuccess = (savedOrder?: any) => {
    handleCloseCreationForm();
    handleTabChange('purchase_orders');
    fetchPurchaseOrders();
    const poNum = savedOrder?.poNumber || '';
    const poId = savedOrder?._id || '';
    setCreationNotification({
      type: 'purchase_order',
      title: 'Purchase Order Created',
      message: `Purchase Order ${poNum} saved successfully from Invoices.`,
      viewHref: poId ? `/purchase-orders?id=${poId}&step=3` : '/purchase-orders',
      docNumber: poNum,
    });
  };

  const handlePOSubmit = async (
    data: PurchaseOrderFormData,
    issueImmediately?: boolean,
  ): Promise<PurchaseOrder | boolean | null> => {
    setSavingPO(true);
    try {
      let order: PurchaseOrder | null = null;
      if (editingPO?._id) {
        const res = await updatePurchaseOrder(editingPO._id, data);
        order = res.data;
      } else {
        const res = await createPurchaseOrder(data);
        order = res.data;
      }
      if (issueImmediately && order?._id) {
        try {
          const issueRes = await issuePurchaseOrder(order._id);
          if (issueRes?.data) {
            order = issueRes.data;
          }
        } catch (issueErr) {
          console.error('Failed to issue purchase order:', issueErr);
        }
      }
      return order;
    } catch (err: any) {
      console.error('Failed to save purchase order:', err);
      alert(err?.message || 'Failed to save purchase order');
      return null;
    } finally {
      setSavingPO(false);
    }
  };

  // Synchronize tab state with URL parameter
  const handleTabChange = (tab: InvoiceTab) => {
    setActiveTab(tab);
    setPage(1);
    setStatusFilter('all');
    setSearch('');
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.replace(`/finance/invoices?${params.toString()}`);
  };

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const type = activeTab === 'proforma' ? 'proforma' : 'sales_invoice';
      const res = await invoicesApi.getInvoices({
        type,
        status: statusFilter,
        search: search.trim() || undefined,
        page,
        pageSize: 20,
      });

      setInvoices(res.invoices || []);
      setTotalStats({
        totalAmount: res.totalAmount || 0,
        totalReceived: res.totalReceived || 0,
        totalBalance: res.totalBalance || 0,
        total: res.total || 0,
      });
      setTotalPages(res.totalPages || 1);

      if (activeTab === 'sales') {
        setSalesCount(res.total || 0);
      } else if (activeTab === 'proforma') {
        setProformaCount(res.total || 0);
      }
    } catch (err) {
      console.error('Failed to load invoices:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, statusFilter, search, page]);

  const fetchQuotations = useCallback(async () => {
    setLoadingQuotations(true);
    try {
      const res = await quotationsApi.list({ limit: 200 });
      const list = res.quotations || [];
      setQuotations(list);
      setQuotationsCount(res.meta?.total || list.length);
    } catch (err) {
      console.error('Failed to load quotations:', err);
    } finally {
      setLoadingQuotations(false);
    }
  }, []);

  const fetchPurchaseOrders = useCallback(async () => {
    setLoadingPO(true);
    try {
      const res = await getPurchaseOrders();
      const list = res.data || [];
      setPurchaseOrders(list);
      setPoCount(list.length);
    } catch (err) {
      console.error('Failed to load purchase orders:', err);
    } finally {
      setLoadingPO(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'sales' || activeTab === 'proforma') {
      fetchInvoices();
    } else if (activeTab === 'quotations') {
      fetchQuotations();
    } else if (activeTab === 'purchase_orders') {
      fetchPurchaseOrders();
    }
  }, [activeTab, fetchInvoices, fetchQuotations, fetchPurchaseOrders]);

  // Quotations Filter & Pagination
  const filteredQuotations = useMemo(() => {
    const term = search.trim().toLowerCase();
    return quotations.filter((q) => {
      const clientName = (
        q.clientName ||
        (typeof q.leadId === 'object' ? q.leadId?.companyName : '') ||
        ''
      ).toLowerCase();
      const contactPerson = (
        q.clientContactPerson ||
        (typeof q.leadId === 'object' ? q.leadId?.contactPerson : '') ||
        ''
      ).toLowerCase();
      const quoteNo = (q.quoteNumber || '').toLowerCase();
      const city = (q.clientCity || '').toLowerCase();

      const matchSearch =
        !term ||
        quoteNo.includes(term) ||
        clientName.includes(term) ||
        contactPerson.includes(term) ||
        city.includes(term);

      if (!matchSearch) return false;
      if (statusFilter !== 'all' && q.status !== statusFilter) return false;
      return true;
    });
  }, [quotations, search, statusFilter]);

  const totalQuotationPages = Math.max(1, Math.ceil(filteredQuotations.length / 20));
  const paginatedQuotations = useMemo(() => {
    const startIndex = (page - 1) * 20;
    return filteredQuotations.slice(startIndex, startIndex + 20);
  }, [filteredQuotations, page]);

  const quotationMetrics = useMemo(() => {
    const totalCount = quotations.length;
    const totalPipeline = quotations.reduce(
      (sum, q) => sum + (q.total || q.subtotal || 0) / 100,
      0,
    );
    const acceptedQuotes = quotations.filter((q) => q.status === 'Accepted');
    const totalAccepted = acceptedQuotes.reduce(
      (sum, q) => sum + (q.total || q.subtotal || 0) / 100,
      0,
    );
    const pendingQuotes = quotations.filter((q) => q.status === 'Sent');
    const totalPending = pendingQuotes.reduce(
      (sum, q) => sum + (q.total || q.subtotal || 0) / 100,
      0,
    );
    const winRate =
      totalCount > 0 ? Math.round((acceptedQuotes.length / totalCount) * 100) : 0;

    return {
      totalCount,
      totalPipeline,
      totalAccepted,
      acceptedCount: acceptedQuotes.length,
      totalPending,
      pendingCount: pendingQuotes.length,
      winRate,
    };
  }, [quotations]);

  // Purchase Orders Filter & Pagination
  const filteredPOs = useMemo(() => {
    const term = search.trim().toLowerCase();
    return purchaseOrders.filter((po) => {
      const poNum = (po.poNumber || '').toLowerCase();
      const vendorName = getVendorName(po.vendorId, po.vendorName).toLowerCase();
      const campaignName = getCampaignName(po.campaignId, po.campaignName).toLowerCase();
      const city = (po.city || '').toLowerCase();

      const matchSearch =
        !term ||
        poNum.includes(term) ||
        vendorName.includes(term) ||
        campaignName.includes(term) ||
        city.includes(term);

      if (!matchSearch) return false;
      if (statusFilter !== 'all' && po.status !== statusFilter) return false;
      return true;
    });
  }, [purchaseOrders, search, statusFilter]);

  const totalPOPages = Math.max(1, Math.ceil(filteredPOs.length / 20));
  const paginatedPOs = useMemo(() => {
    const startIndex = (page - 1) * 20;
    return filteredPOs.slice(startIndex, startIndex + 20);
  }, [filteredPOs, page]);

  const poMetrics = useMemo(() => {
    const totalCount = purchaseOrders.length;
    const totalSpend = purchaseOrders.reduce(
      (sum, po) => sum + (po.totalAmount || po.negotiatedRate || 0),
      0,
    );
    const totalPaid = purchaseOrders.reduce(
      (sum, po) => sum + (po.paidAmount || 0),
      0,
    );
    const totalBalance = Math.max(0, totalSpend - totalPaid);
    const activeCount = purchaseOrders.filter(
      (po) => po.status === 'Issued' || po.status === 'Accepted',
    ).length;
    const settlementRate =
      totalSpend > 0 ? Math.round((totalPaid / totalSpend) * 100) : 0;

    return {
      totalCount,
      totalSpend,
      totalPaid,
      totalBalance,
      activeCount,
      settlementRate,
    };
  }, [purchaseOrders]);

  const handleDuplicate = async (id: string) => {
    try {
      await invoicesApi.duplicateInvoice(id);
      fetchInvoices();
    } catch (err) {
      console.error('Failed to duplicate invoice:', err);
    }
  };

  const handleConvertToSalesInvoice = async (id: string) => {
    try {
      const res = await invoicesApi.convertToSalesInvoice(id);
      if (res.invoice?.id) {
        handleTabChange('sales');
        fetchInvoices();
      }
    } catch (err: any) {
      console.error('Failed to convert proforma:', err);
      alert(err?.message || 'Failed to convert proforma invoice');
    }
  };

  const handleDelete = async (id: string, invoiceNumber: string) => {
    if (confirm(`Are you sure you want to soft-delete invoice ${invoiceNumber}?`)) {
      try {
        await invoicesApi.deleteInvoice(id);
        fetchInvoices();
      } catch (err: any) {
        alert(err?.message || 'Failed to delete invoice');
      }
    }
  };

  const openHistory = (invoice: Invoice) => {
    setHistoryInvoiceNum(invoice.invoiceNumber);
    setHistoryItems(invoice.editHistory || []);
    setHistoryModalOpen(true);
  };

  const handleDownloadQuotationPdf = async (quote: Quotation) => {
    const qId = quote._id || quote.id;
    try {
      const res = await quotationsApi.getPdfUrl(qId);
      if (res?.pdfUrl) {
        window.open(res.pdfUrl, '_blank');
      } else {
        router.push(`/quotations?id=${qId}&step=4`);
      }
    } catch {
      router.push(`/quotations?id=${qId}&step=4`);
    }
  };

  // Render active creation form if triggered
  if (activeCreationForm === 'quotation') {
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-16">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCloseCreationForm}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Invoices</span>
            </button>
            <div className="h-4 w-px bg-slate-200 hidden sm:block" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">
                  {editingQuote ? 'Edit Quotation Proposal' : 'Create Quotation Proposal'}
                </h2>
                <span className="rounded-full bg-[#F8E6E6] px-2.5 py-0.5 text-[10px] font-bold text-[#6E1D1D] border border-[#F0C7C7]">
                  Sales Module
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Generate branded proposals with inventory selection and live GST calculation
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCloseCreationForm}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 self-end sm:self-center"
          >
            Cancel
          </button>
        </div>

        <QuotationForm
          initialQuote={editingQuote}
          onBack={handleCloseCreationForm}
          onSuccess={handleQuotationSuccess}
        />
      </div>
    );
  }

  if (activeCreationForm === 'purchase_order') {
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-16">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCloseCreationForm}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Invoices</span>
            </button>
            <div className="h-4 w-px bg-slate-200 hidden sm:block" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">
                  {editingPO ? 'Edit Purchase Order' : 'Create Purchase Order'}
                </h2>
                <span className="rounded-full bg-[#F8E6E6] px-2.5 py-0.5 text-[10px] font-bold text-[#6E1D1D] border border-[#F0C7C7]">
                  Operations Module
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Procurement purchase order with vendor details, line items, and payment terms
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCloseCreationForm}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 self-end sm:self-center"
          >
            Cancel
          </button>
        </div>

        <PurchaseOrderForm
          order={editingPO}
          saving={savingPO}
          onBack={handleCloseCreationForm}
          onClose={handleCloseCreationForm}
          onSubmit={handlePOSubmit}
          onSuccess={handlePOSuccess}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Creation Success Banner */}
      {creationNotification && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0" />
            <span>{creationNotification.message}</span>
            {creationNotification.viewHref && (
              <Link
                href={creationNotification.viewHref}
                className="ml-2 underline font-bold text-emerald-900 hover:text-emerald-700 inline-flex items-center gap-1"
              >
                View Document <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
          <button
            type="button"
            onClick={() => setCreationNotification(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header with Title and Create Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Invoices</h1>
          <p className="text-xs text-slate-500 mt-1">
            Unified billing management for Tax Invoices, Proforma Invoices, Quotations, and Purchase Orders with live tracking.
          </p>
        </div>

        {/* Create Document Split/Dropdown Button */}
        {hasAnyCreationPermission && (
          <div className="relative">
            <div className="inline-flex rounded-lg shadow-sm">
              {activeTab === 'quotations' ? (
                canCreateQuotation ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingQuote(null);
                      setActiveCreationForm('quotation');
                    }}
                    className="inline-flex items-center gap-2 rounded-l-lg bg-[#6E1D1D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#581717] transition-all cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    Create Quotation
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-l-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Read-Only Access
                  </span>
                )
              ) : activeTab === 'purchase_orders' ? (
                canCreatePO ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPO(null);
                      setActiveCreationForm('purchase_order');
                    }}
                    className="inline-flex items-center gap-2 rounded-l-lg bg-[#6E1D1D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#581717] transition-all cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    Create Purchase Order
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-l-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Read-Only Access
                  </span>
                )
              ) : activeTab === 'proforma' ? (
                <Link
                  href="/finance/invoices/new?type=proforma"
                  className="inline-flex items-center gap-2 rounded-l-lg bg-[#6E1D1D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#581717] transition-all"
                >
                  <Plus className="h-4 w-4" />
                  Create Proforma Invoice
                </Link>
              ) : (
                <Link
                  href="/finance/invoices/new"
                  className="inline-flex items-center gap-2 rounded-l-lg bg-[#6E1D1D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#581717] transition-all"
                >
                  <Plus className="h-4 w-4" />
                  Create Sales Invoice
                </Link>
              )}

              <button
                type="button"
                onClick={() => setCreateDropdownOpen((prev) => !prev)}
                className="inline-flex items-center rounded-r-lg bg-[#581717] px-2.5 py-2 text-xs font-semibold text-white hover:bg-[#481212] transition-colors border-l border-white/20 cursor-pointer"
                title="More creation options"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>

            {createDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setCreateDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-1 z-30 w-64 rounded-xl bg-white p-1.5 shadow-xl border border-slate-200 text-xs">
                  {canCreateInvoice && (
                    <>
                      <Link
                        href="/finance/invoices/new"
                        onClick={() => setCreateDropdownOpen(false)}
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-slate-700 hover:bg-[#F8E6E6] hover:text-[#6E1D1D] transition-colors"
                      >
                        <FileText className="h-4 w-4 text-[#6E1D1D] flex-shrink-0" />
                        <div>
                          <p className="font-semibold">Create Sales Invoice</p>
                          <p className="text-[10px] text-slate-500">Tax Invoice for client billing & GST</p>
                        </div>
                      </Link>
                      <Link
                        href="/finance/invoices/new?type=proforma"
                        onClick={() => setCreateDropdownOpen(false)}
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-slate-700 hover:bg-[#F8E6E6] hover:text-[#6E1D1D] transition-colors"
                      >
                        <FileText className="h-4 w-4 text-slate-500 flex-shrink-0" />
                        <div>
                          <p className="font-semibold">Create Proforma Invoice</p>
                          <p className="text-[10px] text-slate-500">Estimate / Quote for approval</p>
                        </div>
                      </Link>
                    </>
                  )}

                  {canCreateQuotation && (
                    <button
                      type="button"
                      onClick={() => {
                        setCreateDropdownOpen(false);
                        setEditingQuote(null);
                        setActiveCreationForm('quotation');
                      }}
                      className="w-full text-left flex items-center gap-2.5 rounded-lg px-3 py-2 text-slate-700 hover:bg-[#F8E6E6] hover:text-[#6E1D1D] transition-colors cursor-pointer"
                    >
                      <Sparkles className="h-4 w-4 text-amber-600 flex-shrink-0" />
                      <div>
                        <p className="font-semibold">Create Quotation</p>
                        <p className="text-[10px] text-slate-500">Sales proposal with inventory</p>
                      </div>
                    </button>
                  )}

                  {canCreatePO && (
                    <button
                      type="button"
                      onClick={() => {
                        setCreateDropdownOpen(false);
                        setEditingPO(null);
                        setActiveCreationForm('purchase_order');
                      }}
                      className="w-full text-left flex items-center gap-2.5 rounded-lg px-3 py-2 text-slate-700 hover:bg-[#F8E6E6] hover:text-[#6E1D1D] transition-colors cursor-pointer"
                    >
                      <Building2 className="h-4 w-4 text-rose-700 flex-shrink-0" />
                      <div>
                        <p className="font-semibold">Create Purchase Order</p>
                        <p className="text-[10px] text-slate-500">Procurement order for vendors</p>
                      </div>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 overflow-x-auto">
        <button
          type="button"
          onClick={() => handleTabChange('sales')}
          className={`flex items-center gap-2 px-6 py-3 text-xs font-bold transition-all border-b-2 -mb-px whitespace-nowrap ${
            activeTab === 'sales'
              ? 'border-[#6E1D1D] text-[#6E1D1D] bg-[#F8E6E6]/40'
              : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Sales Invoices</span>
          {salesCount > 0 && (
            <span className="ml-1.5 rounded-full bg-[#6E1D1D] px-2 py-0.5 text-[10px] text-white">
              {salesCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('proforma')}
          className={`flex items-center gap-2 px-6 py-3 text-xs font-bold transition-all border-b-2 -mb-px whitespace-nowrap ${
            activeTab === 'proforma'
              ? 'border-[#6E1D1D] text-[#6E1D1D] bg-[#F8E6E6]/40'
              : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Proforma Invoices</span>
          {proformaCount > 0 && (
            <span className="ml-1.5 rounded-full bg-[#6E1D1D] px-2 py-0.5 text-[10px] text-white">
              {proformaCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('quotations')}
          className={`flex items-center gap-2 px-6 py-3 text-xs font-bold transition-all border-b-2 -mb-px whitespace-nowrap ${
            activeTab === 'quotations'
              ? 'border-[#6E1D1D] text-[#6E1D1D] bg-[#F8E6E6]/40'
              : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Sparkles className="h-4 w-4" />
          <span>Quotations</span>
          {quotationsCount > 0 && (
            <span className="ml-1.5 rounded-full bg-[#6E1D1D] px-2 py-0.5 text-[10px] text-white">
              {quotationsCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('purchase_orders')}
          className={`flex items-center gap-2 px-6 py-3 text-xs font-bold transition-all border-b-2 -mb-px whitespace-nowrap ${
            activeTab === 'purchase_orders'
              ? 'border-[#6E1D1D] text-[#6E1D1D] bg-[#F8E6E6]/40'
              : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Building2 className="h-4 w-4" />
          <span>Purchase Orders</span>
          {poCount > 0 && (
            <span className="ml-1.5 rounded-full bg-[#6E1D1D] px-2 py-0.5 text-[10px] text-white">
              {poCount}
            </span>
          )}
        </button>
      </div>

      {/* Dynamic Summary Cards */}
      {activeTab === 'sales' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Total Billed</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                <FileText className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 text-xl font-bold text-slate-900">{formatCurrency(totalStats.totalAmount)}</p>
            <p className="mt-1 text-[11px] text-slate-400">across {totalStats.total} sales invoices</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Received In</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <CheckCircle className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 text-xl font-bold text-emerald-600">{formatCurrency(totalStats.totalReceived)}</p>
            <p className="mt-1 text-[11px] text-emerald-600 font-medium">collected & settled</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Outstanding Balance</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <Clock className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 text-xl font-bold text-[#6E1D1D]">{formatCurrency(totalStats.totalBalance)}</p>
            <p className="mt-1 text-[11px] text-amber-600 font-medium">pending receivable</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Recovery Rate</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                <TrendingUp className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 text-xl font-bold text-slate-900">
              {totalStats.totalAmount > 0
                ? `${Math.round((totalStats.totalReceived / totalStats.totalAmount) * 100)}%`
                : '100%'}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">settlement ratio</p>
          </div>
        </div>
      ) : activeTab === 'proforma' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Total Proforma Value</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                <FileText className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 text-xl font-bold text-slate-900">{formatCurrency(totalStats.totalAmount)}</p>
            <p className="mt-1 text-[11px] text-slate-400">{totalStats.total} proforma estimates</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Active Proposals</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                <Clock className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 text-xl font-bold text-blue-600">{totalStats.total}</p>
            <p className="mt-1 text-[11px] text-slate-400">ready for conversion</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Quick Workflow</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
                <ArrowRight className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-700 font-medium">1-Click Convert to Tax Invoice</p>
            <p className="mt-1 text-[11px] text-slate-400">converts proforma to live invoice</p>
          </div>
        </div>
      ) : activeTab === 'quotations' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Total Pipeline Value</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                <CreditCard className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 text-xl font-bold text-slate-900">{formatCurrency(quotationMetrics.totalPipeline)}</p>
            <p className="mt-1 text-[11px] text-slate-400">across {quotationMetrics.totalCount} quotation proposals</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Won & Accepted</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <CheckCircle className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 text-xl font-bold text-emerald-600">{formatCurrency(quotationMetrics.totalAccepted)}</p>
            <p className="mt-1 text-[11px] text-emerald-600 font-medium">{quotationMetrics.acceptedCount} deals won</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Pending Decision</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <Clock className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 text-xl font-bold text-[#6E1D1D]">{formatCurrency(quotationMetrics.totalPending)}</p>
            <p className="mt-1 text-[11px] text-amber-600 font-medium">{quotationMetrics.pendingCount} awaiting approval</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Win Rate</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                <TrendingUp className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 text-xl font-bold text-slate-900">{quotationMetrics.winRate}%</p>
            <p className="mt-1 text-[11px] text-slate-400">proposal conversion</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Total Committed Spend</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                <Building2 className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 text-xl font-bold text-slate-900">{formatCurrency(poMetrics.totalSpend)}</p>
            <p className="mt-1 text-[11px] text-slate-400">across {poMetrics.totalCount} purchase orders</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Disbursed / Paid</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <CheckCircle className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 text-xl font-bold text-emerald-600">{formatCurrency(poMetrics.totalPaid)}</p>
            <p className="mt-1 text-[11px] text-emerald-600 font-medium">vendor payouts settled</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Pending Balance</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <Clock className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 text-xl font-bold text-[#6E1D1D]">{formatCurrency(poMetrics.totalBalance)}</p>
            <p className="mt-1 text-[11px] text-amber-600 font-medium">pending vendor settlement</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Active Procurements</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                <TrendingUp className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 text-xl font-bold text-slate-900">{poMetrics.activeCount}</p>
            <p className="mt-1 text-[11px] text-slate-400">issued &amp; accepted orders</p>
          </div>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder={
              activeTab === 'sales'
                ? 'Search by invoice #, party, or GSTIN...'
                : activeTab === 'proforma'
                ? 'Search by proforma #, party...'
                : activeTab === 'quotations'
                ? 'Search by quote #, client, contact, city...'
                : 'Search by PO #, vendor, campaign, city...'
            }
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-1.5 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#6E1D1D] focus:bg-white focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-[#6E1D1D] focus:outline-none"
          >
            <option value="all">All Statuses</option>
            {activeTab === 'sales' ? (
              <>
                <option value="Draft">Draft</option>
                <option value="Sent">Sent</option>
                <option value="Partially Paid">Partially Paid</option>
                <option value="Paid">Paid</option>
                <option value="Overdue">Overdue</option>
                <option value="Cancelled">Cancelled</option>
              </>
            ) : activeTab === 'proforma' ? (
              <>
                <option value="Draft">Draft</option>
                <option value="Sent">Sent</option>
                <option value="Accepted">Accepted</option>
                <option value="Rejected">Rejected</option>
                <option value="Cancelled">Cancelled</option>
              </>
            ) : activeTab === 'quotations' ? (
              <>
                <option value="Draft">Draft</option>
                <option value="Sent">Sent</option>
                <option value="Accepted">Accepted</option>
                <option value="Rejected">Rejected</option>
                <option value="Expired">Expired</option>
              </>
            ) : (
              <>
                <option value="Draft">Draft</option>
                <option value="Issued">Issued</option>
                <option value="Accepted">Accepted</option>
                <option value="Cancelled">Cancelled</option>
              </>
            )}
          </select>
        </div>
      </div>

      {/* Sales & Proforma Invoices Table */}
      {(activeTab === 'sales' || activeTab === 'proforma') && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-500">Loading invoice ledger...</div>
          ) : invoices.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <FileText className="h-8 w-8 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">
                No {activeTab === 'proforma' ? 'proforma' : 'sales'} invoices found
              </p>
              <p className="text-xs text-slate-400">
                {search || statusFilter !== 'all'
                  ? 'Try adjusting your search terms or filter.'
                  : 'Create your first invoice to get started.'}
              </p>
              {canCreateInvoice && (
                <Link
                  href={activeTab === 'proforma' ? '/finance/invoices/new?type=proforma' : '/finance/invoices/new'}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#6E1D1D] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#581717]"
                >
                  <Plus className="h-4 w-4" />
                  {activeTab === 'proforma' ? 'Create Proforma Invoice' : 'Create Sales Invoice'}
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                    <th className="py-3 px-3 w-10 text-center">#</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Invoice Number</th>
                    <th className="py-3 px-3">Party Name</th>
                    <th className="py-3 px-3">Due Date</th>
                    <th className="py-3 px-3 text-right">Total Amount</th>
                    {activeTab === 'sales' && (
                      <>
                        <th className="py-3 px-3 text-right">Received</th>
                        <th className="py-3 px-3 text-right">Balance</th>
                      </>
                    )}
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.map((inv, idx) => (
                    <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-3 text-center text-slate-400">
                        {(page - 1) * 20 + idx + 1}
                      </td>
                      <td className="py-3 px-3 text-slate-600 font-medium">
                        {formatDate(inv.invoiceDate)}
                      </td>
                      <td className="py-3 px-3">
                        <Link
                          href={`/finance/invoices/${inv.id}`}
                          className="font-bold text-[#6E1D1D] hover:underline font-mono"
                        >
                          {inv.invoiceNumber}
                        </Link>
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-semibold text-slate-900">{inv.partyName}</p>
                        {inv.gstin && <p className="text-[10px] text-slate-400 font-mono">GST: {inv.gstin}</p>}
                      </td>
                      <td className="py-3 px-3 text-slate-500">{formatDate(inv.dueDate)}</td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900">
                        {formatCurrency(inv.totalAmount)}
                      </td>
                      {activeTab === 'sales' && (
                        <>
                          <td className="py-3 px-3 text-right font-semibold text-emerald-600">
                            {formatCurrency(inv.amountReceived)}
                          </td>
                          <td className="py-3 px-3 text-right font-bold">
                            <span className={inv.balanceAmount > 0 ? 'text-[#6E1D1D]' : 'text-slate-400'}>
                              {formatCurrency(inv.balanceAmount)}
                            </span>
                          </td>
                        </>
                      )}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            inv.status === 'Paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : inv.status === 'Partially Paid'
                              ? 'bg-amber-100 text-amber-800'
                              : inv.status === 'Overdue'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* View */}
                          <Link
                            href={`/finance/invoices/${inv.id}`}
                            className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
                            title="View Invoice"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>

                          {/* Convert to Sales Invoice (for proforma) */}
                          {activeTab === 'proforma' && (
                            <button
                              type="button"
                              onClick={() => handleConvertToSalesInvoice(inv.id)}
                              className="p-1 text-[#6E1D1D] hover:bg-[#F8E6E6] rounded"
                              title="Convert to Sales Tax Invoice"
                            >
                              <ArrowRight className="h-4 w-4" />
                            </button>
                          )}

                          {/* Edit */}
                          <Link
                            href={`/finance/invoices/${inv.id}/edit`}
                            className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </Link>

                          {/* History */}
                          <button
                            type="button"
                            onClick={() => openHistory(inv)}
                            className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
                            title="Audit Trail"
                          >
                            <History className="h-4 w-4" />
                          </button>

                          {/* Duplicate */}
                          <button
                            type="button"
                            onClick={() => handleDuplicate(inv.id)}
                            className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
                            title="Duplicate"
                          >
                            <Copy className="h-4 w-4" />
                          </button>

                          {/* Download PDF */}
                          <a
                            href={invoicesApi.getPdfDownloadUrl(inv.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
                            title="Download PDF"
                          >
                            <Download className="h-4 w-4" />
                          </a>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => handleDelete(inv.id, inv.invoiceNumber)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-slate-100"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination footer */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 bg-slate-50 text-xs">
              <span className="text-slate-500">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1 rounded border border-slate-200 bg-white text-slate-700 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-2.5 py-1 rounded border border-slate-200 bg-white text-slate-700 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quotations Table */}
      {activeTab === 'quotations' && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
          {loadingQuotations ? (
            <div className="py-16 text-center text-xs text-slate-500">Loading quotation proposals...</div>
          ) : paginatedQuotations.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <Sparkles className="h-8 w-8 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">No quotation proposals found</p>
              <p className="text-xs text-slate-400">
                {search || statusFilter !== 'all'
                  ? 'Try adjusting your search terms or filter.'
                  : 'Create your first quotation proposal to get started.'}
              </p>
              {canCreateQuotation && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingQuote(null);
                    setActiveCreationForm('quotation');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#6E1D1D] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#581717]"
                >
                  <Plus className="h-4 w-4" />
                  Create Quotation
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                    <th className="py-3 px-3 w-10 text-center">#</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Quote Number</th>
                    <th className="py-3 px-3">Client / Party Name</th>
                    <th className="py-3 px-3">Valid Until</th>
                    <th className="py-3 px-3 text-right">Total Amount</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedQuotations.map((quote, idx) => {
                    const clientName =
                      quote.clientName ||
                      (typeof quote.leadId === 'object' ? quote.leadId?.companyName : '') ||
                      'Unnamed Client';
                    const contact =
                      quote.clientContactPerson ||
                      (typeof quote.leadId === 'object' ? quote.leadId?.contactPerson : '');
                    const qId = quote._id || quote.id;
                    const totalVal = (quote.total || quote.subtotal || 0) / 100;

                    return (
                      <tr key={qId || idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-3 text-center text-slate-400">
                          {(page - 1) * 20 + idx + 1}
                        </td>
                        <td className="py-3 px-3 text-slate-600 font-medium">
                          {formatDate(quote.createdAt)}
                        </td>
                        <td className="py-3 px-3">
                          <Link
                            href={`/quotations?id=${qId}&step=3`}
                            className="font-bold text-[#6E1D1D] hover:underline font-mono"
                          >
                            {quote.quoteNumber || 'Draft Quote'}
                          </Link>
                        </td>
                        <td className="py-3 px-3">
                          <p className="font-semibold text-slate-900">{clientName}</p>
                          {(quote.clientCity || contact) && (
                            <p className="text-[10px] text-slate-400">
                              {[contact, quote.clientCity].filter(Boolean).join(' • ')}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-500">{formatDate(quote.validUntil)}</td>
                        <td className="py-3 px-3 text-right font-bold text-slate-900">
                          {formatCurrency(totalVal)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              quote.status === 'Accepted'
                                ? 'bg-emerald-100 text-emerald-800'
                                : quote.status === 'Sent'
                                ? 'bg-blue-100 text-blue-800'
                                : quote.status === 'Rejected'
                                ? 'bg-rose-100 text-rose-800'
                                : quote.status === 'Expired'
                                ? 'bg-slate-100 text-slate-700'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {quote.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* View in Sales */}
                            <Link
                              href={`/quotations?id=${qId}&step=3`}
                              className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
                              title="View Quotation Details"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>

                            {/* Edit */}
                            {canCreateQuotation && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingQuote(quote);
                                  setActiveCreationForm('quotation');
                                }}
                                className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
                                title="Edit Quotation"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                            )}

                            {/* Download PDF */}
                            <button
                              type="button"
                              onClick={() => handleDownloadQuotationPdf(quote)}
                              className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
                              title="Download Quotation PDF"
                            >
                              <Download className="h-4 w-4" />
                            </button>

                            {/* Open Proposal Center in Sales */}
                            <Link
                              href={`/quotations?id=${qId}&step=1`}
                              className="p-1 text-slate-400 hover:text-[#6E1D1D] rounded hover:bg-[#F8E6E6]"
                              title="Open in Sales Proposal Center"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Quotation Pagination */}
          {totalQuotationPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 bg-slate-50 text-xs">
              <span className="text-slate-500">
                Page {page} of {totalQuotationPages} ({filteredQuotations.length} total)
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1 rounded border border-slate-200 bg-white text-slate-700 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalQuotationPages}
                  onClick={() => setPage((p) => Math.min(totalQuotationPages, p + 1))}
                  className="px-2.5 py-1 rounded border border-slate-200 bg-white text-slate-700 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Purchase Orders Table */}
      {activeTab === 'purchase_orders' && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
          {loadingPO ? (
            <div className="py-16 text-center text-xs text-slate-500">Loading purchase orders...</div>
          ) : paginatedPOs.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <Building2 className="h-8 w-8 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">No purchase orders found</p>
              <p className="text-xs text-slate-400">
                {search || statusFilter !== 'all'
                  ? 'Try adjusting your search terms or filter.'
                  : 'Create your first purchase order to get started.'}
              </p>
              {canCreatePO && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingPO(null);
                    setActiveCreationForm('purchase_order');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#6E1D1D] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#581717]"
                >
                  <Plus className="h-4 w-4" />
                  Create Purchase Order
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                    <th className="py-3 px-3 w-10 text-center">#</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">PO Number</th>
                    <th className="py-3 px-3">Vendor Name</th>
                    <th className="py-3 px-3">Campaign</th>
                    <th className="py-3 px-3 text-right">Total Amount</th>
                    <th className="py-3 px-3 text-right">Paid</th>
                    <th className="py-3 px-3 text-right">Balance</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedPOs.map((po, idx) => {
                    const vendorName = getVendorName(po.vendorId, po.vendorName);
                    const campaignName = getCampaignName(po.campaignId, po.campaignName);
                    const totalAmt = po.totalAmount || po.negotiatedRate || 0;
                    const paidAmt = po.paidAmount || 0;
                    const balanceAmt = Math.max(0, totalAmt - paidAmt);
                    const poDate = po.poDate || po.createdAt;

                    return (
                      <tr key={po._id || idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-3 text-center text-slate-400">
                          {(page - 1) * 20 + idx + 1}
                        </td>
                        <td className="py-3 px-3 text-slate-600 font-medium">
                          {formatDate(poDate)}
                        </td>
                        <td className="py-3 px-3">
                          <Link
                            href={`/purchase-orders?id=${po._id}&step=3`}
                            className="font-bold text-[#6E1D1D] hover:underline font-mono"
                          >
                            {po.poNumber || 'Draft PO'}
                          </Link>
                        </td>
                        <td className="py-3 px-3">
                          <p className="font-semibold text-slate-900">{vendorName}</p>
                          {po.city && <p className="text-[10px] text-slate-400">{po.city}</p>}
                        </td>
                        <td className="py-3 px-3">
                          <p className="text-slate-700 font-medium">{campaignName}</p>
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-slate-900">
                          {formatCurrency(totalAmt)}
                        </td>
                        <td className="py-3 px-3 text-right font-semibold text-emerald-600">
                          {formatCurrency(paidAmt)}
                        </td>
                        <td className="py-3 px-3 text-right font-bold">
                          <span className={balanceAmt > 0 ? 'text-[#6E1D1D]' : 'text-slate-400'}>
                            {formatCurrency(balanceAmt)}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              po.status === 'Accepted'
                                ? 'bg-emerald-100 text-emerald-800'
                                : po.status === 'Issued'
                                ? 'bg-blue-100 text-blue-800'
                                : po.status === 'Cancelled'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {po.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* View in Operations */}
                            <Link
                              href={`/purchase-orders?id=${po._id}&step=3`}
                              className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
                              title="View Purchase Order Details"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>

                            {/* Edit */}
                            {canCreatePO && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingPO(po);
                                  setActiveCreationForm('purchase_order');
                                }}
                                className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
                                title="Edit Purchase Order"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                            )}

                            {/* PDF / Document */}
                            <Link
                              href={`/purchase-orders?id=${po._id}&step=4`}
                              className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
                              title="View / Download PO Document"
                            >
                              <Download className="h-4 w-4" />
                            </Link>

                            {/* Open Operations PO Center */}
                            <Link
                              href={`/purchase-orders?id=${po._id}&step=1`}
                              className="p-1 text-slate-400 hover:text-[#6E1D1D] rounded hover:bg-[#F8E6E6]"
                              title="Open in Operations PO Center"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* PO Pagination */}
          {totalPOPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 bg-slate-50 text-xs">
              <span className="text-slate-500">
                Page {page} of {totalPOPages} ({filteredPOs.length} total)
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1 rounded border border-slate-200 bg-white text-slate-700 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPOPages}
                  onClick={() => setPage((p) => Math.min(totalPOPages, p + 1))}
                  className="px-2.5 py-1 rounded border border-slate-200 bg-white text-slate-700 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit History Modal */}
      <InvoiceEditHistoryModal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        invoiceNumber={historyInvoiceNum}
        history={historyItems}
      />
    </div>
  );
}

export default function InvoicesPage() {
  return (
    <RequireAuth permission="finance.view_payments">
      <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500">Loading invoices...</div>}>
        <InvoicesManagementContent />
      </Suspense>
    </RequireAuth>
  );
}
