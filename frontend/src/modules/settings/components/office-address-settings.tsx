'use client';

import { useEffect, useState } from 'react';
import { MapPin, Plus, Trash2 } from 'lucide-react';

import { toErrorMessage } from '@/shared/api/errors';
import { companyProfileApi, invalidateCompanyProfile, type CompanyProfile } from '@/shared/company-profile';
import { Alert, Button, Card, Spinner } from '@/shared/ui';

type Draft = { key: string; label: string; address: string; isDefault: boolean };

let keySeq = 0;
const newKey = () => `o${++keySeq}`;

/**
 * Company settings → Office addresses (Admin only).
 * The default office is printed on quotations, invoices, purchase orders and payslips.
 */
export function OfficeAddressSettings() {
  const [saved, setSaved] = useState<CompanyProfile | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = (p: CompanyProfile) => {
    setSaved(p);
    setDrafts(p.offices.map((o) => ({ key: newKey(), label: o.label, address: o.address, isDefault: o.isDefault })));
  };

  useEffect(() => {
    companyProfileApi
      .get()
      .then(load)
      .catch((err) => setError(toErrorMessage(err)));
  }, []);

  if (!saved && !error) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  const update = (key: string, patch: Partial<Draft>) =>
    setDrafts((ds) => ds.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  const makeDefault = (key: string) => setDrafts((ds) => ds.map((d) => ({ ...d, isDefault: d.key === key })));

  const remove = (key: string) =>
    setDrafts((ds) => {
      const next = ds.filter((d) => d.key !== key);
      // Keep exactly one default
      if (next.length && !next.some((d) => d.isDefault)) next[0] = { ...next[0], isDefault: true };
      return next;
    });

  const add = () => setDrafts((ds) => [...ds, { key: newKey(), label: '', address: '', isDefault: ds.length === 0 }]);

  const savedJson = JSON.stringify(saved?.offices.map((o) => [o.label, o.address, o.isDefault]) ?? []);
  const draftJson = JSON.stringify(drafts.map((d) => [d.label.trim(), d.address.trim(), d.isDefault]));
  const dirty = savedJson !== draftJson || !saved?.configured;

  const save = async () => {
    const bad = drafts.find((d) => d.label.trim().length < 2 || d.address.trim().length < 10);
    if (bad) {
      setError('Each office needs a name and a full address.');
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const next = await companyProfileApi.update(
        drafts.map((d) => ({ label: d.label.trim(), address: d.address.trim(), isDefault: d.isDefault }))
      );
      load(next);
      invalidateCompanyProfile();
      setNotice(`Saved. Documents now show the address of "${next.defaultOffice.label}".`);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const defaultDraft = drafts.find((d) => d.isDefault);

  return (
    <section id="offices" className="space-y-4 scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Office addresses</h2>
          <p className="text-sm text-slate-500">
            The <span className="font-semibold">default</span> office is printed on quotations, invoices, purchase orders
            and payslips.
          </p>
        </div>
        <Button variant="secondary" onClick={add} disabled={drafts.length >= 10}>
          <Plus className="h-4 w-4 mr-1.5" /> Add office
        </Button>
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}
      {saved && !saved.configured && (
        <Alert tone="info">
          Showing the built-in address. Review it and press Save to manage offices from here.
        </Alert>
      )}

      <div className="space-y-3">
        {drafts.map((d, i) => (
          <Card key={d.key} className={`p-4 ${d.isDefault ? 'ring-2 ring-[#8B2424]/40 border-[#8B2424]/30' : ''}`}>
            <div className="flex flex-wrap items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#F8E6E6] text-[#6E1D1D] flex items-center justify-center shrink-0">
                <MapPin className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-[240px] space-y-2">
                <input
                  value={d.label}
                  onChange={(e) => update(d.key, { label: e.target.value })}
                  placeholder={i === 0 ? 'e.g. Head Office – Indore' : 'e.g. Branch – Bhopal'}
                  maxLength={60}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-800"
                />
                <textarea
                  value={d.address}
                  onChange={(e) => update(d.key, { address: e.target.value })}
                  rows={3}
                  maxLength={400}
                  placeholder={'Building, street, area\nCity, State PIN'}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 leading-relaxed"
                />
                <p className="text-[11px] text-slate-400">Each line is printed on its own row.</p>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                {d.isDefault ? (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#8B2424] text-white">Default</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => makeDefault(d.key)}
                    className="px-2.5 py-1 rounded-full text-[11px] font-semibold border border-slate-300 text-slate-600 hover:border-[#8B2424] hover:text-[#8B2424]"
                  >
                    Make default
                  </button>
                )}
                {drafts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => remove(d.key)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Preview of what documents will print */}
      {defaultDraft && defaultDraft.address.trim() && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Printed on documents</p>
          <p className="text-sm font-bold text-slate-800">Media Octus Pvt. Ltd.</p>
          {defaultDraft.address
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean)
            .map((l, i) => (
              <p key={i} className="text-xs text-slate-600">
                {l}
              </p>
            ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-400">
          {saved?.updatedAt
            ? `Last changed ${new Date(saved.updatedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}${
                saved.updatedByName ? ` by ${saved.updatedByName}` : ''
              }`
            : 'Not saved yet'}
        </p>
        <Button onClick={save} isLoading={saving} disabled={!dirty || drafts.length === 0}>
          Save offices
        </Button>
      </div>
    </section>
  );
}
