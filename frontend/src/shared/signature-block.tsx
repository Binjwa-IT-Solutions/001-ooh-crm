import { cx } from './ui';
import type { CompanySignature } from './document-signature';

/**
 * The "For Media Octus" signatory box shown at the bottom of invoices and
 * purchase orders: optional company stamp + signature image above the line,
 * signatory name and designation below it. Images come from
 * Settings → Document signature (Admin only).
 */
export function SignatureBlock({
  signature,
  heading = 'For Media Octus Pvt Ltd',
  align = 'right',
  className,
}: {
  signature: Pick<CompanySignature, 'signatureImage' | 'stampImage' | 'signatoryName' | 'signatoryDesignation'> | null;
  heading?: string;
  align?: 'right' | 'center';
  className?: string;
}) {
  const name = signature?.signatoryName?.trim();
  const designation = signature?.signatoryDesignation?.trim() || 'Authorized Signatory';
  const justify = align === 'right' ? 'justify-end' : 'justify-center';

  return (
    <div className={cx(align === 'right' ? 'text-right' : 'text-center', className)}>
      <p className="font-bold text-slate-900 text-xs uppercase tracking-wide">{heading}</p>
      <div className={cx('h-16 my-1 flex items-end gap-2', justify)}>
        {signature?.stampImage && (
          <img src={signature.stampImage} alt="Company stamp" className="h-14 w-14 object-contain opacity-90" />
        )}
        {signature?.signatureImage && (
          <img src={signature.signatureImage} alt="Authorized signature" className="h-12 max-w-[170px] object-contain" />
        )}
      </div>
      <div className={cx('border-t border-slate-300 pt-1 w-48', align === 'right' ? 'ml-auto' : 'mx-auto')}>
        {name && <p className="text-[11px] font-semibold text-slate-800">{name}</p>}
        <p className="text-[11px] font-medium text-slate-600">{designation}</p>
      </div>
    </div>
  );
}
