"use client";

import React from "react";
import { Check } from "lucide-react";

export type QuotationFlowStep = 1 | 2 | 3 | 4 | 5;

interface Props {
  currentStep: QuotationFlowStep;
  hasActiveQuote: boolean;
  onSelectStep: (step: QuotationFlowStep) => void;
}

const STEPS = [
  { step: 1 as QuotationFlowStep, title: "Dashboard", subtitle: "Manage Quotes" },
  { step: 2 as QuotationFlowStep, title: "Create Proposal", subtitle: "Sites, Rates & T&C" },
  { step: 3 as QuotationFlowStep, title: "Quote Details", subtitle: "Review & Status" },
  { step: 4 as QuotationFlowStep, title: "Document (PDF)", subtitle: "Print & Download" },
  { step: 5 as QuotationFlowStep, title: "Campaign & Tracking", subtitle: "Convert & Track" },
];

export default function QuotationFlowStepper({
  currentStep,
  hasActiveQuote,
  onSelectStep,
}: Props) {
  return (
    <div className="mb-6 overflow-x-auto rounded-2xl border border-gray-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <div className="flex min-w-[700px] items-center justify-between">
        {STEPS.map((s, index) => {
          const isActive = currentStep === s.step;
          const isPassed = currentStep > s.step;
          const canClick =
            s.step === 1 ||
            (s.step === 2 && currentStep >= 2) ||
            (s.step >= 3 && hasActiveQuote);

          return (
            <div key={s.step} className="flex flex-1 items-center">
              <button
                type="button"
                disabled={!canClick}
                onClick={() => canClick && onSelectStep(s.step)}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-left transition ${
                  isActive
                    ? "bg-[#FDE8E8] text-[#8B2424] dark:bg-rose-950/40 dark:text-rose-300 font-semibold"
                    : isPassed
                      ? "text-gray-900 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-slate-800"
                      : "text-gray-400 opacity-60"
                } ${canClick ? "cursor-pointer" : "cursor-not-allowed"}`}
              >
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition ${
                    isActive
                      ? "bg-[#8B2424] text-white shadow-2xs"
                      : isPassed
                        ? "bg-emerald-600 text-white"
                        : "bg-gray-100 text-gray-500 border border-gray-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400"
                  }`}
                >
                  {isPassed ? <Check className="h-4 w-4" /> : s.step}
                </div>

                <div>
                  <div
                    className={`text-xs font-bold leading-none ${
                      isActive
                        ? "text-[#8B2424] dark:text-rose-300"
                        : isPassed
                          ? "text-gray-900 dark:text-gray-100"
                          : "text-gray-400 dark:text-gray-500"
                    }`}
                  >
                    {s.title}
                  </div>
                  <div className="mt-0.5 text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                    {s.subtitle}
                  </div>
                </div>
              </button>

              {index < STEPS.length - 1 && (
                <div
                  className={`mx-2 h-0.5 flex-1 transition ${
                    currentStep > s.step ? "bg-emerald-500" : "bg-gray-200 dark:bg-slate-800"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
