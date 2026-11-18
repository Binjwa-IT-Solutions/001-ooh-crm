'use client';

import React, { useRef } from 'react';
import { Trash2, RefreshCw, Plus } from 'lucide-react';

export interface SignatureInputProps {
  signatureImage?: string;
  signatoryName?: string;
  signatoryDesignation?: string;
  onChange: (data: {
    signatureImage?: string;
    signatoryName?: string;
    signatoryDesignation?: string;
  }) => void;
  className?: string;
}

export function SignatureInput({
  signatureImage,
  signatoryName,
  signatoryDesignation,
  onChange,
  className = '',
}: SignatureInputProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (PNG, JPG, SVG, WebP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const result = uploadEvent.target?.result as string;
      if (result) {
        onChange({
          signatureImage: result,
          signatoryName,
          signatoryDesignation,
        });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function handleRemove() {
    onChange({
      signatureImage: undefined,
      signatoryName,
      signatoryDesignation,
    });
  }

  function handleChangeClick() {
    fileInputRef.current?.click();
  }

  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png, image/jpeg, image/jpg, image/svg+xml, image/webp"
        onChange={handleFileUpload}
        className="hidden"
      />

      {signatureImage ? (
        <div className="flex flex-col items-center">
          {/* Dashed Border Container with Signature Image (Compact) */}
          <div className="w-36 h-16 rounded border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-1.5 flex items-center justify-center overflow-hidden shadow-2xs">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={signatureImage}
              alt="Signature / Stamp"
              className="max-h-full max-w-full object-contain filter dark:invert-0 select-none pointer-events-none"
            />
          </div>

          {/* Action Links: Remove & Change */}
          <div className="mt-1.5 flex items-center justify-center gap-3 text-[11px] font-semibold select-none">
            <button
              type="button"
              onClick={handleRemove}
              className="inline-flex items-center gap-1 text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 transition"
            >
              <Trash2 className="w-3 h-3" />
              <span>Remove</span>
            </button>
            <button
              type="button"
              onClick={handleChangeClick}
              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Change</span>
            </button>
          </div>
        </div>
      ) : (
        /* Empty State: Small Compact Dashed Box */
        <div
          onClick={handleChangeClick}
          className="w-36 h-16 rounded border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 hover:bg-slate-100/50 dark:bg-slate-900/30 dark:hover:bg-slate-900/70 hover:border-[#6A1B21]/60 transition flex flex-col items-center justify-center cursor-pointer p-1 text-center group shadow-2xs"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleChangeClick();
            }
          }}
        >
          <div className="w-5 h-5 rounded-full bg-[#6A1B21]/10 text-[#6A1B21] flex items-center justify-center mb-0.5 group-hover:scale-110 transition">
            <Plus className="w-3 h-3" />
          </div>
          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 group-hover:text-[#6A1B21] transition">
            + Add Signature
          </span>
          <span className="text-[9px] text-slate-400">
            Upload stamp / sign
          </span>
        </div>
      )}
    </div>
  );
}
