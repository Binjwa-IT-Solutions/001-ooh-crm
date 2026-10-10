'use client';

import { useEffect, useState, use } from 'react';
import { Download, Printer, AlertCircle, Loader2, Building2, CreditCard } from 'lucide-react';
import { invoicesApi } from '@/modules/finance/api';
import type { Invoice } from '@/modules/finance/types';
import { formatCurrency, formatDate } from '@/modules/finance/utils/formatters';

interface PublicShareInvoicePageProps {
  params: Promise<{ token: string }>;
}

export default function PublicShareInvoicePage({ params }: PublicShareInvoicePageProps) {
  const { token } = use(params);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadInvoice() {
      setLoading(true);
      setError(null);
      try {
        const res = await invoicesApi.getPublicInvoice(token);
        setInvoice(res.invoice || res.data);
      } catch (err: any) {
        setError(err?.message || 'Invoice not found or link has expired.');
      } finally {
        setLoading(false);
      }
    }
    loadInvoice();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#6E1D1D]" />
          <p className="text-xs text-slate-500 font-medium">Loading invoice document...</p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-slate-200 text-center shadow-sm space-y-4">
          <div className="h-12 w-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Document Unavailable</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            {error || 'This invoice link could not be loaded. Please request an updated share link from Media Octus Accounts.'}
          </p>
        </div>
      </div>
    );
  }

  const isProforma = invoice.type === 'proforma';

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    window.open(invoicesApi.getPublicPdfDownloadUrl(token), '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 sm:px-6 lg:px-8 print:bg-white print:p-0">
      <div className="max-w-4xl mx-auto space-y-6 print:max-w-none print:m-0">
        {/* Top Floating Action Bar */}
        <div className="print:hidden flex items-center justify-between bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png?v=4" alt="Media Octus" className="h-8 w-auto object-contain" />
            <div>
              <p className="text-xs font-bold text-slate-900">Media Octus Billing Document</p>
              <p className="text-[11px] text-slate-500">{invoice.invoiceNumber}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <Printer className="h-4 w-4 text-slate-500" />
              Print
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#6E1D1D] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#581717] transition-all shadow-sm"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </button>
          </div>
        </div>

        {/* Printable Document Box */}
        <div className="invoice-document rounded-2xl border border-slate-200 bg-white p-8 sm:p-12 shadow-sm print:shadow-none print:border-none print:p-0">
          {/* Document Header */}
          <div className="flex justify-between items-start border-b border-slate-200 pb-6">
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png?v=4" alt="Media Octus" className="h-12 w-auto object-contain mb-3" />
              <h2 className="text-base font-bold text-slate-900">Media Octus Pvt Ltd</h2>
              <p className="text-xs text-slate-500 leading-relaxed max-w-xs">
                Trade Tower, 4th Floor, Bandra Kurla Complex,
                <br />
                Mumbai, Maharashtra - 400051, India
                <br />
                GSTIN: 27AABCM8899K1ZZ · Email: accounts@mediaoctus.com
                <br />
                Phone: +91 22 4567 8900
              </p>
            </div>

            <div className="text-right">
              <h2 className="text-2xl font-black text-[#6E1D1D] tracking-tight uppercase">
                {isProforma ? 'PROFORMA INVOICE' : 'TAX INVOICE'}
              </h2>
              <p className="text-sm font-bold text-slate-800 font-mono mt-1">{invoice.invoiceNumber}</p>
              <div className="mt-2 text-xs text-slate-500 space-y-1">
                <div>
                  <span className="font-medium text-slate-700">Invoice Date: </span>
                  {formatDate(invoice.invoiceDate)}
                </div>
                <div>
                  <span className="font-medium text-slate-700">Due Date: </span>
                  {formatDate(invoice.dueDate)}
                </div>
                <div>
                  <span className="font-medium text-slate-700">Place of Supply: </span>
                  {invoice.placeOfSupply || 'Maharashtra (27)'}
                </div>
              </div>
            </div>
          </div>

          {/* Bill To & Ship To Blocks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-6 border-b border-slate-200 text-xs">
            <div>
              <h3 className="font-bold text-slate-500 uppercase tracking-wider text-[11px] mb-1.5">Billed To</h3>
              <p className="text-sm font-bold text-slate-900">{invoice.partyName}</p>
              <p className="text-slate-600 mt-1 whitespace-pre-line leading-relaxed">
                {invoice.billingAddress || 'No billing address specified'}
              </p>
              {invoice.gstin && (
                <p className="mt-1 font-semibold text-slate-800">
                  GSTIN: <span className="font-mono">{invoice.gstin}</span>
                </p>
              )}
              {invoice.contactPerson && (
                <p className="text-slate-500 mt-0.5">
                  Attn: {invoice.contactPerson} {invoice.contactMobile ? `(${invoice.contactMobile})` : ''}
                </p>
              )}
            </div>

            <div>
              <h3 className="font-bold text-slate-500 uppercase tracking-wider text-[11px] mb-1.5">Shipped / Location Details</h3>
              <p className="text-slate-600 whitespace-pre-line leading-relaxed">
                {invoice.shippingAddress || invoice.billingAddress || 'Same as billing address'}
              </p>
              <p className="text-slate-500 mt-1">
                State & Code: <span className="font-medium text-slate-800">{invoice.placeOfSupply}</span>
              </p>
            </div>
          </div>

          {/* Items Table */}
          <div className="py-6">
            {(() => {
              const hasDiscount = invoice.items.some((i) => (i.discount || 0) > 0);
              return (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-300 bg-slate-50 text-slate-700 font-bold">
                      <th className="py-3 px-3 w-10 text-center">#</th>
                      <th className="py-3 px-3">Item & Description</th>
                      <th className="py-3 px-3 w-20 text-center">HSN/SAC</th>
                      <th className="py-3 px-3 w-20 text-center">Qty</th>
                      {hasDiscount && <th className="py-3 px-3 w-24 text-right">Discount</th>}
                      <th className="py-3 px-3 w-28 text-right">Rate</th>
                      <th className="py-3 px-3 w-20 text-right">Tax (%)</th>
                      <th className="py-3 px-3 w-28 text-right">Tax (₹)</th>
                      <th className="py-3 px-3 w-32 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoice.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 invoice-row">
                        <td className="py-3 px-3 text-center text-slate-400 font-medium">{idx + 1}</td>
                        <td className="py-3 px-3">
                          <p className="font-semibold text-slate-900">{item.name}</p>
                          {item.description && (
                            <p className="text-[11px] text-slate-500 whitespace-pre-line mt-0.5">{item.description}</p>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center text-slate-600 font-mono">{item.hsn || '998361'}</td>
                        <td className="py-3 px-3 text-center text-slate-800 font-medium">
                          {item.quantity} {item.unit}
                        </td>
                        {hasDiscount && (
                          <td className="py-3 px-3 text-right text-emerald-700 font-medium">
                            {(item.discount || 0) > 0 ? `-${formatCurrency(item.discount || 0)}` : '—'}
                          </td>
                        )}
                        <td className="py-3 px-3 text-right text-slate-800 font-medium">{formatCurrency(item.rate)}</td>
                        <td className="py-3 px-3 text-right text-slate-600 font-medium">{item.taxPercent}%</td>
                        <td className="py-3 px-3 text-right text-slate-600">{formatCurrency(item.taxAmount)}</td>
                        <td className="py-3 px-3 text-right font-bold text-slate-900">{formatCurrency(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()}
          </div>

          {/* Totals & Calculations Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-4 border-t border-slate-200">
            {/* Bank Details & Terms */}
            <div className="space-y-4 text-xs text-slate-600">
              {invoice.bankDetails?.accountNumber && (
                <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-200/80">
                  <h4 className="font-bold text-slate-900 mb-1.5 flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5 text-[#6E1D1D]" />
                    Bank Account for RTGS / NEFT / IMPS
                  </h4>
                  <div className="grid grid-cols-2 gap-y-1 text-[11px]">
                    {invoice.bankDetails.bankName && (
                      <>
                        <span className="text-slate-500">Bank Name:</span>
                        <span className="font-semibold text-slate-800">{invoice.bankDetails.bankName}</span>
                      </>
                    )}
                    {invoice.bankDetails.accountHolderName && (
                      <>
                        <span className="text-slate-500">A/C Holder:</span>
                        <span className="font-semibold text-slate-800">{invoice.bankDetails.accountHolderName}</span>
                      </>
                    )}
                    <span className="text-slate-500">Account No:</span>
                    <span className="font-mono font-bold text-slate-900">{invoice.bankDetails.accountNumber}</span>
                    {invoice.bankDetails.ifsc && (
                      <>
                        <span className="text-slate-500">IFSC Code:</span>
                        <span className="font-mono font-semibold text-slate-800">{invoice.bankDetails.ifsc}</span>
                      </>
                    )}
                    {invoice.bankDetails.branch && (
                      <>
                        <span className="text-slate-500">Branch:</span>
                        <span className="text-slate-800">{invoice.bankDetails.branch}</span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {invoice.termsAndConditions && (
                <div>
                  <h4 className="font-bold text-slate-900 mb-1 text-[11px] uppercase tracking-wider">Terms & Conditions</h4>
                  <p className="whitespace-pre-line text-slate-500 leading-relaxed text-[11px]">
                    {invoice.termsAndConditions}
                  </p>
                </div>
              )}

              {invoice.notes && (
                <div>
                  <h4 className="font-bold text-slate-900 mb-1 text-[11px] uppercase tracking-wider">Notes</h4>
                  <p className="whitespace-pre-line text-slate-500 leading-relaxed text-[11px]">
                    {invoice.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Totals Box */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal (Base Value):</span>
                <span className="font-semibold text-slate-900">{formatCurrency(invoice.subtotal)}</span>
              </div>

              {(() => {
                const totalItemDiscount = invoice.items.reduce((sum, item) => sum + (item.discount || 0), 0);
                return totalItemDiscount > 0 ? (
                  <div className="flex justify-between text-emerald-700">
                    <span>Item Discount (-):</span>
                    <span>-{formatCurrency(totalItemDiscount)}</span>
                  </div>
                ) : null;
              })()}

              {invoice.discount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount:</span>
                  <span>-{formatCurrency(invoice.discount)}</span>
                </div>
              )}

              {invoice.additionalCharges > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Additional Charges:</span>
                  <span>+{formatCurrency(invoice.additionalCharges)}</span>
                </div>
              )}

              <div className="flex justify-between border-t border-slate-100 pt-1.5 font-medium text-slate-700">
                <span>Taxable Amount:</span>
                <span>{formatCurrency(invoice.taxableAmount)}</span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>GST Total:</span>
                <span className="font-semibold text-slate-900">{formatCurrency(invoice.taxAmount)}</span>
              </div>

              {invoice.tcs > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>TCS (+):</span>
                  <span>+{formatCurrency(invoice.tcs)}</span>
                </div>
              )}

              {invoice.roundOff !== 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>Round Off:</span>
                  <span>{invoice.roundOff > 0 ? `+${formatCurrency(invoice.roundOff)}` : formatCurrency(invoice.roundOff)}</span>
                </div>
              )}

              <div className="flex justify-between border-t-2 border-slate-300 pt-2 text-sm font-bold text-slate-900">
                <span>Grand Total:</span>
                <span className="text-base text-[#6E1D1D]">{formatCurrency(invoice.totalAmount)}</span>
              </div>

              <div className="flex justify-between text-emerald-600 font-semibold border-t border-slate-100 pt-1.5">
                <span>Amount Received:</span>
                <span>{formatCurrency(invoice.amountReceived)}</span>
              </div>

              <div className="flex justify-between text-slate-900 font-bold border-t border-slate-200 pt-1.5">
                <span>Balance Due:</span>
                <span className={invoice.balanceAmount > 0 ? 'text-[#6E1D1D]' : 'text-emerald-700'}>
                  {formatCurrency(invoice.balanceAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* Authorized Signatory Footer */}
          <div className="pt-10 flex justify-between items-end border-t border-slate-200 mt-8 text-xs text-slate-500 invoice-row">
            <div>
              <p className="text-[11px] font-medium text-slate-700">Thank you for your business!</p>
              <p className="text-[10px] text-slate-400 mt-0.5">This is a computer-generated tax invoice document.</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-slate-900 text-xs uppercase tracking-wide">For Media Octus Pvt Ltd</p>
              <div className="h-12 flex items-center justify-end pr-2">
                <span className="font-serif italic text-base text-slate-700 select-none tracking-wider opacity-90">
                  Media Octus
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-600 border-t border-slate-300 pt-1">Authorized Signatory</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
