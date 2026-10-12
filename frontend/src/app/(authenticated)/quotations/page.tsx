"use client";

import React, { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  FileText,
  CreditCard,
  CheckCircle2,
  Clock,
  TrendingUp,
  Plus,
  Search,
  RotateCw,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/shared/auth/auth-context";
import { quotationsApi } from "@/modules/quotations/api";
import { leadsApi } from "@/modules/leads/api";
import type { Quotation } from "@/modules/quotations/types";

import QuotationFlowStepper, {
  type QuotationFlowStep,
} from "@/modules/quotations/components/QuotationFlowStepper";
import QuotationTable from "@/modules/quotations/components/QuotationTable";
import QuotationForm from "@/modules/quotations/components/QuotationForm";
import QuotationDetails from "@/modules/quotations/components/QuotationDetails";
import QuotationDocument from "@/modules/quotations/components/QuotationDocument";
import QuotationTracking from "@/modules/quotations/components/QuotationTracking";

function formatRupees(paise: number): string {
  const rupees = (paise || 0) / 100;
  return `₹${rupees.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function QuotationsContent() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const isManagerOrAdmin = ["admin", "manager"].includes(user?.role?.toLowerCase() || "");

  // Stepper state: 1 = Dashboard, 2 = Create, 3 = Details, 4 = Document PDF, 5 = Tracking
  const [currentStep, setCurrentStep] = useState<QuotationFlowStep>(1);
  const [activeQuote, setActiveQuote] = useState<Quotation | null>(null);

  // Data state
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [agentFilter, setAgentFilter] = useState<string>("");
  const [agentOptions, setAgentOptions] = useState<{ _id: string; name: string }[]>([]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Load quotations
  const loadQuotations = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await quotationsApi.list({ limit: 100 });
      setQuotations(res.quotations || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load quotations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuotations();
    if (isManagerOrAdmin) {
      leadsApi
        .listAgents()
        .then((res) => {
          if (res.agents) setAgentOptions(res.agents);
        })
        .catch(() => {});
    }
  }, [isManagerOrAdmin]);

  // Check URL query params for step or id
  useEffect(() => {
    const queryStep = searchParams.get("step");
    const queryId = searchParams.get("id");

    if (queryStep) {
      const stepNum = Number(queryStep);
      if (stepNum >= 1 && stepNum <= 5) {
        setCurrentStep(stepNum as QuotationFlowStep);
      }
    }

    if (queryId) {
      const found = quotations.find((q) => q._id === queryId || q.quoteNumber === queryId);
      if (found) {
        setActiveQuote(found);
      } else {
        quotationsApi
          .getById(queryId)
          .then((quote) => {
            if (quote) setActiveQuote(quote);
          })
          .catch(() => {});
      }
    }
  }, [searchParams, quotations]);

  // Compute Top 4 Sales & Financial KPIs
  const metrics = useMemo(() => {
    const totalCount = quotations.length;
    const totalPipelineValue = quotations.reduce((acc, q) => acc + (q.total || 0), 0);

    const acceptedQuotes = quotations.filter((q) => q.status === "Accepted");
    const totalAcceptedValue = acceptedQuotes.reduce((acc, q) => acc + (q.total || 0), 0);
    const acceptedCount = acceptedQuotes.length;

    const sentQuotes = quotations.filter((q) => q.status === "Sent");
    const totalSentValue = sentQuotes.reduce((acc, q) => acc + (q.total || 0), 0);
    const sentCount = sentQuotes.length;

    const draftQuotes = quotations.filter((q) => q.status === "Draft");
    const draftCount = draftQuotes.length;

    const rejectedQuotes = quotations.filter((q) => q.status === "Rejected");
    const rejectedCount = rejectedQuotes.length;

    const expiredQuotes = quotations.filter((q) => q.status === "Expired");
    const expiredCount = expiredQuotes.length;

    const winRate =
      totalCount > 0 ? Math.min(100, Math.round((acceptedCount / totalCount) * 100)) : 0;

    return {
      totalCount,
      totalPipelineValue,
      totalAcceptedValue,
      acceptedCount,
      totalSentValue,
      sentCount,
      draftCount,
      rejectedCount,
      expiredCount,
      winRate,
    };
  }, [quotations]);

  // Filtered quotations for table
  const filteredQuotations = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();

    return quotations.filter((q) => {
      const leadObj: any = typeof q.leadId === "object" ? q.leadId : null;
      const clientName = q.clientName || leadObj?.companyName || "";
      const contactPerson = q.clientContactPerson || leadObj?.contactPerson || leadObj?.name || "";
      const quoteNo = q.quoteNumber || "";
      const city = q.clientCity || leadObj?.city || "";

      const matchSearch =
        !term ||
        quoteNo.toLowerCase().includes(term) ||
        clientName.toLowerCase().includes(term) ||
        contactPerson.toLowerCase().includes(term) ||
        city.toLowerCase().includes(term);

      if (!matchSearch) return false;

      // Status dropdown filter
      if (statusFilter && q.status !== statusFilter) return false;

      // Agent dropdown filter
      if (agentFilter) {
        const creatorId =
          typeof q.createdBy === "object" ? q.createdBy?._id : q.createdBy;
        if (creatorId !== agentFilter) return false;
      }

      // Tab filter
      if (activeTab === "accepted") return q.status === "Accepted";
      if (activeTab === "sent") return q.status === "Sent";
      if (activeTab === "draft") return q.status === "Draft";
      if (activeTab === "closed") return q.status === "Rejected" || q.status === "Expired";

      return true;
    });
  }, [quotations, debouncedSearch, statusFilter, agentFilter, activeTab]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredQuotations.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedQuotations = useMemo(() => {
    return filteredQuotations.slice(startIndex, startIndex + pageSize);
  }, [filteredQuotations, startIndex, pageSize]);

  // Navigation Handlers
  const handleOpenCreate = () => {
    setActiveQuote(null);
    setCurrentStep(2);
  };

  const handleView = (q: Quotation) => {
    setActiveQuote(q);
    setCurrentStep(3);
  };

  const handleDocument = (q: Quotation) => {
    setActiveQuote(q);
    setCurrentStep(4);
  };

  const handleTrack = (q: Quotation) => {
    setActiveQuote(q);
    setCurrentStep(5);
  };

  const handleEdit = (q: Quotation) => {
    setActiveQuote(q);
    setCurrentStep(2);
  };

  return (
    <div className="space-y-6">
      {/* 5-Step Flow Stepper (Dashboard, Create, Details, PDF, Tracking) */}
      <QuotationFlowStepper
        currentStep={currentStep}
        hasActiveQuote={Boolean(activeQuote)}
        onSelectStep={(step) => setCurrentStep(step)}
      />

      {/* STEP 1: Dashboard / Quotations Management */}
      {currentStep === 1 && (
        <div className="space-y-6">
          {/* Header & Primary CTA */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Quotation &amp; Proposal Center
              </h1>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                Generate branded proposals, track client decision milestones, and convert accepted deals to live campaigns.
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#8B2424] px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#721c1c] transition cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Proposal</span>
            </button>
          </div>

          {/* Top 4 KPI Cards (Mirroring PO Executive Scorecard) */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Total Pipeline Value */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-2xs transition hover:border-gray-300 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  Total Pipeline Value
                </span>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FDE8E8] text-[#8B2424] dark:bg-rose-950/40 dark:text-rose-300">
                  <CreditCard className="h-3.5 w-3.5" />
                </div>
              </div>
              <p className="mt-1.5 text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                {formatRupees(metrics.totalPipelineValue)}
              </p>
              <div className="mt-1 flex items-center justify-between text-[10px] text-gray-500">
                <span>{metrics.totalCount} Proposals</span>
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  {metrics.winRate}% Win Rate
                </span>
              </div>
            </div>

            {/* Won & Accepted Value */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-2xs transition hover:border-gray-300 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  Won &amp; Accepted
                </span>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </div>
              </div>
              <p className="mt-1.5 text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatRupees(metrics.totalAcceptedValue)}
              </p>
              <div className="mt-1 flex items-center justify-between text-[10px] text-gray-500">
                <span>{metrics.acceptedCount} Deals Won</span>
                <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                  Ready to Execute
                </span>
              </div>
            </div>

            {/* Pending Client Decision */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-2xs transition hover:border-gray-300 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  Pending Decision
                </span>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                  <Clock className="h-3.5 w-3.5" />
                </div>
              </div>
              <p className="mt-1.5 text-lg sm:text-xl font-bold text-amber-700 dark:text-amber-400">
                {formatRupees(metrics.totalSentValue)}
              </p>
              <div className="mt-1 flex items-center justify-between text-[10px] text-gray-500">
                <span>{metrics.sentCount} Dispatched</span>
                <span className="font-semibold text-amber-800 dark:text-amber-300">
                  Awaiting Sign-off
                </span>
              </div>
            </div>

            {/* Active Pipeline Status */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-2xs transition hover:border-gray-300 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  Active Pipeline
                </span>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                  <TrendingUp className="h-3.5 w-3.5" />
                </div>
              </div>
              <p className="mt-1.5 text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                {metrics.draftCount + metrics.sentCount}{" "}
                <span className="text-xs font-normal text-gray-400">Open Proposals</span>
              </p>
              <div className="mt-1 flex items-center justify-between text-[10px] text-gray-500">
                <span>{metrics.draftCount} Drafts</span>
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  {metrics.rejectedCount + metrics.expiredCount} Closed/Lost
                </span>
              </div>
            </div>
          </div>

          {/* Filter Tabs & Search Bar */}
          <div className="space-y-3">
            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-3 dark:border-slate-800">
              {[
                { id: "all", label: "All Proposals", count: metrics.totalCount },
                { id: "accepted", label: "Accepted / Won", count: metrics.acceptedCount },
                { id: "sent", label: "Pending Decision", count: metrics.sentCount },
                { id: "draft", label: "Drafts", count: metrics.draftCount },
                { id: "closed", label: "Lost / Expired", count: metrics.rejectedCount + metrics.expiredCount },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                    activeTab === tab.id
                      ? "bg-[#8B2424] text-white shadow-2xs"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-800 dark:text-gray-300 dark:hover:bg-slate-700"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                      activeTab === tab.id
                        ? "bg-white/20 text-white"
                        : "bg-white text-gray-700 dark:bg-slate-900 dark:text-gray-300"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Search and Dropdowns */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by Quote #, client company, contact person, or city..."
                  className="w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 py-2.5 text-xs text-gray-900 outline-none transition focus:border-[#8B2424] focus:ring-2 focus:ring-rose-100 dark:border-slate-800 dark:bg-slate-900 dark:text-white shadow-2xs"
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

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs font-semibold text-gray-700 outline-none focus:border-[#8B2424] dark:border-slate-800 dark:bg-slate-900 dark:text-gray-300 shadow-2xs"
                >
                  <option value="">All Statuses</option>
                  <option value="Draft">Draft</option>
                  <option value="Sent">Sent</option>
                  <option value="Accepted">Accepted</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Expired">Expired</option>
                </select>

                {isManagerOrAdmin && agentOptions.length > 0 && (
                  <select
                    value={agentFilter}
                    onChange={(e) => setAgentFilter(e.target.value)}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs font-semibold text-gray-700 outline-none focus:border-[#8B2424] dark:border-slate-800 dark:bg-slate-900 dark:text-gray-300 shadow-2xs"
                  >
                    <option value="">All Agents</option>
                    {agentOptions.map((a) => (
                      <option key={a._id} value={a._id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                )}

                {(search || statusFilter || agentFilter || activeTab !== "all") && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setStatusFilter("");
                      setAgentFilter("");
                      setActiveTab("all");
                    }}
                    className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-50 transition shadow-2xs cursor-pointer dark:border-slate-800 dark:bg-slate-900 dark:text-gray-300 dark:hover:bg-slate-800"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                    <span>Reset</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-[#8B2424]">
              {error}
            </div>
          )}

          {/* Quotation Table */}
          {loading ? (
            <div className="flex h-48 items-center justify-center rounded-2xl border border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <span className="text-xs font-semibold text-gray-500">Loading quotations...</span>
            </div>
          ) : (
            <QuotationTable
              quotations={paginatedQuotations}
              totalItems={filteredQuotations.length}
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              onView={handleView}
              onDocument={handleDocument}
              onTrack={handleTrack}
              onEdit={handleEdit}
            />
          )}
        </div>
      )}

      {/* STEP 2: Create / Edit Proposal */}
      {currentStep === 2 && (
        <QuotationForm
          initialQuote={activeQuote}
          initialLeadId={searchParams.get("leadId") || undefined}
          onBack={() => {
            if (activeQuote) {
              setCurrentStep(3);
            } else {
              setCurrentStep(1);
            }
          }}
          onSuccess={(savedQuote) => {
            setActiveQuote(savedQuote);
            loadQuotations();
            setCurrentStep(3); // Moves straight to Step 3 Details
          }}
        />
      )}

      {/* STEP 3: Quotation Details & Review */}
      {currentStep === 3 && activeQuote && (
        <QuotationDetails
          quotation={activeQuote}
          onBack={() => setCurrentStep(1)}
          onEdit={() => setCurrentStep(2)}
          onDocument={() => setCurrentStep(4)}
          onTrack={() => setCurrentStep(5)}
          onRefresh={(updated) => {
            setActiveQuote(updated);
            loadQuotations();
          }}
        />
      )}

      {/* STEP 4: Branded Document (PDF) Preview */}
      {currentStep === 4 && activeQuote && (
        <QuotationDocument
          quotation={activeQuote}
          onBack={() => setCurrentStep(3)}
          onNext={() => setCurrentStep(5)}
          onRefresh={(updated) => {
            setActiveQuote(updated);
            loadQuotations();
          }}
        />
      )}

      {/* STEP 5: Campaign Conversion & Lifecycle Tracking */}
      {currentStep === 5 && activeQuote && (
        <QuotationTracking
          quotation={activeQuote}
          onBack={() => setCurrentStep(3)}
          onRefresh={loadQuotations}
        />
      )}

      {/* Fallback Empty State for Steps 3, 4, 5 if no quote is selected */}
      {currentStep >= 3 && !activeQuote && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <FileText className="h-10 w-10 text-gray-400" />
          <h3 className="mt-3 text-sm font-bold text-gray-900 dark:text-white">
            No active quotation selected
          </h3>
          <p className="mt-1 text-xs text-gray-500 max-w-sm">
            Please choose a quotation from the Dashboard or create a new proposal to view details, branded PDF or tracking.
          </p>
          <button
            type="button"
            onClick={() => setCurrentStep(1)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#8B2424] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#721c1c] transition cursor-pointer"
          >
            Go to Dashboard
          </button>
        </div>
      )}
    </div>
  );
}

export default function QuotationsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-48 items-center justify-center">
          <span className="text-xs text-gray-500">Loading Quotations Module...</span>
        </div>
      }
    >
      <QuotationsContent />
    </Suspense>
  );
}
