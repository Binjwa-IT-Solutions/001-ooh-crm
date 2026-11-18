'use client';

import { useEffect, useState } from 'react';

import { api } from './api/client';
import { COMPANY } from './company';

/** Company offices (Settings → Company settings). The default office is printed on documents. */
export interface Office {
  id: string;
  label: string;
  address: string;
  addressLines: string[];
  isDefault: boolean;
}

export interface CompanyProfile {
  name: string;
  offices: Office[];
  defaultOffice: Office;
  configured: boolean;
  updatedByName: string | null;
  updatedAt: string | null;
}

export const companyProfileApi = {
  get: async () => (await api.get<{ company: CompanyProfile }>('/api/settings/company')).company,
  /** Admin only — replaces the whole office list. */
  update: async (offices: Array<Pick<Office, 'label' | 'address' | 'isDefault'>>) =>
    (await api.put<{ company: CompanyProfile }>('/api/settings/company', { offices })).company,
};

let cache: Promise<CompanyProfile | null> | null = null;

export function invalidateCompanyProfile() {
  cache = null;
}

/**
 * Address lines of the default office, for printing on documents.
 * Starts with the built-in address and switches once the saved one loads.
 */
export function useCompanyAddressLines(): string[] {
  const [lines, setLines] = useState<string[]>([...COMPANY.addressLines]);
  useEffect(() => {
    let cancelled = false;
    cache ??= companyProfileApi.get().catch(() => null);
    cache.then((p) => {
      if (!cancelled && p?.defaultOffice.addressLines.length) setLines(p.defaultOffice.addressLines);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return lines;
}
