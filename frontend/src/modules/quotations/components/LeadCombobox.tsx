"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Search, ChevronDown, Check, X, Building2, User, Phone, MapPin } from "lucide-react";
import type { Lead } from "@/modules/leads/types";

interface LeadComboboxProps {
  leads: Lead[];
  selectedLeadId: string;
  onSelect: (leadId: string) => void;
  disabled?: boolean;
}

export default function LeadCombobox({
  leads,
  selectedLeadId,
  onSelect,
  disabled = false,
}: LeadComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter out Unclaimed leads: Only show claimed or assigned leads
  const eligibleLeads = useMemo(() => {
    return leads.filter((l) => {
      if (l._id === selectedLeadId) return true;
      if (l.status === "Rejected") return false;
      // Must be assigned or claimed
      return Boolean(l.assignedTo || l.claimedBy);
    });
  }, [leads, selectedLeadId]);

  const selectedLead = useMemo(() => {
    return eligibleLeads.find((l) => l._id === selectedLeadId) || leads.find((l) => l._id === selectedLeadId);
  }, [eligibleLeads, leads, selectedLeadId]);

  // Handle outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter leads by search term
  const filteredLeads = useMemo(() => {
    if (!searchTerm.trim()) return eligibleLeads;
    const q = searchTerm.toLowerCase();
    return eligibleLeads.filter((l) => {
      const company = (l.companyName || "").toLowerCase();
      const person = (l.contactPerson || "").toLowerCase();
      const mobile = (l.mobile || "").toLowerCase();
      const city = (l.city || "").toLowerCase();
      const email = (l.email || "").toLowerCase();
      return (
        company.includes(q) ||
        person.includes(q) ||
        mobile.includes(q) ||
        city.includes(q) ||
        email.includes(q)
      );
    });
  }, [eligibleLeads, searchTerm]);

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
          } ${selectedLead ? "border-rose-200 bg-rose-50/20 dark:border-rose-950" : ""}`}
        >
          {selectedLead ? (
            <div className="flex items-center gap-2 truncate">
              <Building2 className="h-3.5 w-3.5 shrink-0 text-[#8B2424]" />
              <span className="font-semibold text-gray-900 dark:text-white truncate">
                {selectedLead.companyName || selectedLead.contactPerson}
              </span>
              {selectedLead.city && (
                <span className="text-[10px] text-gray-400 shrink-0">
                  ({selectedLead.city})
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-gray-400">
              <Search className="h-3.5 w-3.5" />
              <span>Search &amp; Select Claimed Lead...</span>
            </div>
          )}

          <div className="flex items-center gap-1 shrink-0 ml-1">
            {selectedLead && !disabled && (
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
            placeholder="Search by company, person, mobile or city..."
            className="w-full bg-transparent text-xs text-gray-900 outline-none placeholder:text-gray-400 dark:text-white"
            onKeyDown={(e) => {
              if (e.key === "Escape") setIsOpen(false);
              if (e.key === "Enter" && filteredLeads.length > 0) {
                e.preventDefault();
                handleChoose(filteredLeads[0]._id || "");
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
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-xl dark:border-slate-800 dark:bg-slate-900">
          <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 flex justify-between items-center border-b border-gray-100 dark:border-slate-800">
            <span>Claimed &amp; Active Leads ({filteredLeads.length})</span>
            <span className="text-[9px] lowercase text-[#8B2424]">Unclaimed hidden</span>
          </div>

          {filteredLeads.length === 0 ? (
            <div className="p-4 text-center text-xs text-gray-500">
              No matching claimed leads found
            </div>
          ) : (
            filteredLeads.map((lead) => {
              const isSelected = lead._id === selectedLeadId;
              return (
                <div
                  key={lead._id}
                  onClick={() => handleChoose(lead._id || "")}
                  className={`flex items-start justify-between gap-2 px-3 py-2 text-xs transition cursor-pointer border-b border-gray-50 last:border-0 dark:border-slate-800/40 ${
                    isSelected
                      ? "bg-rose-50/70 text-[#8B2424] dark:bg-rose-950/40 dark:text-rose-300 font-medium"
                      : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <div className="space-y-0.5 truncate">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-gray-900 dark:text-white truncate">
                        {lead.companyName || "Unnamed Company"}
                      </span>
                      {lead.status && (
                        <span className="rounded px-1.5 py-0.2 text-[9px] font-semibold bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-300">
                          {lead.status}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400 truncate">
                      {lead.contactPerson && (
                        <span className="flex items-center gap-0.5">
                          <User className="h-3 w-3 text-gray-400" />
                          {lead.contactPerson}
                        </span>
                      )}
                      {lead.mobile && (
                        <span className="flex items-center gap-0.5">
                          <Phone className="h-2.5 w-2.5 text-gray-400" />
                          {lead.mobile}
                        </span>
                      )}
                      {lead.city && (
                        <span className="flex items-center gap-0.5">
                          <MapPin className="h-2.5 w-2.5 text-gray-400" />
                          {lead.city}
                        </span>
                      )}
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
