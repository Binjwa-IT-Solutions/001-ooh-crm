'use client';

import { useEffect, useRef, useState } from 'react';
import { Trash2, Upload } from 'lucide-react';

import { toErrorMessage } from '@/shared/api/errors';
import { useAuth } from '@/shared/auth/auth-context';
import { COMPANY } from '@/shared/company';
import {
  documentSignatureApi,
  invalidateCompanySignature,
  readImageFile,
  type CompanySignature,
} from '@/shared/document-signature';
import { Alert, Button, Card, Field, Spinner } from '@/shared/ui';

/**
 * Company settings → Document signature section (Admin only).
 * The signature and stamp uploaded here are printed on quotations, invoices and purchase orders.
 */
export function DocumentSignatureSettings() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [saved, setSaved] = useState<CompanySignature | null>(null);
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [stampImage, setStampImage] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [designation, setDesignation] = useState('Authorized Signatory');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    documentSignatureApi
      .get()
      .then((s) => {
        setSaved(s);
        setSignatureImage(s.signatureImage);
        setStampImage(s.stampImage);
        setName(s.signatoryName);
        setDesignation(s.signatoryDesignation || 'Authorized Signatory');
      })
      .catch((err) => setError(toErrorMessage(err)));
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <Alert tone="error" title="Admins only">
        Only an administrator can change the signature printed on company documents.
      </Alert>
    );
  }
  if (!saved && !error) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  const dirty =
    !!saved &&
    (signatureImage !== saved.signatureImage ||
      stampImage !== saved.stampImage ||
      name.trim() !== saved.signatoryName ||
      (designation.trim() || 'Authorized Signatory') !== saved.signatoryDesignation);

  const save = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const next = await documentSignatureApi.update({
        signatureImage,
        stampImage,
        signatoryName: name.trim(),
        signatoryDesignation: designation.trim() || 'Authorized Signatory',
      });
      setSaved(next);
      invalidateCompanySignature();
      setNotice('Saved. New quotations, invoices and purchase orders will show this signature.');
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section id="signature" className="space-y-4 scroll-mt-24">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Document signature</h2>
        <p className="text-sm text-slate-500">
          Printed in the &ldquo;For {COMPANY.name} Pvt. Ltd.&rdquo; box on quotations, invoices and purchase orders.
          Only admins can change it.
        </p>
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="p-6 space-y-5 lg:col-span-3">
          <ImagePicker
            label="Signature"
            hint="Sign on white paper, take a photo or scan, crop it tight. A PNG with a transparent background looks best."
            value={signatureImage}
            onChange={setSignatureImage}
            onError={setError}
          />
          <ImagePicker
            label="Company stamp (optional)"
            hint="Round or square seal, shown beside the signature."
            value={stampImage}
            onChange={setStampImage}
            onError={setError}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Signatory name" placeholder="e.g. Rishabh Jain" value={name} onChange={(e) => setName(e.target.value)} />
            <Field
              label="Designation"
              placeholder="Authorized Signatory"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between gap-3 pt-2">
            <p className="text-xs text-slate-400">
              {saved?.updatedAt
                ? `Last changed ${new Date(saved.updatedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}${
                    saved.updatedByName ? ` by ${saved.updatedByName}` : ''
                  }`
                : 'Not set up yet'}
            </p>
            <Button onClick={save} isLoading={saving} disabled={!dirty}>
              Save
            </Button>
          </div>
        </Card>

        {/* Live preview — mirrors the document footer */}
        <Card className="p-6 lg:col-span-2">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Preview on documents</p>
          <div className="rounded-xl border border-slate-200 bg-white p-5 text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">For {COMPANY.name} Pvt. Ltd.:</p>
            <div className="h-16 my-1 flex items-end justify-end gap-2">
              {stampImage && <img src={stampImage} alt="Stamp" className="h-14 w-14 object-contain opacity-90" />}
              {signatureImage ? (
                <img src={signatureImage} alt="Signature" className="h-12 max-w-[150px] object-contain" />
              ) : (
                <span className="text-[11px] text-slate-300 italic self-center">signature appears here</span>
              )}
            </div>
            <div className="border-t border-gray-300 pt-1 ml-auto w-48 text-center">
              <p className="text-[11px] font-semibold text-gray-700">{name.trim() || 'Authorized Signatory'}</p>
              {name.trim() && <p className="text-[10px] text-gray-500">{designation.trim() || 'Authorized Signatory'}</p>}
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-3">
            A quote can still turn its signature off, or use a different one, from the quotation form.
          </p>
        </Card>
      </div>
    </section>
  );
}

function ImagePicker({
  label,
  hint,
  value,
  onChange,
  onError,
}: {
  label: string;
  hint: string;
  value: string | null;
  onChange: (v: string | null) => void;
  onError: (msg: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <p className="text-xs text-slate-500 mb-2">{hint}</p>
      <div className="flex items-center gap-3">
        <div className="h-20 w-44 rounded-xl border border-dashed border-slate-300 bg-[repeating-conic-gradient(#f8fafc_0%_25%,#fff_0%_50%)] bg-[length:16px_16px] flex items-center justify-center overflow-hidden">
          {value ? (
            <img src={value} alt={label} className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-xs text-slate-400">No image</span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              try {
                onError(null);
                onChange(await readImageFile(file));
              } catch (err) {
                onError(err instanceof Error ? err.message : 'Could not use that file.');
              }
            }}
          />
          <Button variant="secondary" className="!h-9 !text-xs" onClick={() => inputRef.current?.click()}>
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            {value ? 'Replace' : 'Upload'}
          </Button>
          {value && (
            <Button variant="ghost" className="!h-9 !text-xs text-red-600 hover:bg-red-50" onClick={() => onChange(null)}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Remove
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
