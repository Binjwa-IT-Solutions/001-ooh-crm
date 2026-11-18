"use client";

import { useEffect, useRef, useState } from "react";
import {
  Upload,
  X,
  MapPin,
  Calendar,
  Check,
  AlertCircle,
  ChevronDown,
  Search,
} from "lucide-react";
import type { Campaign } from "@/modules/campaigns/types";
import type { Vendor } from "@/modules/vendors/types";
import { createManualProof } from "../api";

interface SearchableSelectProps {
  label: string;
  placeholder: string;
  items: Array<{ id: string; label: string; subLabel?: string }>;
  selectedId: string;
  onSelect: (id: string) => void;
}

function SearchableSelect({
  label,
  placeholder,
  items,
  selectedId,
  onSelect,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedItem = items.find((i) => i.id === selectedId);

  useEffect(() => {
    if (selectedItem) {
      setSearch(selectedItem.label);
    } else if (!selectedId) {
      setSearch("");
    }
  }, [selectedId, selectedItem]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        if (selectedItem) {
          setSearch(selectedItem.label);
        } else {
          setSearch("");
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedItem]);

  const filteredItems = items.filter((item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      item.label.toLowerCase().includes(q) ||
      (item.subLabel && item.subLabel.toLowerCase().includes(q))
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
              setSearch("");
            }}
            className="text-[11px] font-medium text-[#A8333B] hover:underline"
          >
            Clear
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          placeholder={placeholder}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
            if (!e.target.value) {
              onSelect("");
            }
          }}
          className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-12 py-2 text-xs text-slate-800 shadow-sm focus:border-[#A8333B] focus:outline-none focus:ring-1 focus:ring-[#A8333B]"
        />

        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-slate-400">
          {search && (
            <button
              type="button"
              onClick={() => {
                onSelect("");
                setSearch("");
                setIsOpen(false);
              }}
              className="p-0.5 hover:text-slate-600 text-xs leading-none"
              title="Clear"
            >
              ✕
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="p-0.5 hover:text-slate-600"
            title="Toggle list"
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect("");
              setSearch("");
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

          {filteredItems.length === 0 ? (
            <div className="p-2.5 text-center text-xs text-slate-400">
              No matching records found
            </div>
          ) : (
            filteredItems.map((item) => {
              const isSelected = item.id === selectedId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelect(item.id);
                    setSearch(item.label);
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
            })
          )}
        </div>
      )}
    </div>
  );
}

interface ManualProofModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaigns: Campaign[];
  vendors: Vendor[];
  onSuccess: () => Promise<void> | void;
}

export default function ManualProofModal({
  isOpen,
  onClose,
  campaigns,
  vendors,
  onSuccess,
}: ManualProofModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [campaignId, setCampaignId] = useState<string>("");
  const [vendorId, setVendorId] = useState<string>("");
  const [locationName, setLocationName] = useState<string>("");
  const [capturedAt, setCapturedAt] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setError("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please select an image to upload.");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccessMsg("");

    try {
      await createManualProof({
        file,
        campaignId: campaignId || undefined,
        vendorId: vendorId || undefined,
        locationName: locationName.trim() || undefined,
        capturedAt: capturedAt ? new Date(capturedAt).toISOString() : undefined,
      });

      setSuccessMsg("Proof uploaded successfully!");
      await onSuccess();
      setTimeout(() => {
        handleClose();
      }, 900);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to upload manual proof."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreviewUrl("");
    setCampaignId("");
    setVendorId("");
    setLocationName("");
    setError("");
    setSuccessMsg("");
    onClose();
  };

  const campaignOptions = campaigns.map((c) => ({
    id: c._id,
    label: c.name || (c as any).campaignName || "Unnamed Campaign",
    subLabel: c.campaignCode ? `Code: ${c.campaignCode}` : undefined,
  }));

  const vendorOptions = vendors.map((v) => ({
    id: v._id,
    label: v.name || (v as any).vendorName || "Unnamed Vendor",
    subLabel: v.city ? `City: ${v.city}` : undefined,
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg overflow-visible rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#F9DADA] bg-[#FFF8F8] px-6 py-4 rounded-t-2xl">
          <div>
            <h2 className="text-base font-bold text-[#8B2424]">
              Manual Proof Upload
            </h2>
            <p className="text-xs text-slate-500">
              Upload proof photo and assign campaign & vendor manually
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-[#FCE8E8] hover:text-[#8B2424] transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700 border border-emerald-200">
              <Check className="h-4 w-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* File Upload Box */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Proof Image <span className="text-red-500">*</span>
            </label>
            <div className="relative mt-1 flex justify-center rounded-xl border-2 border-dashed border-[#F9DADA] px-6 pt-5 pb-6 hover:border-[#A8333B] transition bg-[#FFF8F8]">
              {previewUrl ? (
                <div className="space-y-2 text-center">
                  <div className="relative mx-auto h-40 w-full max-w-xs overflow-hidden rounded-lg border border-slate-200 shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl}
                      alt="Proof Preview"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer text-xs font-medium text-[#A8333B] hover:underline"
                  >
                    Change Image
                  </label>
                </div>
              ) : (
                <div className="space-y-1 text-center">
                  <Upload className="mx-auto h-9 w-9 text-[#A8333B]" />
                  <div className="flex text-xs text-slate-600 justify-center">
                    <label
                      htmlFor="file-upload"
                      className="relative cursor-pointer font-semibold text-[#8B2424] hover:underline"
                    >
                      <span>Click to upload image</span>
                    </label>
                  </div>
                  <p className="text-[11px] text-slate-400">PNG, JPG, WEBP up to 10MB</p>
                </div>
              )}
              <input
                id="file-upload"
                name="file-upload"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleFileChange}
              />
            </div>
          </div>

          {/* Searchable Campaign Selector */}
          <SearchableSelect
            label="Campaign"
            placeholder="Search campaign name or code..."
            items={campaignOptions}
            selectedId={campaignId}
            onSelect={setCampaignId}
          />

          {/* Searchable Vendor Selector */}
          <SearchableSelect
            label="Vendor"
            placeholder="Search vendor name or city..."
            items={vendorOptions}
            selectedId={vendorId}
            onSelect={setVendorId}
          />

          {/* Location Name */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Location Name / Description
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="e.g. Ring Road Billboard, Indore"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-2 text-xs text-slate-800 shadow-sm focus:border-[#A8333B] focus:outline-none focus:ring-1 focus:ring-[#A8333B]"
              />
            </div>
          </div>

          {/* Captured Date Time */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Capture Date & Time
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="datetime-local"
                value={capturedAt}
                onChange={(e) => setCapturedAt(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-2 text-xs text-slate-800 shadow-sm focus:border-[#A8333B] focus:outline-none focus:ring-1 focus:ring-[#A8333B]"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !file}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#A8333B] px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#8B2424] disabled:opacity-50 transition"
            >
              {submitting ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5" />
                  <span>Upload Proof</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
