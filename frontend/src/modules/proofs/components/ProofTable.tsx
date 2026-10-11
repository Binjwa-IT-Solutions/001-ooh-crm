"use client";

import { useEffect, useState } from "react";
import { Camera, Check, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

import ProofReviewModal from "./ProofReviewModal";
import ProofStatusBadge from "./ProofStatusBadge";

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
import type { SavedCampaignPow } from "../api";
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

function ProofImageThumbnail({
  proof,
  onClick,
}: {
  proof: Proof;
  onClick: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const imageUrl = getProofImageUrl(proof);

  useEffect(() => {
    setImgError(false);
  }, [imageUrl]);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative block h-40 w-full overflow-hidden bg-slate-100"
    >
      {imageUrl && !imgError ? (
        <img
          src={imageUrl}
          alt="Proof"
          onError={() => setImgError(true)}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-slate-100 text-slate-400">
          <Camera className="h-6 w-6 stroke-[1.5]" />
          <span className="text-[11px] font-medium">No Image Available</span>
        </div>
      )}
    </button>
  );
}

function CampaignPowMessageCard({
  savedPow,
  campaign,
}: {
  savedPow?: SavedCampaignPow | null;
  campaign?: Campaign | null;
}) {
  const status =
    savedPow?.status ||
    (campaign?.status === "Rejected" ? "Rejected" : "Complete");
  const isComplete = status === "Complete";
  const isRejected = status === "Rejected";
  const code = savedPow?.campaignCode || campaign?.campaignCode;
  const name = savedPow?.campaignName || campaign?.name || "Campaign";
  const message =
    savedPow?.message ||
    (isComplete
      ? "Campaign status has been saved as Complete for this campaign's POW."
      : isRejected
      ? "Campaign status has been saved as Rejected for this campaign's POW."
      : "Campaign status has been saved for this campaign's POW.");

  return (
    <div
      className={`rounded-xl border p-4 shadow-xs transition ${
        isComplete
          ? "border-emerald-200 bg-[#EAFBF3]"
          : isRejected
          ? "border-rose-200 bg-rose-50"
          : "border-blue-200 bg-blue-50"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg shadow-xs ${
            isComplete
              ? "bg-[#009A55] text-white"
              : isRejected
              ? "bg-rose-600 text-white"
              : "bg-blue-600 text-white"
          }`}
        >
          {isComplete ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : isRejected ? (
            <XCircle className="h-5 w-5" />
          ) : (
            <AlertCircle className="h-5 w-5" />
          )}
        </div>

        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-xs font-bold text-white shadow-xs ${
                isComplete
                  ? "bg-[#009A55]"
                  : isRejected
                  ? "bg-rose-600"
                  : "bg-blue-600"
              }`}
            >
              {isComplete
                ? "✓ Campaign Complete"
                : isRejected
                ? "✕ Campaign Rejected"
                : `Campaign Status: ${status}`}
            </span>
            {code && (
              <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-700">
                Code: {code}
              </span>
            )}
            <span className="text-xs font-bold text-slate-900">
              {name}
            </span>
          </div>

          <p className="mt-1 text-xs text-slate-600">
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}

interface Props {
  proofs: Proof[];
  loading: boolean;
  campaigns?: Campaign[];
  vendors?: Vendor[];
  savedCampaignPows?: SavedCampaignPow[];
  savedCampaignPow?: SavedCampaignPow | null;
  activeCampaign?: Campaign | null;
  isCampaignPowActive?: boolean;
  onApprove: (
    id: string
  ) => Promise<void>;

  onComplete: (
    id: string
  ) => Promise<void>;

  onReject: (
    id: string,
    reason: string
  ) => Promise<void>;
}

export default function ProofTable({
  proofs,
  loading,
  campaigns,
  vendors,
  savedCampaignPows,
  savedCampaignPow,
  activeCampaign,
  isCampaignPowActive,
  onApprove,
  onComplete,
  onReject,
}: Props) {
  const [selected, setSelected] =
    useState<Proof | null>(null);
  const [actionId, setActionId] =
    useState<string | null>(null);

  if (loading) {
    return (
      <div className="rounded-xl border border-[#F9DADA] p-8 text-center text-sm text-gray-500">
        Loading proofs...
      </div>
    );
  }

  const allPows =
    savedCampaignPows && savedCampaignPows.length > 0
      ? savedCampaignPows
      : savedCampaignPow
      ? [savedCampaignPow]
      : [];

  // 1. Campaign POW Tab View (ONLY Campaign POW cards, NEVER all proofs)
  if (isCampaignPowActive) {
    if (allPows.length === 0 && !activeCampaign) {
      return (
        <div className="rounded-xl border border-[#F9DADA] bg-white p-10 text-center">
          <p className="font-semibold text-[#8B2424]">
            No Campaign POW records found
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Go to Campaigns and click &quot;Update POW&quot; on any campaign to save and view it here.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {allPows.length > 0
          ? allPows.map((item) => (
              <CampaignPowMessageCard key={item._id} savedPow={item} />
            ))
          : activeCampaign && (
              <CampaignPowMessageCard campaign={activeCampaign} />
            )}
      </div>
    );
  }

  // 2. All Proofs / Filtered Proofs Empty State
  if (!proofs.length) {
    return (
      <div className="rounded-xl border border-[#F9DADA] bg-white p-10 text-center">
        <p className="font-semibold text-[#8B2424]">
          No proofs found
        </p>

        <p className="mt-1 text-sm text-gray-500">
          There are no proof records to display.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {proofs.map((proof) => (
          <div
            key={proof._id}
            className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
          >
            {/* Image Thumbnail */}
            <ProofImageThumbnail
              proof={proof}
              onClick={() => setSelected(proof)}
            />

            {/* Details Card */}
            <div className="flex flex-1 flex-col p-3.5">
              <div className="mb-2.5 flex items-center justify-between">
                <span className="text-xs font-bold text-[#8B2424]">
                  Proof
                </span>

                <ProofStatusBadge
                  status={proof.status}
                />
              </div>

              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-400">
                    Location
                  </span>

                  <span className="truncate text-right font-medium text-slate-800 max-w-[170px]">
                    <ProofLocationCell
                      locationName={proof.locationName}
                      lat={proof.gps?.lat}
                      lng={proof.gps?.lng}
                    />
                  </span>
                </div>

                <div className="flex justify-between gap-2">
                  <span className="text-slate-400">
                    Campaign
                  </span>

                  <span
                    className="truncate text-right font-medium text-slate-800 max-w-[170px]"
                    title={getCampaignDisplayName(proof.campaignId, campaigns)}
                  >
                    {getCampaignDisplayName(proof.campaignId, campaigns)}
                  </span>
                </div>

                <div className="flex justify-between gap-2">
                  <span className="text-slate-400">
                    Vendor
                  </span>

                  <span
                    className="truncate text-right font-medium text-slate-800 max-w-[170px]"
                    title={getVendorDisplayName(proof.vendorId, vendors)}
                  >
                    {getVendorDisplayName(proof.vendorId, vendors)}
                  </span>
                </div>

                <div className="flex justify-between gap-2">
                  <span className="text-slate-400">
                    Captured
                  </span>

                  <span className="text-right text-slate-700">
                    {formatDate(
                      proof.capturedAt
                    )}
                  </span>
                </div>
              </div>

              {proof.status ===
                "Rejected" &&
                proof.rejectionReason && (
                  <div className="mt-2.5 rounded-lg bg-rose-50 p-2 border border-rose-100">
                    <p className="text-[10px] font-bold text-rose-800 uppercase tracking-wider">
                      Rejection Reason
                    </p>

                    <p className="mt-0.5 text-[11px] text-rose-700 line-clamp-2">
                      {proof.rejectionReason}
                    </p>
                  </div>
                )}

              {/* Status Message / Action Buttons */}
              {proof.status === "Complete" ? (
                <div className="mt-3.5 flex items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-[#EAFBF3] px-3 py-2 text-xs font-bold text-emerald-800 shadow-xs">
                  <CheckCircle2 className="h-4 w-4 text-[#009A55] shrink-0" />
                  <span>Campaign Complete</span>
                </div>
              ) : proof.status === "Rejected" ? (
                <div className="mt-3.5 flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800 shadow-xs">
                  <XCircle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>Campaign Reject</span>
                </div>
              ) : (
                <div className="mt-3.5 flex gap-1.5 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={actionId === proof._id || proof.status === "Approved"}
                    onClick={async () => {
                      try {
                        setActionId(proof._id);
                        await onApprove(proof._id);
                      } finally {
                        setActionId(null);
                      }
                    }}
                    className={`flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold shadow-xs transition active:scale-[0.98] disabled:opacity-60 ${
                      proof.status === "Approved"
                        ? "bg-blue-800 text-white cursor-default"
                        : "bg-blue-600 hover:bg-blue-700 text-white"
                    }`}
                  >
                    <Check className="h-3 w-3" />
                    {actionId === proof._id ? "..." : proof.status === "Approved" ? "Approved" : "Approve"}
                  </button>

                  <button
                    type="button"
                    disabled={actionId === proof._id}
                    onClick={async () => {
                      try {
                        setActionId(proof._id);
                        await onComplete(proof._id);
                      } finally {
                        setActionId(null);
                      }
                    }}
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-600 px-2 py-1.5 text-[11px] font-semibold text-white shadow-xs transition hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    {actionId === proof._id ? "..." : "Complete"}
                  </button>

                  <button
                    type="button"
                    disabled={actionId === proof._id}
                    onClick={() => setSelected(proof)}
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-rose-600 px-2 py-1.5 text-[11px] font-semibold text-white shadow-xs transition hover:bg-rose-700 active:scale-[0.98] disabled:opacity-60"
                  >
                    <XCircle className="h-3 w-3" />
                    Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <ProofReviewModal
          proof={selected}
          campaigns={campaigns}
          vendors={vendors}
          onClose={() =>
            setSelected(null)
          }
          onApprove={async () => {
            await onApprove(
              selected._id
            );

            setSelected(null);
          }}
          onComplete={async () => {
            await onComplete(
              selected._id
            );

            setSelected(null);
          }}
          onReject={async (reason) => {
            await onReject(
              selected._id,
              reason
            );

            setSelected(null);
          }}
        />
      )}
    </>
  );
}