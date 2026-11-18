'use client';

import { useEffect, useState } from 'react';

import { api } from './api/client';

/** Company signature printed on quotations, invoices and purchase orders (Settings → Document signature). */
export interface CompanySignature {
  signatureImage: string | null;
  stampImage: string | null;
  signatoryName: string;
  signatoryDesignation: string;
  updatedByName?: string | null;
  updatedAt?: string | null;
}

export const EMPTY_SIGNATURE: CompanySignature = {
  signatureImage: null,
  stampImage: null,
  signatoryName: '',
  signatoryDesignation: 'Authorized Signatory',
};

export const documentSignatureApi = {
  get: async () => (await api.get<{ signature: CompanySignature }>('/api/settings/document-signature')).signature,
  /** Admin only. Pass `null` for an image to remove it; leave a field out to keep it. */
  update: async (data: Partial<Pick<CompanySignature, 'signatureImage' | 'stampImage' | 'signatoryName' | 'signatoryDesignation'>>) =>
    (await api.put<{ signature: CompanySignature }>('/api/settings/document-signature', data)).signature,
};

// One fetch per page load, shared by every document on screen.
let cache: Promise<CompanySignature> | null = null;

export function invalidateCompanySignature() {
  cache = null;
}

export function useCompanySignature(): CompanySignature | null {
  const [sig, setSig] = useState<CompanySignature | null>(null);
  useEffect(() => {
    let cancelled = false;
    cache ??= documentSignatureApi.get().catch(() => EMPTY_SIGNATURE);
    cache.then((s) => !cancelled && setSig(s));
    return () => {
      cancelled = true;
    };
  }, []);
  return sig;
}

/** Reads an image file into a data URL, enforcing type and size (max 300 KB, same as the server). */
export function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return reject(new Error('Please choose a PNG, JPG or WebP image.'));
    if (file.size > 300 * 1024) return reject(new Error('That image is larger than 300 KB. Please use a smaller file.'));
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.readAsDataURL(file);
  });
}
