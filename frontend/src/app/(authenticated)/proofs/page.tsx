"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import {
  RefreshCw,
  Check,
  CheckCircle2,
  XCircle,
  ChevronDown,
} from "lucide-react";

import ProofTable from "@/modules/proofs/components/ProofTable";

import { generateProofLink, getCampaignsByVendor } from "@/modules/proofs/api";
import { useProofs } from "@/modules/proofs/hooks/useProofs";
import { getCampaigns } from "@/modules/campaigns/api";
import { getVendors } from "@/modules/vendors/api";
import type { Campaign } from "@/modules/campaigns/types";
import type { Vendor } from "@/modules/vendors/types";

// ==========================================
// Searchable Suggestion Combobox Component
// ==========================================
interface SuggestionItem {
  id: string;
  label: string;
  subLabel?: string;
}

function SuggestionCombobox({
  label,
  placeholder,
  items,
  selectedId,
  onSelect,
  loading = false,
  helperText,
}: {
  label: string;
  placeholder: string;
  items: SuggestionItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  loading?: boolean;
  helperText?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync display text with currently selected item
  const selectedItem = items.find((i) => i.id === selectedId);

  useEffect(() => {
    if (selectedItem) {
      setSearchTerm(selectedItem.label);
    } else if (!selectedId) {
      setSearchTerm("");
    }
  }, [selectedId, selectedItem]);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        if (selectedItem) {
          setSearchTerm(selectedItem.label);
        } else {
          setSearchTerm("");
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedItem]);

  const filteredItems = items.filter((item) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      item.label.toLowerCase().includes(term) ||
      (item.subLabel && item.subLabel.toLowerCase().includes(term))
    );
  });

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center justify-between">
        <label className="mb-1 block text-xs font-semibold text-slate-700">
          {label}
        </label>
        {selectedId && (
          <button
            type="button"
            onClick={() => {
              onSelect("");
              setSearchTerm("");
            }}
            className="text-[11px] font-medium text-[#A8333B] hover:underline"
          >
            Clear
          </button>
        )}
      </div>

      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          placeholder={placeholder}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
            if (!e.target.value) {
              onSelect("");
            }
          }}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 pr-14 text-xs text-slate-800 outline-none transition focus:border-[#A8333B] focus:ring-1 focus:ring-[#A8333B]/20"
        />

        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-slate-400">
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                onSelect("");
                setSearchTerm("");
                setIsOpen(false);
              }}
              className="p-1 hover:text-slate-600 text-xs leading-none"
              title="Clear"
            >
              ✕
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 hover:text-slate-600"
            title="Toggle suggestions"
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {helperText && (
        <p className="mt-1 text-[11px] text-slate-500">{helperText}</p>
      )}

      {/* Suggestions Dropdown */}
      {isOpen && (
        <div className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
          {loading ? (
            <div className="p-3 text-center text-xs text-slate-400">
              Loading suggestions...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-3 text-center text-xs text-slate-400">
              No matching suggestions found
            </div>
          ) : (
            <>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect("");
                  setSearchTerm("");
                  setIsOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                  !selectedId
                    ? "bg-[#FCE8E8] font-semibold text-[#8B2424]"
                    : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                <span>-- None (Unassigned) --</span>
                {!selectedId && <Check className="h-3.5 w-3.5 text-[#8B2424]" />}
              </button>

              {filteredItems.map((item) => {
                const isSelected = item.id === selectedId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onSelect(item.id);
                      setSearchTerm(item.label);
                      setIsOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                      isSelected
                        ? "bg-[#FCE8E8] font-semibold text-[#8B2424]"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="truncate font-medium">{item.label}</p>
                      {item.subLabel && (
                        <p className="truncate text-[10px] text-slate-400">
                          {item.subLabel}
                        </p>
                      )}
                    </div>
                    {isSelected && (
                      <Check className="h-3.5 w-3.5 shrink-0 text-[#8B2424]" />
                    )}
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ProofsDashboard() {
  const {
    proofs,
    loading,
    error,
    filters,
    approveProof,
    completeProof,
    rejectProof,
    updateFilter,
    reload,
  } = useProofs();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [selectedVendor, setSelectedVendor] = useState("");

  // Cascading campaigns for the generate link section
  const [generatorCampaigns, setGeneratorCampaigns] = useState<
    Array<{ _id: string; name: string; campaignCode?: string }>
  >([]);
  const [loadingVendorCampaigns, setLoadingVendorCampaigns] = useState(false);

  const [generatedLink, setGeneratedLink] = useState("");
  const [generating, setGenerating] = useState(false);
  const [linkMessage, setLinkMessage] = useState("");
  const [linkError, setLinkError] = useState("");

  useEffect(() => {
    getCampaigns()
      .then((res) => {
        if (res?.data) {
          setCampaigns(res.data);
          setGeneratorCampaigns(res.data);
        }
      })
      .catch(() => {});

    getVendors()
      .then((res) => {
        if (Array.isArray(res?.data)) {
          setVendors(res.data);
        }
      })
      .catch(() => {});
  }, []);

  // When selected vendor in the generate link card changes, cascade campaigns with suggestions
  useEffect(() => {
    if (!selectedVendor) {
      setGeneratorCampaigns(campaigns);
      return;
    }

    let active = true;
    setLoadingVendorCampaigns(true);

    getCampaignsByVendor(selectedVendor)
      .then((vendorCamps) => {
        if (!active) return;
        if (vendorCamps && vendorCamps.length > 0) {
          setGeneratorCampaigns(vendorCamps);
          if (
            selectedCampaign &&
            !vendorCamps.some((c) => String(c._id) === String(selectedCampaign))
          ) {
            setSelectedCampaign("");
          }
        } else {
          setGeneratorCampaigns(campaigns);
        }
      })
      .catch(() => {
        if (!active) return;
        setGeneratorCampaigns(campaigns);
      })
      .finally(() => {
        if (active) setLoadingVendorCampaigns(false);
      });

    return () => {
      active = false;
    };
  }, [selectedVendor, campaigns, selectedCampaign]);

  // Filter out empty token-generation records that don't have proof details yet
  const actualProofs = proofs.filter(
    (p) => p.originalImageKey || p.watermarkedImageKey || p.gps
  );

  // Status counts
  const approvedCount = actualProofs.filter((p) => p.status === "Approved").length;
  const completeCount = actualProofs.filter((p) => p.status === "Complete").length;
  const rejectedCount = actualProofs.filter((p) => p.status === "Rejected").length;

  // Filter proofs by status only
  const displayedProofs = actualProofs.filter((p) => {
    if (!filters.status) return true;
    return p.status === filters.status;
  });

  // Selected vendor name for helper text
  const currentVendor = vendors.find((v) => (v._id || v.id) === selectedVendor);

  // ==========================================
  // Generate Public Proof Link
  // ==========================================

  const handleGenerateLink = async () => {
    setLinkError("");
    setLinkMessage("");
    setGeneratedLink("");

    try {
      setGenerating(true);
      const result = await generateProofLink({
        campaignId: selectedCampaign || undefined,
        vendorId: selectedVendor || undefined,
      });

      const fullLink = `${window.location.origin}/proof/${result.token}`;

      setGeneratedLink(fullLink);

      try {
        await navigator.clipboard.writeText(fullLink);
        setLinkMessage("Proof link generated and copied to clipboard successfully!");
      } catch {
        setLinkMessage("Proof link generated successfully.");
      }
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : err instanceof Error
          ? err.message
          : "Failed to generate proof link";
      setLinkError(message || "Failed to generate proof link");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyLink = async () => {
    if (!generatedLink) return;
    try {
      await navigator.clipboard.writeText(generatedLink);
      setLinkMessage("Proof link copied to clipboard successfully!");
    } catch {
      setLinkMessage("Copy failed. Please copy the link manually.");
    }
  };

  return (
   <div className="min-h-screen bg-white p-4 md:p-6 text-slate-900">
      {/* Header */}
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#8B2424]">
            Proof of Work
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Generate field submission links and review campaign execution proof.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh List
          </button>
        </div>
      </div>

      {/* Generate Proof Link Card with Manual Write & Suggestions */}
      <div className="mb-6 rounded-2xl border border-[#F9DADA] bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-[#8B2424]">
            Generate Public Proof Link
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Search or write vendor & campaign with autocomplete suggestions, then generate a secure link.
          </p>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Vendor Suggestion Combobox */}
          <SuggestionCombobox
            label="Assign Vendor (Optional)"
            placeholder="Type vendor name or select from suggestions..."
            selectedId={selectedVendor}
            onSelect={setSelectedVendor}
            items={vendors.map((v) => ({
              id: String(v._id || v.id || ""),
              label: v.name,
              subLabel: v.city || v.vendorType,
            }))}
          />

          {/* Campaign Suggestion Combobox */}
          <SuggestionCombobox
            label="Assign Campaign (Optional)"
            placeholder="Type campaign name or select from suggestions..."
            selectedId={selectedCampaign}
            onSelect={setSelectedCampaign}
            loading={loadingVendorCampaigns}
            helperText={
              currentVendor
                ? `Showing campaigns related to ${currentVendor.name}`
                : undefined
            }
            items={generatorCampaigns.map((c) => ({
              id: c._id,
              label: c.name,
              subLabel: c.campaignCode ? `Code: ${c.campaignCode}` : undefined,
            }))}
          />
        </div>

        <div>
          <button
            type="button"
            onClick={handleGenerateLink}
            disabled={generating}
            className="rounded-xl bg-[#A8333B] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#8B2424] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating ? "Generating..." : "Generate Proof Link"}
          </button>
        </div>

        {linkError && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
            {linkError}
          </div>
        )}

        {linkMessage && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
            ✓ {linkMessage}
          </div>
        )}

        {generatedLink && (
          <div className="mt-4 rounded-xl border border-[#F9DADA] bg-[#FCE8E8] p-4">
            <p className="mb-2 text-xs font-semibold text-[#8B2424]">
              Public Shareable Link (No login required)
            </p>

            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={generatedLink}
                readOnly
                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none select-all font-mono"
              />

              <button
                type="button"
                onClick={handleCopyLink}
                className="rounded-lg bg-[#A8333B] px-5 py-2 text-xs font-semibold text-white hover:bg-[#8B2424] shadow-sm shrink-0"
              >
                Copy Link
              </button>
            </div>

            <p className="mt-2 text-[11px] text-[#8B2424]">
              Send this link to your field team. Anyone opening this link on mobile or desktop can capture camera photos with location name and submit directly.
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Proofs Review Section */}
      <div className="space-y-4">
        {/* Status Filter Buttons: All | Approved | Complete | Rejected */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#F9DADA] bg-white p-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => updateFilter("status", "")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                filters.status === ""
                  ? "bg-[#A8333B] text-white shadow-sm"
                  : "bg-[#F9DADA] text-[#8B2424] hover:bg-[#FCE8E8]"
              }`}
            >
              <span>All Proofs</span>
              <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px]">
                {actualProofs.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => updateFilter("status", "Approved")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                filters.status === "Approved"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100"
              }`}
            >
              <Check className="h-3.5 w-3.5" />
              <span>Approved</span>
              <span className="rounded-full bg-blue-200 px-1.5 py-0.2 text-[10px] text-blue-900">
                {approvedCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => updateFilter("status", "Complete")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                filters.status === "Complete"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Complete</span>
              <span className="rounded-full bg-emerald-200 px-1.5 py-0.2 text-[10px] text-emerald-900">
                {completeCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => updateFilter("status", "Rejected")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                filters.status === "Rejected"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100"
              }`}
            >
              <XCircle className="h-3.5 w-3.5" />
              <span>Rejected</span>
              <span className="rounded-full bg-rose-200 px-1.5 py-0.2 text-[10px] text-rose-900">
                {rejectedCount}
              </span>
            </button>
          </div>

          <div>
            <button
              type="button"
              onClick={reload}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#A8333B] px-3.5 py-1.5 text-xs font-semibold text-[#8B2424] hover:bg-[#F9DADA] disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh List</span>
            </button>
          </div>
        </div>

        <ProofTable
          proofs={displayedProofs}
          loading={loading}
          onApprove={approveProof}
          onComplete={completeProof}
          onReject={rejectProof}
        />
      </div>
    </div>
  );
}

export default function ProofsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#F9DADA] border-t-[#A8333B]" />
        </div>
      }
    >
      <ProofsDashboard />
    </Suspense>
  );
}