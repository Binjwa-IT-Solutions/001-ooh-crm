"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Search, ChevronDown, Check, X, MapPin } from "lucide-react";

export interface SiteOption {
  _id: string;
  atrNo?: string;
  code?: string;
  siteCode?: string;
  name?: string;
  location?: string;
  city?: string;
  state?: string;
  mediaType?: string;
  type?: string;
  baseCostPerDay?: number;
  ratePerDay?: number;
  sizeWidth?: number;
  sizeHeight?: number;
  width?: number;
  height?: number;
  address?: string;
  vendorName?: string;
}

interface SiteComboboxProps {
  sites: SiteOption[];
  selectedSiteId: string;
  onSelect: (siteId: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function formatSiteLabel(site?: SiteOption): string {
  if (!site) return "";
  const code = site.atrNo || site.siteCode || site.code || "";
  const loc = site.location || site.name || "";
  const city = site.city || "";
  if (code && loc) return `${code} - ${loc}${city ? ` (${city})` : ""}`;
  if (code) return `${code}${city ? ` (${city})` : ""}`;
  if (loc) return `${loc}${city ? ` (${city})` : ""}`;
  return `Media Site ${city ? `(${city})` : ""}`;
}

export default function SiteCombobox({
  sites,
  selectedSiteId,
  onSelect,
  placeholder = "Search media site / hoarding...",
  disabled = false,
}: SiteComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedSite = useMemo(() => {
    return sites.find((s) => s._id === selectedSiteId);
  }, [sites, selectedSiteId]);

  // Outside click listener
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter sites
  const filteredSites = useMemo(() => {
    if (!searchTerm.trim()) return sites;
    const q = searchTerm.toLowerCase();
    return sites.filter((s) => {
      const code = (s.atrNo || s.siteCode || s.code || "").toLowerCase();
      const loc = (s.location || s.name || "").toLowerCase();
      const city = (s.city || "").toLowerCase();
      const state = (s.state || "").toLowerCase();
      const type = (s.mediaType || s.type || "").toLowerCase();
      const vendor = (s.vendorName || "").toLowerCase();
      return (
        code.includes(q) ||
        loc.includes(q) ||
        city.includes(q) ||
        state.includes(q) ||
        type.includes(q) ||
        vendor.includes(q)
      );
    });
  }, [sites, searchTerm]);

  function handleOpen() {
    if (disabled) return;
    setIsOpen(true);
    setSearchTerm("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleChoose(id: string) {
    onSelect(id);
    setIsOpen(false);
    setSearchTerm("");
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onSelect("");
    setSearchTerm("");
  }

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger Button / Display */}
      {!isOpen ? (
        <div
          onClick={handleOpen}
          className={`flex h-9 w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-2.5 text-xs transition cursor-pointer dark:border-slate-800 dark:bg-slate-900 ${
            disabled
              ? "opacity-50 cursor-not-allowed"
              : "hover:border-[#8B2424] focus:border-[#8B2424] dark:hover:border-rose-800"
          } ${selectedSite ? "border-rose-200 bg-rose-50/20 dark:border-rose-950" : ""}`}
        >
          {selectedSite ? (
            <div className="flex items-center gap-1.5 truncate">
              {(selectedSite.atrNo || selectedSite.siteCode) && (
                <span className="rounded bg-rose-100/70 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#8B2424] dark:bg-rose-950 dark:text-rose-300 shrink-0">
                  {selectedSite.atrNo || selectedSite.siteCode}
                </span>
              )}
              <span className="font-semibold text-gray-900 dark:text-white truncate">
                {selectedSite.location || selectedSite.name || "Media Site"}
              </span>
              {selectedSite.city && (
                <span className="text-[10px] text-gray-400 shrink-0">
                  ({selectedSite.city})
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-gray-400">
              <Search className="h-3.5 w-3.5" />
              <span className="truncate">{placeholder}</span>
            </div>
          )}

          <div className="flex items-center gap-1 shrink-0 ml-1">
            {selectedSite && !disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1 text-gray-400 hover:text-rose-600 transition cursor-pointer"
                title="Clear selection"
              >
                <X className="h-3 w-3" />
              </button>
            )}
            <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
          </div>
        </div>
      ) : (
        /* Search Input when open */
        <div className="flex h-9 w-full items-center rounded-lg border-2 border-[#8B2424] bg-white px-2 text-xs dark:bg-slate-900">
          <Search className="h-3.5 w-3.5 text-[#8B2424] shrink-0 mr-1.5" />
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search site code, location, area, city..."
            className="w-full bg-transparent text-xs text-gray-900 outline-none placeholder:text-gray-400 dark:text-white"
            onKeyDown={(e) => {
              if (e.key === "Escape") setIsOpen(false);
              if (e.key === "Enter" && filteredSites.length > 0) {
                e.preventDefault();
                handleChoose(filteredSites[0]._id);
              }
            }}
          />
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-xl dark:border-slate-800 dark:bg-slate-900">
          <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 flex justify-between items-center border-b border-gray-100 dark:border-slate-800">
            <span>Select Media Site ({filteredSites.length})</span>
            <span className="text-[9px] text-gray-400 font-normal">Click to apply</span>
          </div>

          {filteredSites.length === 0 ? (
            <div className="p-4 text-center text-xs text-gray-500">
              No media sites matching &ldquo;{searchTerm}&rdquo;
            </div>
          ) : (
            filteredSites.map((site) => {
              const isSelected = site._id === selectedSiteId;
              const code = site.atrNo || site.siteCode || site.code;
              const type = site.mediaType || site.type || "Hoarding";

              return (
                <div
                  key={site._id}
                  onClick={() => handleChoose(site._id)}
                  className={`flex items-start justify-between gap-2 px-3 py-2 text-xs transition cursor-pointer border-b border-gray-50 last:border-0 dark:border-slate-800/40 ${
                    isSelected
                      ? "bg-rose-50/70 text-[#8B2424] dark:bg-rose-950/40 dark:text-rose-300 font-medium"
                      : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <div className="space-y-0.5 truncate">
                    <div className="flex items-center gap-1.5">
                      {code && (
                        <span className="rounded bg-gray-100 px-1.5 py-0.2 font-mono text-[10px] font-bold text-gray-700 dark:bg-slate-800 dark:text-gray-300">
                          {code}
                        </span>
                      )}
                      <span className="font-bold text-gray-900 dark:text-white truncate">
                        {site.location || site.name || "Media Site"}
                      </span>
                      <span className="rounded px-1.5 py-0.2 text-[9px] bg-rose-50 text-[#8B2424] dark:bg-rose-950/50 dark:text-rose-300 font-medium">
                        {type}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-gray-400 truncate">
                      <span className="flex items-center gap-0.5">
                        <MapPin className="h-2.5 w-2.5" />
                        {site.city || "Indore"}, {site.state || "MP"}
                      </span>
                    </div>
                  </div>

                  {isSelected && (
                    <Check className="h-4 w-4 text-[#8B2424] shrink-0 mt-0.5" />
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
