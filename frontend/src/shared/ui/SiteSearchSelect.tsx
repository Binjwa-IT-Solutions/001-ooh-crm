'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, Check, X, MapPin } from 'lucide-react';

export interface SiteOptionItem {
  _id: string;
  code?: string;
  siteCode?: string;
  name?: string;
  city?: string;
  baseCostPerDay?: number;
  type?: string;
  sizeWidth?: number;
  sizeHeight?: number;
  width?: number;
  height?: number;
  address?: string;
  location?: string;
}

interface SiteSearchSelectProps {
  value: string;
  sites: SiteOptionItem[];
  onChange: (siteId: string) => void;
  placeholder?: string;
  triggerClassName?: string;
  disabled?: boolean;
}

export function SiteSearchSelect({
  value,
  sites,
  onChange,
  placeholder = 'Select media site...',
  triggerClassName = '',
  disabled = false,
}: SiteSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 320,
  });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const selectedSite = sites.find((s) => s._id === value);
  const selectedCode = selectedSite?.code || selectedSite?.siteCode || selectedSite?.name || '';
  const selectedCity = selectedSite?.city ? `(${selectedSite.city})` : '';
  const displayText = selectedSite ? `${selectedCode} ${selectedCity}`.trim() : placeholder;

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverWidth = rect.width;
    const popoverHeight = 280;

    const spaceBelow = window.innerHeight - rect.bottom;
    const openAbove = spaceBelow < popoverHeight && rect.top > popoverHeight;

    let top = openAbove ? rect.top - popoverHeight - 6 : rect.bottom + 4;
    let left = rect.left;

    setCoords({ top, left, width: popoverWidth });
  }, []);

  useEffect(() => {
    if (open) {
      updatePosition();
      // Auto-focus search input after portal mount
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
    }
  }, [open, updatePosition]);

  // Outside click & window scroll/resize listener
  useEffect(() => {
    if (!open) return;

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        popoverRef.current && !popoverRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };

    const handleScrollOrResize = (event: Event) => {
      if (popoverRef.current && event.target && popoverRef.current.contains(event.target as Node)) {
        return;
      }
      updatePosition();
    };

    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [open, updatePosition]);

  const filteredSites = sites.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const code = (s.code || s.siteCode || s.name || '').toLowerCase();
    const city = (s.city || '').toLowerCase();
    const type = (s.type || '').toLowerCase();
    const addr = (s.address || s.location || '').toLowerCase();
    const w = s.sizeWidth || s.width;
    const h = s.sizeHeight || s.height;
    const dims = (w && h) ? `${w}x${h}` : '';

    return (
      code.includes(q) ||
      city.includes(q) ||
      type.includes(q) ||
      addr.includes(q) ||
      dims.includes(q)
    );
  });

  return (
    <div className="relative w-full">
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        className={`flex w-full cursor-pointer items-center justify-between rounded-lg border bg-white px-3 py-2 text-left text-xs font-medium outline-none transition dark:bg-slate-950 dark:text-white ${
          open
            ? 'border-[#6A1B21] ring-1 ring-[#6A1B21]'
            : 'border-slate-300 hover:border-[#6A1B21] dark:border-slate-700'
        } ${disabled ? 'cursor-not-allowed opacity-60 bg-slate-50' : ''} ${triggerClassName}`}
      >
        <span className={`truncate ${selectedSite ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
          {displayText}
        </span>
        <ChevronDown className="ml-1 h-3.5 w-3.5 shrink-0 text-slate-400" />
      </button>

      {/* Portaled Floating Smart Search Popover */}
      {open && mounted && typeof document !== 'undefined' && createPortal(
        <div
          ref={popoverRef}
          style={{
            position: 'fixed',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            zIndex: 99999,
          }}
          className="rounded-xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in fade-in zoom-in-95 duration-100"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Smart Search Bar */}
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search code, city, type..."
              className="w-full h-8.5 rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-7 text-xs text-slate-900 outline-none focus:border-[#6A1B21] focus:bg-white focus:ring-1 focus:ring-[#6A1B21] dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:bg-slate-950"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Header count */}
          <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <span>{filteredSites.length} Site{filteredSites.length === 1 ? '' : 's'} Available</span>
            {searchQuery && <span className="text-[10px] text-slate-400 font-normal">filtered</span>}
          </div>

          {/* Sites List */}
          <div className="mt-1 max-h-56 overflow-y-auto divide-y divide-slate-100/60 dark:divide-slate-800/60">
            {filteredSites.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                No media sites match &quot;{searchQuery}&quot;
              </div>
            ) : (
              filteredSites.map((site) => {
                const isSelected = site._id === value;
                const code = site.code || site.siteCode || site.name || 'Site';
                const city = site.city || '';
                const type = site.type || 'Hoarding';
                const w = site.sizeWidth || site.width;
                const h = site.sizeHeight || site.height;
                const dimStr = (w && h) ? `${w}ft × ${h}ft` : '';
                const rate = site.baseCostPerDay ? `₹${(site.baseCostPerDay / 100).toLocaleString('en-IN')}/d` : '';

                return (
                  <div
                    key={site._id}
                    onClick={() => {
                      onChange(site._id);
                      setOpen(false);
                    }}
                    className={`flex items-center justify-between gap-1.5 p-2 rounded-lg text-xs cursor-pointer transition ${
                      isSelected
                        ? 'bg-[#6A1B21]/10 text-[#6A1B21] font-medium'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-slate-900 dark:text-white truncate">
                          {code} {city ? `(${city})` : ''}
                        </span>
                        <span className="rounded bg-[#6A1B21]/10 text-[#6A1B21] px-1 py-0.5 text-[9px] font-semibold shrink-0">
                          {type}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                        <span className="truncate">{dimStr || 'Standard'}</span>
                        {rate && <span className="font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">{rate}</span>}
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="h-3.5 w-3.5 text-[#6A1B21] shrink-0 ml-1" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
