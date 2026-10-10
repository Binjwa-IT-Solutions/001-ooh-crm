'use client';

import { useEffect, useState } from 'react';
import { Clock, TrendingUp, Check } from 'lucide-react';
import { invoicesApi } from '../api';
import type { RecentPricePoint } from '../types';
import { formatCurrency } from '../utils/formatters';

interface RecentPricesWidgetProps {
  partyId?: string | null;
  itemName?: string;
  onSelectRate?: (rateInPaise: number) => void;
}

export function RecentPricesWidget({ partyId, itemName, onSelectRate }: RecentPricesWidgetProps) {
  const [prices, setPrices] = useState<RecentPricePoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!partyId || !itemName || itemName.trim().length < 2) {
      setPrices([]);
      return;
    }

    let active = true;
    setLoading(true);

    invoicesApi
      .getRecentPartyPrices(partyId, itemName.trim())
      .then((res) => {
        if (active) {
          setPrices(res.prices || res.data || []);
        }
      })
      .catch(() => {
        if (active) setPrices([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [partyId, itemName]);

  if (!partyId || !itemName || (prices.length === 0 && !loading)) {
    return null;
  }

  return (
    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 shadow-sm animate-in fade-in-50 duration-200">
      <div className="flex items-center justify-between font-semibold mb-1.5 text-amber-950">
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-amber-700" />
          Recent Sales Prices for &ldquo;{itemName}&rdquo; to this party
        </span>
        {loading && <span className="text-[10px] text-amber-600 font-normal">Loading history...</span>}
      </div>

      {prices.length > 0 ? (
        <div className="flex flex-wrap gap-2 mt-1">
          {prices.map((p, idx) => (
            <button
              key={`${p.invoiceNumber}-${idx}`}
              type="button"
              onClick={() => onSelectRate?.(p.rate)}
              className="inline-flex items-center gap-1.5 rounded bg-white px-2 py-1 text-[11px] font-medium text-slate-800 border border-amber-300 hover:border-[#6E1D1D] hover:bg-[#F8E6E6] hover:text-[#6E1D1D] transition-colors shadow-2xs"
              title={`Used in invoice ${p.invoiceNumber} on ${new Date(p.invoiceDate).toLocaleDateString('en-IN')}`}
            >
              <TrendingUp className="h-3 w-3 text-amber-600" />
              <span>{formatCurrency(p.rate)}</span>
              <span className="text-[10px] text-slate-500">
                ({new Date(p.invoiceDate).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })})
              </span>
              <span className="text-[9px] text-[#6E1D1D] font-bold underline ml-0.5">Apply</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-amber-800 italic">No previous sales price history found for this party and item.</p>
      )}
    </div>
  );
}
