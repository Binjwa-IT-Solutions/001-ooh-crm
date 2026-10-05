"use client";

import { Check } from "lucide-react";

export type FlowStep = 1 | 2 | 3 | 4 | 5;

interface Props {
  currentStep: FlowStep;
  hasActiveOrder: boolean;
  onSelectStep: (step: FlowStep) => void;
}

const STEPS = [
  { step: 1 as FlowStep, title: "Dashboard", subtitle: "Manage POs" },
  { step: 2 as FlowStep, title: "Create PO", subtitle: "Add Details & Items" },
  { step: 3 as FlowStep, title: "PO Details", subtitle: "Review Order" },
  { step: 4 as FlowStep, title: "Document (PDF)", subtitle: "Print & Download" },
  { step: 5 as FlowStep, title: "Payment & Tracking", subtitle: "Track Invoices" },
];

export default function FlowStepper({
  currentStep,
  hasActiveOrder,
  onSelectStep,
}: Props) {
  return (
    <div className="mb-6 overflow-x-auto rounded-2xl border border-gray-200 bg-white p-3 shadow-xs">
      <div className="flex min-w-[700px] items-center justify-between">
        {STEPS.map((s, index) => {
          const isActive = currentStep === s.step;
          const isPassed = currentStep > s.step;
          const canClick =
            s.step === 1 ||
            (s.step === 2 && currentStep >= 2) ||
            (s.step >= 3 && hasActiveOrder);

          return (
            <div key={s.step} className="flex flex-1 items-center">
              <button
                type="button"
                disabled={!canClick}
                onClick={() => canClick && onSelectStep(s.step)}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-left transition ${
                  isActive
                    ? "bg-[#FDE8E8] text-[#A8333B]"
                    : isPassed
                      ? "text-gray-900 hover:bg-gray-50"
                      : "text-gray-400 opacity-60"
                } ${canClick ? "cursor-pointer" : "cursor-not-allowed"}`}
              >
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition ${
                    isActive
                      ? "bg-[#A8333B] text-white"
                      : isPassed
                        ? "bg-emerald-600 text-white"
                        : "bg-gray-100 text-gray-500 border border-gray-200"
                  }`}
                >
                  {isPassed ? <Check className="h-4 w-4" /> : s.step}
                </div>

                <div>
                  <div
                    className={`text-xs font-bold leading-none ${
                      isActive
                        ? "text-[#A8333B]"
                        : isPassed
                          ? "text-gray-900"
                          : "text-gray-400"
                    }`}
                  >
                    {s.title}
                  </div>
                  <div className="mt-0.5 text-[10px] text-gray-400 font-medium">
                    {s.subtitle}
                  </div>
                </div>
              </button>

              {index < STEPS.length - 1 && (
                <div
                  className={`mx-2 h-0.5 flex-1 transition ${
                    currentStep > s.step ? "bg-emerald-500" : "bg-gray-200"
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
