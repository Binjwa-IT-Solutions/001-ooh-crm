"use client";

import { useEffect, useState } from "react";
import { Check, CheckCircle2, XCircle } from "lucide-react";

import {
  formatDate,
  formatDistance,
  formatGps,
  getLocationName,
  getProofImageUrl,
  getCampaignDisplayName,
  getVendorDisplayName,
} from "../format";

import type { Proof } from "../types";
import type { Campaign } from "@/modules/campaigns/types";
import type { Vendor } from "@/modules/vendors/types";

function ProofLocationCell({
  locationName,
  lat,
  lng,
}: {
  locationName?: string;
  lat?: number;
  lng?: number;
}) {
  const [name, setName] = useState<string>(locationName || "");

  useEffect(() => {
    if (locationName) {
      setName(locationName);
      return;
    }
    if (lat === undefined || lng === undefined) return;
    let active = true;
    getLocationName(lat, lng).then((res) => {
      if (active) setName(res);
    });
    return () => {
      active = false;
    };
  }, [locationName, lat, lng]);

  if (!name && (lat === undefined || lng === undefined)) return <span>-</span>;
  return (
    <span title={name || formatGps(lat, lng)}>
      {name || formatGps(lat, lng)}
    </span>
  );
}

interface Props {
  proof: Proof;
  campaigns?: Campaign[];
  vendors?: Vendor[];

  onClose: () => void;

  onApprove: () => Promise<void>;

  onComplete: () => Promise<void>;

  onReject: (
    reason: string
  ) => Promise<void>;
}

export default function ProofReviewModal({
  proof,
  campaigns,
  vendors,
  onClose,
  onApprove,
  onComplete,
  onReject,
}: Props) {
  const [reason, setReason] = useState("");
  const [rejectError, setRejectError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleReject = async () => {
    if (reason.trim().length < 10) {
      setRejectError("Please enter a rejection reason (minimum 10 characters)");
      return;
    }

    try {
      setSaving(true);
      setRejectError("");
      await onReject(reason.trim());
    } catch (err: any) {
      setRejectError(err?.message || "Failed to reject proof");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">

      <div className="max-h-[95vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#F9DADA] px-5 py-4">

          <div>
            <h2 className="font-semibold text-[#8B2424]">
              Proof Review
            </h2>

            <p className="text-xs text-gray-500">
              Review watermarked proof
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-xl text-gray-500 hover:text-[#8B2424]"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 gap-5 p-5 lg:grid-cols-2">

          {/* Image */}
          <div className="flex min-h-[300px] items-center justify-center overflow-hidden rounded-xl bg-slate-100">
            {getProofImageUrl(proof) ? (
              <img
                src={getProofImageUrl(proof)}
                alt="Proof"
                className="max-h-[650px] w-full object-contain"
              />
            ) : (
              <div className="flex h-64 w-full items-center justify-center text-sm text-gray-400">
                No Image Available
              </div>
            )}
          </div>

          {/* Details */}
          <div>

            <div className="rounded-xl border border-[#F9DADA] p-4">

              <h3 className="mb-4 font-semibold text-[#8B2424]">
                Proof Details
              </h3>

              <div className="space-y-3 text-sm">

                <div>
                  <p className="text-xs text-gray-500">
                    Location
                  </p>

                  <p className="font-medium text-gray-800">
                    <ProofLocationCell
                      locationName={proof.locationName}
                      lat={proof.gps?.lat}
                      lng={proof.gps?.lng}
                    />
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">
                    Campaign
                  </p>

                  <p className="font-medium text-gray-800">
                    {getCampaignDisplayName(proof.campaignId, campaigns)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">
                    Vendor
                  </p>

                  <p className="font-medium text-gray-800">
                    {getVendorDisplayName(proof.vendorId, vendors)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">
                    Captured At
                  </p>

                  <p className="font-medium">
                    {formatDate(
                      proof.capturedAt
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">
                    Device
                  </p>

                  <p className="break-all text-xs">
                    {proof.deviceInfo ||
                      "-"}
                  </p>
                </div>
              </div>
            </div>

            {/* Reject reason input (only if not Complete or Rejected) */}
            {proof.status !== "Complete" && proof.status !== "Rejected" && (
              <div className="mt-4 rounded-xl border border-[#F9DADA] p-4">
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-semibold text-[#8B2424]">
                    Rejection Reason
                  </label>
                  <span className="text-[11px] text-gray-400">
                    {reason.trim().length}/10 chars min
                  </span>
                </div>

                {/* Quick preset chips */}
                <div className="mb-2.5 flex flex-wrap gap-1.5">
                  {[
                    "Photo is blurry or unclear",
                    "Incorrect location or hoarding",
                    "Poor lighting or bad angle",
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setReason(preset);
                        setRejectError("");
                      }}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700 transition hover:bg-slate-100 hover:border-slate-300"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>

                <textarea
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    if (e.target.value.trim().length >= 10) {
                      setRejectError("");
                    }
                  }}
                  rows={3}
                  placeholder="Enter reason for rejection or click a preset above..."
                  className="w-full rounded-lg border border-gray-200 p-2.5 text-xs outline-none focus:border-[#A8333B]"
                />

                {rejectError && (
                  <p className="mt-1 text-xs font-medium text-rose-600">
                    ⚠ {rejectError}
                  </p>
                )}
              </div>
            )}

            {/* Status Message / Action Buttons */}
            {proof.status === "Complete" ? (
              <div className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-[#EAFBF3] py-3.5 px-4 text-sm font-bold text-emerald-800 shadow-sm">
                <CheckCircle2 className="h-5 w-5 text-[#009A55] shrink-0" />
                <span>Campaign Complete</span>
              </div>
            ) : proof.status === "Rejected" ? (
              <div className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 py-3.5 px-4 text-sm font-bold text-rose-800 shadow-sm">
                <XCircle className="h-5 w-5 text-rose-600 shrink-0" />
                <span>Campaign Reject</span>
              </div>
            ) : (
              <div className="mt-5 flex flex-wrap gap-2 sm:gap-3">
                <button
                  type="button"
                  disabled={saving || proof.status === "Approved"}
                  onClick={async () => {
                    try {
                      setSaving(true);
                      setRejectError("");
                      await onApprove();
                    } catch (err: any) {
                      setRejectError(err?.message || "Failed to approve proof");
                    } finally {
                      setSaving(false);
                    }
                  }}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-3 text-xs sm:text-sm font-semibold shadow-sm transition active:scale-[0.98] disabled:opacity-60 ${
                    proof.status === "Approved"
                      ? "bg-blue-800 text-white cursor-default"
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                  }`}
                >
                  <Check className="h-4 w-4" />
                  {saving ? "Saving..." : proof.status === "Approved" ? "Approved ✓" : "Approve"}
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={async () => {
                    try {
                      setSaving(true);
                      setRejectError("");
                      await onComplete();
                    } catch (err: any) {
                      setRejectError(err?.message || "Failed to complete proof");
                    } finally {
                      setSaving(false);
                    }
                  }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-3 text-xs sm:text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {saving ? "Saving..." : "Complete"}
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={handleReject}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-3 py-3 text-xs sm:text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 active:scale-[0.98] disabled:opacity-60"
                >
                  <XCircle className="h-4 w-4" />
                  {saving ? "Rejecting..." : "Reject"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}