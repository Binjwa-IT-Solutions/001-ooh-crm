"use client";

import { useEffect, useState } from "react";
import { Camera, Check, CheckCircle2, XCircle } from "lucide-react";

import ProofReviewModal from "./ProofReviewModal";
import ProofStatusBadge from "./ProofStatusBadge";

import {
  formatDate,
  formatDistance,
  formatGps,
  getLocationName,
  getProofImageUrl,
} from "../format";

import type { Proof } from "../types";

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

interface Props {
  proofs: Proof[];
  loading: boolean;
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
                    title={
                      typeof proof.campaignId === "object"
                        ? `${proof.campaignId.name}${proof.campaignId.campaignCode ? ` (${proof.campaignId.campaignCode})` : ""}`
                        : proof.campaignId
                        ? String(proof.campaignId)
                        : "Not Assigned"
                    }
                  >
                    {typeof proof.campaignId === "object"
                      ? proof.campaignId.name
                      : proof.campaignId
                      ? String(proof.campaignId)
                      : <span className="text-slate-400 italic">Not Assigned</span>}
                  </span>
                </div>

                <div className="flex justify-between gap-2">
                  <span className="text-slate-400">
                    Vendor
                  </span>

                  <span
                    className="truncate text-right font-medium text-slate-800 max-w-[170px]"
                    title={
                      typeof proof.vendorId === "object"
                        ? proof.vendorId.name || proof.vendorId.companyName || "Vendor"
                        : proof.vendorId
                        ? String(proof.vendorId)
                        : "Not Assigned"
                    }
                  >
                    {typeof proof.vendorId === "object"
                      ? proof.vendorId.name || proof.vendorId.companyName || "Vendor"
                      : proof.vendorId
                      ? String(proof.vendorId)
                      : <span className="text-slate-400 italic">Not Assigned</span>}
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

              {/* Action Buttons */}
              {(!proof.status || proof.status === "Pending") && (
                <div className="mt-3.5 flex gap-1.5 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={actionId === proof._id}
                    onClick={async () => {
                      try {
                        setActionId(proof._id);
                        await onApprove(proof._id);
                      } finally {
                        setActionId(null);
                      }
                    }}
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-blue-600 px-2 py-1.5 text-[11px] font-semibold text-white shadow-xs transition hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50"
                  >
                    <Check className="h-3 w-3" />
                    {actionId === proof._id ? "..." : "Approve"}
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
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-600 px-2 py-1.5 text-[11px] font-semibold text-white shadow-xs transition hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    {actionId === proof._id ? "..." : "Complete"}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setSelected(proof)
                    }
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-rose-600 px-2 py-1.5 text-[11px] font-semibold text-white shadow-xs transition hover:bg-rose-700 active:scale-[0.98]"
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