"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  CreditCard,
  CheckCircle2,
  Clock,
  TrendingUp,
  Plus,
  Search,
  FileText,
  Building2,
  RotateCw,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";

import { usePurchaseOrders } from "@/modules/purchase-orders/hooks/usePurchaseOrders";
import PurchaseOrderTable from "@/modules/purchase-orders/components/PurchaseOrderTable";
import PurchaseOrderForm from "@/modules/purchase-orders/components/PurchaseOrderForm";
import PurchaseOrderDetails from "@/modules/purchase-orders/components/PurchaseOrderDetails";
import PurchaseOrderDocument from "@/modules/purchase-orders/components/PurchaseOrderDocument";
import PurchaseOrderTracking from "@/modules/purchase-orders/components/PurchaseOrderTracking";
import FlowStepper, { type FlowStep } from "@/modules/purchase-orders/components/FlowStepper";
import { formatAmount } from "@/modules/purchase-orders/format";

import type {
  PurchaseOrder,
  PurchaseOrderFormData,
} from "@/modules/purchase-orders/types";

function PurchaseOrdersContent() {
  const searchParams = useSearchParams();

  // Search & Filter state
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Pagination state (default 25 items per page as requested)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const {
    orders,
    loading,
    saving,
    error,
    addOrder,
    editOrder,
    issueOrder,
    cancelOrder,
  } = usePurchaseOrders({
    search: debouncedSearch,
    status: status || undefined,
  });

  // Flow State: 1 = Dashboard, 2 = Create, 3 = Details, 4 = Document PDF, 5 = Tracking
  const [currentStep, setCurrentStep] = useState<FlowStep>(1);
  const [activeOrder, setActiveOrder] = useState<PurchaseOrder | null>(null);

  // Check URL query parameters for step or id
  useEffect(() => {
    const queryStep = searchParams.get("step");
    const queryId = searchParams.get("id");

    if (queryStep) {
      const stepNum = Number(queryStep);
      if (stepNum >= 1 && stepNum <= 5) {
        setCurrentStep(stepNum as FlowStep);
      }
    }

    if (queryId && orders.length > 0) {
      const found = orders.find((o) => o._id === queryId || o.poNumber === queryId);
      if (found) {
        setActiveOrder(found);
      }
    }
  }, [searchParams, orders]);

  // Executive Dashboard KPIs computed across all orders
  const metrics = useMemo(() => {
    const totalCount = orders.length;
    const totalSpend = orders.reduce(
      (sum, o) => sum + (o.totalAmount || o.negotiatedRate || 0),
      0,
    );
    const totalPaid = orders.reduce((sum, o) => sum + (o.paidAmount || 0), 0);
    const totalPending = Math.max(0, totalSpend - totalPaid);
    const percentDisbursed =
      totalSpend > 0 ? Math.min(100, Math.round((totalPaid / totalSpend) * 100)) : 0;

    const draftCount = orders.filter((o) => o.status === "Draft").length;
    const issuedCount = orders.filter((o) => o.status === "Issued").length;
    const acceptedCount = orders.filter((o) => o.status === "Accepted").length;
    const cancelledCount = orders.filter((o) => o.status === "Cancelled").length;
    const activeCount = issuedCount + acceptedCount;

    const paidOrders = orders.filter(
      (o) =>
        o.paymentStatus === "Paid" ||
        (o.paidAmount && o.totalAmount && o.paidAmount >= o.totalAmount),
    ).length;

    const partialOrders = orders.filter(
      (o) =>
        o.paymentStatus === "Partial" ||
        (o.paidAmount &&
          o.totalAmount &&
          o.paidAmount > 0 &&
          o.paidAmount < o.totalAmount),
    ).length;

    const pendingPaymentOrders = orders.filter(
      (o) =>
        (!o.paidAmount || o.paidAmount === 0) &&
        (o.totalAmount > 0 || (o.negotiatedRate ?? 0) > 0),
    ).length;

    const uniqueVendors = new Set(
      orders
        .map((o) =>
          typeof o.vendorId === "string"
            ? o.vendorId
            : o.vendorId?._id || o.vendorName,
        )
        .filter(Boolean),
    ).size;

    return {
      totalCount,
      totalSpend,
      totalPaid,
      totalPending,
      percentDisbursed,
      draftCount,
      issuedCount,
      acceptedCount,
      cancelledCount,
      activeCount,
      paidOrders,
      partialOrders,
      pendingPaymentOrders,
      uniqueVendors,
    };
  }, [orders]);

  // Filtered orders for table
  const filteredOrders = useMemo(() => {
    const value = search.trim().toLowerCase();

    return orders.filter((order) => {
      const vendor =
        typeof order.vendorId === "string"
          ? order.vendorId
          : `${order.vendorId?.name ?? ""} ${order.vendorId?.city ?? ""} ${order.vendorId?.state ?? ""}`;

      const campaign =
        typeof order.campaignId === "string"
          ? order.campaignId
          : `${order.campaignId?.name ?? ""} ${order.campaignId?.campaignCode ?? ""}`;

      const poNumber = order.poNumber ?? "";

      const searchMatch =
        !value ||
        poNumber.toLowerCase().includes(value) ||
        (order.pricingId ?? "").toLowerCase().includes(value) ||
        (order.city ?? "").toLowerCase().includes(value) ||
        vendor.toLowerCase().includes(value) ||
        campaign.toLowerCase().includes(value);

      if (!searchMatch) return false;

      // Dropdown Status filter
      if (status && order.status !== status) return false;

      // Tab filter
      const total = order.totalAmount || order.negotiatedRate || 0;
      const paid = order.paidAmount || 0;
      const isPaid = order.paymentStatus === "Paid" || (paid >= total && total > 0);
      const isPartial = order.paymentStatus === "Partial" || (paid > 0 && paid < total);
      const isPending = !isPaid && !isPartial;

      if (activeTab === "active") {
        return order.status === "Issued" || order.status === "Accepted";
      }
      if (activeTab === "pending_payment") {
        return isPending && order.status !== "Cancelled" && order.status !== "Draft";
      }
      if (activeTab === "partial_payment") {
        return isPartial;
      }
      if (activeTab === "paid") {
        return isPaid;
      }
      if (activeTab === "draft") {
        return order.status === "Draft";
      }

      return true;
    });
  }, [orders, search, status, activeTab]);

  // Reset pagination to page 1 when any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, status, activeTab, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedOrders = useMemo(() => {
    return filteredOrders.slice(startIndex, startIndex + pageSize);
  }, [filteredOrders, startIndex, pageSize]);

  // Actions
  function openCreate() {
    setActiveOrder(null);
    setCurrentStep(2);
  }

  function handleView(order: PurchaseOrder) {
    setActiveOrder(order);
    setCurrentStep(3);
  }

  function handleDocument(order: PurchaseOrder) {
    setActiveOrder(order);
    setCurrentStep(4);
  }

  function handleTrack(order: PurchaseOrder) {
    setActiveOrder(order);
    setCurrentStep(5);
  }

  function handleEdit(order: PurchaseOrder) {
    setActiveOrder(order);
    setCurrentStep(2);
  }

  async function handleIssue(order: PurchaseOrder) {
    if (
      !window.confirm(
        `Are you sure you want to issue ${order.poNumber}? Once issued, it cannot be edited.`,
      )
    ) {
      return;
    }

    const updated = await issueOrder(order._id);
    if (updated && activeOrder?._id === order._id) {
      setActiveOrder(updated);
    }
  }

  async function handleCancel(order: PurchaseOrder) {
    if (
      !window.confirm(
        `Are you sure you want to cancel ${order.poNumber}?`,
      )
    ) {
      return;
    }

    const updated = await cancelOrder(order._id);
    if (updated && activeOrder?._id === order._id) {
      setActiveOrder(updated);
    }
  }

  async function handleFormSubmit(
    data: PurchaseOrderFormData,
    issueImmediately?: boolean,
  ): Promise<PurchaseOrder | boolean | null> {
    try {
      if (activeOrder) {
        const updated = await editOrder(activeOrder._id, data);
        if (issueImmediately && updated) {
          const issued = await issueOrder(activeOrder._id);
          return issued || updated;
        }
        return updated;
      } else {
        const created = await addOrder(data);
        if (issueImmediately && created && (created as any)._id) {
          const issued = await issueOrder((created as any)._id);
          return issued || created;
        }
        return created;
      }
    } catch (err) {
      console.error("Form submit error:", err);
      return null;
    }
  }

  return (
    <main className="min-h-screen bg-gray-50/50 p-4 md:p-6 pb-16">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Flow Stepper (Visible across all steps for clear 1-2-3-4-5 progress) */}
        <FlowStepper
          currentStep={currentStep}
          hasActiveOrder={!!activeOrder}
          onSelectStep={(step) => setCurrentStep(step)}
        />

        {/* STEP 1: Rich Executive Dashboard */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* 1. Header Banner */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl bg-white p-6 border border-gray-200 shadow-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#FDE8E8] text-[#A8333B]">
                    <Sparkles className="h-3 w-3" />
                    Media Octus Procurement
                  </span>
                  <span className="text-xs text-gray-400 font-medium">
                    Financial Year 2026-27
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">
                  Purchase Orders Dashboard
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 max-w-2xl">
                  Real-time visibility across vendor commitments, campaign media execution, invoice approvals &amp; disbursement tracking.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={openCreate}
                  className="flex items-center gap-2 rounded-xl bg-[#A8333B] px-5 py-3 text-xs sm:text-sm font-bold text-white shadow-sm transition hover:bg-[#8B2424] hover:shadow-md cursor-pointer active:scale-98"
                >
                  <Plus className="h-4 w-4" />
                  + Create Purchase Order
                </button>
              </div>
            </div>

            {/* 2. Top 4 Financial & Operational KPI Cards (Compact) */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {/* Total Committed Spend */}
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-2xs transition hover:border-gray-300">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    Total PO Value
                  </span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FDE8E8] text-[#A8333B]">
                    <CreditCard className="h-3.5 w-3.5" />
                  </div>
                </div>
                <p className="mt-1.5 text-lg sm:text-xl font-bold text-gray-900">
                  {formatAmount(metrics.totalSpend)}
                </p>
                <div className="mt-1 flex items-center justify-between text-[10px] text-gray-500">
                  <span>{metrics.totalCount} Orders</span>
                  <span className="font-semibold text-gray-700">{metrics.uniqueVendors} Vendors</span>
                </div>
              </div>

              {/* Total Disbursed (Paid) */}
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-2xs transition hover:border-gray-300">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    Total Paid
                  </span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </div>
                </div>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <p className="text-lg sm:text-xl font-bold text-emerald-600">
                    {formatAmount(metrics.totalPaid)}
                  </p>
                  <span className="rounded bg-emerald-50 px-1.5 py-0.2 text-[9px] font-bold text-emerald-700 border border-emerald-100">
                    {metrics.percentDisbursed}%
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] text-gray-500">
                  <span>{metrics.paidOrders} Cleared</span>
                  <span className="font-semibold text-gray-700">{metrics.partialOrders} Partial</span>
                </div>
              </div>

              {/* Outstanding Pending Balance */}
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-2xs transition hover:border-gray-300">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    Pending Balance
                  </span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                    <Clock className="h-3.5 w-3.5" />
                  </div>
                </div>
                <p className="mt-1.5 text-lg sm:text-xl font-bold text-amber-700">
                  {formatAmount(metrics.totalPending)}
                </p>
                <div className="mt-1 flex items-center justify-between text-[10px] text-gray-500">
                  <span>Awaiting Clearance</span>
                  <span className="font-semibold text-amber-800">
                    {metrics.pendingPaymentOrders} Unpaid
                  </span>
                </div>
              </div>

              {/* Active & Operational Orders */}
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-2xs transition hover:border-gray-300">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    Active Operations
                  </span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <TrendingUp className="h-3.5 w-3.5" />
                  </div>
                </div>
                <p className="mt-1.5 text-lg sm:text-xl font-bold text-gray-900">
                  {metrics.activeCount} <span className="text-xs font-normal text-gray-400">Live POs</span>
                </p>
                <div className="mt-1 flex items-center justify-between text-[10px] text-gray-500">
                  <span>{metrics.draftCount} Drafts</span>
                  <span className="font-semibold text-gray-700">{metrics.cancelledCount} Cancelled</span>
                </div>
              </div>
            </div>

            {/* 4. Filter Tabs & Search Bar */}
            <div className="space-y-3">
              {/* Tab Pills */}
              <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-3">
                {[
                  { id: "all", label: "All Orders", count: metrics.totalCount },
                  { id: "active", label: "Active & Issued", count: metrics.activeCount },
                  { id: "pending_payment", label: "Payment Pending", count: metrics.pendingPaymentOrders },
                  { id: "partial_payment", label: "Partially Paid", count: metrics.partialOrders },
                  { id: "paid", label: "Fully Paid", count: metrics.paidOrders },
                  { id: "draft", label: "Drafts", count: metrics.draftCount },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                      activeTab === tab.id
                        ? "bg-[#A8333B] text-white shadow-xs"
                        : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                        activeTab === tab.id
                          ? "bg-white/20 text-white"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Search & Select dropdowns */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by PO number, campaign, vendor, or city..."
                    className="w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 py-2.5 text-xs text-gray-900 outline-none transition focus:border-[#A8333B] focus:ring-2 focus:ring-[#F9DADA] shadow-2xs"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 hover:text-gray-700"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-gray-700 outline-none focus:border-[#A8333B] shadow-2xs"
                  >
                    <option value="">All PO Statuses</option>
                    <option value="Draft">Draft</option>
                    <option value="Issued">Issued</option>
                    <option value="Accepted">Accepted</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>

                  {(search || status || activeTab !== "all") && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        setStatus("");
                        setActiveTab("all");
                      }}
                      className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-50 transition shadow-2xs cursor-pointer"
                      title="Reset all filters"
                    >
                      <RotateCw className="h-3.5 w-3.5" />
                      <span>Reset</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="rounded-xl border border-[#F0C7C7] bg-[#FFF8F8] p-4 text-xs font-bold text-[#8B2424]">
                {error}
              </div>
            )}

            {/* 5. Rich Purchase Order Table */}
            <div>
              {loading ? (
                <Loading />
              ) : (
                <PurchaseOrderTable
                  orders={paginatedOrders}
                  totalItems={filteredOrders.length}
                  currentPage={currentPage}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={setPageSize}
                  onView={handleView}
                  onDocument={handleDocument}
                  onTrack={handleTrack}
                  onEdit={handleEdit}
                  onIssue={handleIssue}
                  onCancel={handleCancel}
                />
              )}
            </div>
          </div>
        )}

        {/* STEP 2: Create / Edit Purchase Order */}
        {currentStep === 2 && (
          <PurchaseOrderForm
            order={activeOrder}
            saving={saving}
            onBack={() => setCurrentStep(1)}
            onSubmit={handleFormSubmit}
            onSuccess={(savedOrder) => {
              setActiveOrder(savedOrder);
              setCurrentStep(3); // Moves straight to Step 3
            }}
          />
        )}

        {/* STEP 3: Purchase Order Details */}
        {currentStep === 3 && activeOrder && (
          <PurchaseOrderDetails
            order={activeOrder}
            onBack={() => setCurrentStep(1)}
            onEdit={() => setCurrentStep(2)}
            onIssue={async () => {
              const updated = await issueOrder(activeOrder._id);
              if (updated) setActiveOrder(updated);
            }}
            onNext={() => setCurrentStep(4)} // Moves to Step 4 Document PDF
          />
        )}

        {/* STEP 4: Purchase Order Document (PDF) */}
        {currentStep === 4 && activeOrder && (
          <PurchaseOrderDocument
            order={activeOrder}
            onBack={() => setCurrentStep(3)}
            onNext={() => setCurrentStep(5)} // Moves to Step 5 Payment Tracking
          />
        )}

        {/* STEP 5: Payment & Invoice Tracking */}
        {currentStep === 5 && activeOrder && (
          <PurchaseOrderTracking
            order={activeOrder}
            onBack={() => setCurrentStep(4)}
            onGoToDashboard={() => setCurrentStep(1)}
            onOrderUpdated={(updated) => setActiveOrder(updated)}
          />
        )}
      </div>
    </main>
  );
}

export default function PurchaseOrdersPage() {
  return (
    <Suspense fallback={<Loading />}>
      <PurchaseOrdersContent />
    </Suspense>
  );
}

function Loading() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-16 text-center shadow-xs">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#F9DADA] border-t-[#A8333B]" />
      <p className="mt-4 text-xs font-semibold text-gray-500">
        Loading purchase orders &amp; procurement data...
      </p>
    </div>
  );
}