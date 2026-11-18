"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, AlertTriangle, RefreshCw, Camera, ShieldCheck } from "lucide-react";

import ProofForm from "@/modules/proofs/components/ProofForm";
import { validateProofLink, createProof } from "@/modules/proofs/api";
import type { CreateProofData } from "@/modules/proofs/types";

export default function PublicProofCapturePage() {
  const params = useParams<{ token?: string | string[] }>();
  const token = Array.isArray(params?.token)
    ? params.token[0]
    : params?.token ?? "";

  const [loading, setLoading] = useState(Boolean(token));
  const [valid, setValid] = useState(false);
  const [errorMessage, setErrorMessage] = useState(
    !token ? "No proof token provided in URL." : ""
  );
  const [uses, setUses] = useState(0);
  const [linkCampaign, setLinkCampaign] = useState<{ _id: string; name: string; campaignCode?: string } | null>(null);
  const [linkVendor, setLinkVendor] = useState<{ _id: string; name?: string; companyName?: string; contactPersonName?: string } | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const validateToken = (currentToken: string) => {
    validateProofLink(currentToken)
      .then((res) => {
        if (res.valid) {
          setValid(true);
          setUses(res.uses ?? 0);
          setLinkCampaign(res.campaign || null);
          setLinkVendor(res.vendor || null);
        } else {
          setValid(false);
          setErrorMessage(
            res.message ||
              "This proof link has expired or is no longer active."
          );
        }
      })
      .catch((err: unknown) => {
        setValid(false);
        const message =
          err && typeof err === "object" && "response" in err
            ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
            : err instanceof Error
            ? err.message
            : "Unable to verify proof link. Please check your internet connection and try again.";
        setErrorMessage(
          message ||
            "Unable to verify proof link. Please check your internet connection and try again."
        );
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (!token) return;
    validateToken(token);
  }, [token]);

  const handleCheckAgain = () => {
    setLoading(true);
    setErrorMessage("");
    validateToken(token);
  };

  const handleSubmit = async (data: CreateProofData) => {
    setSubmitError("");
    setSubmitting(true);

    try {
      await createProof({
        ...data,
        token,
      });

      setUses((prev) => prev + 1);
      setSubmitSuccess(true);
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : err instanceof Error
          ? err.message
          : "Failed to submit proof. Please check your location and try again.";
      setSubmitError(message || "Failed to submit proof. Please check your location and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCaptureAnother = () => {
    setSubmitSuccess(false);
    setSubmitError("");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3.5 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#A8333B] text-white shadow-sm">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <span className="block text-xs font-bold uppercase tracking-wider text-[#8B2424]">
                Media Octus
              </span>
              <h1 className="text-sm font-semibold text-slate-800">
                Proof of Work Capture
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 border border-emerald-200">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span>Secure GPS</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-lg px-4 py-6">
        {/* Loading State */}
        {loading && (
          <div className="flex min-h-[50vh] flex-col items-center justify-center py-12 text-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[#A8333B]" />
            <p className="mt-4 text-sm font-medium text-slate-600">
              Verifying proof link...
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Please wait a moment while we validate your access token.
            </p>
          </div>
        )}

        {/* Invalid or Expired Token */}
        {!loading && !valid && (
          <div className="mt-8 rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600">
              <AlertTriangle className="h-7 w-7" />
            </div>

            <h2 className="mt-4 text-lg font-bold text-slate-900">
              Link Unavailable
            </h2>

            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              {errorMessage ||
                "This proof submission link is invalid or inactive."}
            </p>

            <div className="mt-6 rounded-xl bg-slate-50 p-4 text-left border border-slate-100">
              <p className="text-xs font-semibold text-slate-700">Need Help?</p>
              <p className="mt-1 text-xs text-slate-500">
                Please contact your campaign coordinator to generate a new proof link.
              </p>
            </div>

            <button
              type="button"
              onClick={handleCheckAgain}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Check Again
            </button>
          </div>
        )}

        {/* Valid Token - Submission Success Screen */}
        {!loading && valid && submitSuccess && (
          <div className="rounded-2xl border border-emerald-200 bg-white p-6 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-10 w-10" />
            </div>

            <h2 className="mt-4 text-xl font-bold text-slate-900">
              Proof Photo Submitted!
            </h2>

            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Your photo and location details have been securely recorded in the CRM.
            </p>

            <div className="mt-5 rounded-xl bg-slate-50 p-3.5 border border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <span className="font-medium">Total Photos Submitted:</span>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-bold text-emerald-800">
                {uses}
              </span>
            </div>

            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={handleCaptureAnother}
                className="w-full rounded-xl bg-[#A8333B] py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#8B2424] flex items-center justify-center gap-2"
              >
                <Camera className="h-4 w-4" />
                <span>Capture Another Photo</span>
              </button>
            </div>
          </div>
        )}

        {/* Valid Token - Capture Form */}
        {!loading && valid && !submitSuccess && (
          <div>
            {/* Campaign & Vendor Assigned Info */}
            {(linkCampaign || linkVendor) && (
              <div className="mb-4 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm text-xs space-y-1">
                {linkCampaign && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Campaign</span>
                    <span className="font-semibold text-slate-800">
                      {linkCampaign.name}
                      {linkCampaign.campaignCode ? ` (${linkCampaign.campaignCode})` : ""}
                    </span>
                  </div>
                )}
                {linkVendor && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Vendor</span>
                    <span className="font-semibold text-slate-800">
                      {linkVendor.companyName || linkVendor.name || "Assigned Vendor"}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Status indicator if photos already submitted */}
            {uses > 0 && (
              <div className="mb-4 flex items-center justify-between rounded-xl bg-white px-4 py-2.5 text-xs text-slate-600 shadow-sm border border-slate-200">
                <span className="font-medium text-slate-700">
                  Photos Submitted this Session
                </span>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                  {uses} submitted
                </span>
              </div>
            )}

            {/* Error Banner if submission failed */}
            {submitError && (
              <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span className="font-semibold">{submitError}</span>
                </div>
              </div>
            )}

            {/* Proof Form */}
            <ProofForm
              token={token}
              isPublic={true}
              submitting={submitting}
              onSubmit={handleSubmit}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
        Media Octus OOH Campaign Execution &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
