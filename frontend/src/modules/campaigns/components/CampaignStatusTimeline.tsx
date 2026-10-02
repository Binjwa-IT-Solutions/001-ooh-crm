"use client";

import type { Campaign } from "../types";

interface Props {
  status: Campaign["status"];
  campaignName?: string;
  campaignCode?: string;
}

const steps = [
  {
    key: "Draft",
    label: "Draft",
  },
  {
    key: "Campaign Live",
    label: "Campaign Live",
  },
  {
    key: "Campaign End",
    label: "Campaign End",
  },
] as const;

function getStepIndex(status: string): number {
  if (status === "Draft" || status === "Approved") return 0;
  if (status === "Campaign Live" || status === "InProgress" || status === "In Progress") return 1;
  if (status === "Campaign End" || status === "Completed" || status === "Complete") return 2;
  return 0;
}

function getDisplayStatus(status: string): string {
  if (status === "Campaign End" || status === "Completed" || status === "Complete") return "Campaign End (Lifecycle Complete)";
  if (status === "Rejected" || status === "Cancelled") return "Campaign Rejected";
  if (status === "InProgress" || status === "In Progress") return "Campaign Live";
  return status;
}

export default function CampaignStatusTimeline({
  status,
  campaignName,
  campaignCode,
}: Props) {
  const isRejected = status === "Rejected" || status === "Cancelled";
  const isEnded = status === "Campaign End" || status === "Completed" || status === "Complete";

  if (isRejected) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-100 text-xl font-bold text-rose-600">
              ✕
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-rose-900">
                  Campaign Rejected
                </h2>
                {campaignCode && (
                  <span className="rounded-md bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">
                    {campaignCode}
                  </span>
                )}
              </div>

              <p className="mt-1 text-sm text-rose-600">
                {campaignName
                  ? `${campaignName} is rejected and no longer active.`
                  : "This campaign is rejected and no longer active."}
              </p>
            </div>
          </div>

          <span className="inline-flex items-center rounded-full bg-rose-100 px-3.5 py-1 text-xs font-bold text-rose-700">
            Campaign Rejected
          </span>
        </div>
      </div>
    );
  }

  const currentIndex = getStepIndex(status);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-gray-900">
              Campaign Lifecycle
            </h2>
            {campaignCode && (
              <span className="rounded-md bg-[#F9DADA] px-2 py-0.5 text-xs font-bold text-[#8B2424]">
                {campaignCode}
              </span>
            )}
          </div>

          <p className="mt-1 text-sm text-gray-500">
            {campaignName
              ? `Tracking: ${campaignName}`
              : "Track the current campaign status."}
          </p>
        </div>

        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${
            isEnded
              ? "bg-emerald-100 text-emerald-800"
              : "bg-[#F9DADA] text-[#8B2424]"
          }`}
        >
          Status: {getDisplayStatus(status)}
        </span>
      </div>

      {/* Lifecycle Complete Banner when Campaign End */}
      {isEnded && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-emerald-950 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-base font-bold text-emerald-700">
              ✓
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-900">Lifecycle Complete</p>
              <p className="mt-0.5 text-xs text-emerald-700">
                {campaignName
                  ? `${campaignName} has reached Campaign End. The campaign lifecycle is now complete.`
                  : "Campaign has reached Campaign End. The campaign lifecycle is now complete."}
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
            <span>✓</span>
            <span>Lifecycle Complete</span>
          </span>
        </div>
      )}

      {/* Stepper (3 Steps: Draft -> Campaign Live -> Campaign End) */}
      <div className="overflow-x-auto">
        <div className="flex min-w-[500px] items-start">
          {steps.map((step, index) => {
            const completed = index <= currentIndex;
            const current = index === currentIndex;

            return (
              <div key={step.key} className="flex flex-1 items-start">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold transition ${
                      completed
                        ? isEnded
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-[#8B2424] bg-[#8B2424] text-[#F9DADA]"
                        : "border-gray-300 bg-white text-gray-400"
                    } ${
                      current && !isEnded
                        ? "ring-4 ring-[#F9DADA]"
                        : current && isEnded
                          ? "ring-4 ring-emerald-100"
                          : ""
                    }`}
                  >
                    {completed && (index < currentIndex || isEnded) ? (
                      <span className="text-sm">✓</span>
                    ) : (
                      index + 1
                    )}
                  </div>

                  <span
                    className={`mt-2 whitespace-nowrap text-xs font-medium ${
                      completed
                        ? isEnded
                          ? "font-semibold text-emerald-700"
                          : "font-semibold text-[#8B2424]"
                        : "text-gray-500"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>

                {index < steps.length - 1 && (
                  <div
                    className={`mt-5 h-0.5 flex-1 transition ${
                      index < currentIndex
                        ? isEnded
                          ? "bg-emerald-600"
                          : "bg-[#8B2424]"
                        : "bg-gray-200"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer message when Lifecycle is complete */}
      {isEnded && (
        <div className="mt-5 flex items-center justify-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50/80 py-2.5 px-4 text-xs font-semibold text-emerald-800">
          <span className="text-emerald-600 font-bold">✓</span>
          <span>Lifecycle Complete — All campaign stages have finished successfully.</span>
        </div>
      )}
    </div>
  );
}