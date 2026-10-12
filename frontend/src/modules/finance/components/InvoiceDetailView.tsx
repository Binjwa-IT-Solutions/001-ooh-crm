'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Download,
  Printer,
  Share2,
  PlusCircle,
  Copy,
  Edit,
  Trash2,
  History,
  CheckCircle,
  Clock,
  Building2,
  CreditCard,
  FileText,
  AlertTriangle,
  ArrowLeft,
  ShieldCheck,
  Check,
  ExternalLink,
} from 'lucide-react';
import type { Invoice } from '../types';
import { invoicesApi } from '../api';
import { formatCurrency, formatDate } from '../utils/formatters';
import { InvoiceEditHistoryModal } from './InvoiceEditHistoryModal';
import { PaymentInModal } from './PaymentInModal';

interface InvoiceDetailViewProps {
  invoice: Invoice;
  onRefresh?: () => void;
}

export function InvoiceDetailView({ invoice, onRefresh }: InvoiceDetailViewProps) {
  const router = useRouter();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isProforma = invoice.type === 'proforma';
  const isFullyPaid = invoice.status === 'Paid' || invoice.balanceAmount === 0;

  const [converting, setConverting] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    window.open(invoicesApi.getPdfDownloadUrl(invoice.id), '_blank');
  };

  const handleShare = () => {
    const publicUrl = `${window.location.origin}/invoices/share/${invoice.shareToken || invoice.id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleConvert = async () => {
    setConverting(true);
    setActionError(null);
    try {
      const res = await invoicesApi.convertToSalesInvoice(invoice.id);
      if (res.invoice?.id) {
        router.push(`/finance/invoices/${res.invoice.id}`);
      }
    } catch (err: any) {
      setActionError(err?.message || 'Failed to convert to Sales Invoice');
      setConverting(false);
    }
  };

  const handleDuplicate = async () => {
    try {
      const res = await invoicesApi.duplicateInvoice(invoice.id);
      if (res.invoice?.id) {
        const path = res.invoice.type === 'proforma' ? `/finance/proforma-invoices/${res.invoice.id}` : `/finance/invoices/${res.invoice.id}`;
        router.push(path);
      }
    } catch (err: any) {
      setActionError(err?.message || 'Failed to duplicate invoice');
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setActionError(null);
    try {
      await invoicesApi.deleteInvoice(invoice.id);
      router.push(isProforma ? '/finance/proforma-invoices' : '/finance/invoices');
    } catch (err: any) {
      setActionError(err?.message || 'Failed to delete invoice');
      setDeleting(false);
      setDeleteConfirmOpen(false);
    }
  };

  const percentagePaid = invoice.totalAmount > 0
    ? Math.min(100, Math.round((invoice.amountReceived / invoice.totalAmount) * 100))
    : 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Top Action Bar (Hidden in Print) */}
      <div className="print:hidden flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href={isProforma ? '/finance/proforma-invoices' : '/finance/invoices'}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">{invoice.invoiceNumber}</h1>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  invoice.status === 'Paid'
                    ? 'bg-emerald-100 text-emerald-800'
                    : invoice.status === 'Partially Paid'
                    ? 'bg-amber-100 text-amber-800'
                    : invoice.status === 'Overdue'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {invoice.status}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {isProforma ? 'Proforma Invoice' : 'Sales Tax Invoice'} · Created by {invoice.createdBy?.name || 'Staff'} on{' '}
              {formatDate(invoice.createdAt)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Convert to Tax Invoice (for Proforma) */}
          {isProforma && (
            <button
              type="button"
              onClick={handleConvert}
              disabled={converting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#6E1D1D] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#581717] shadow-2xs transition-colors disabled:opacity-50"
              title="Convert this Proforma into a live Sales Tax Invoice"
            >
              <FileText className="h-4 w-4" />
              {converting ? 'Converting...' : 'Convert to Tax Invoice'}
            </button>
          )}

          {/* Record Payment In (if not fully paid and not cancelled) */}
          {!isFullyPaid && invoice.status !== 'Cancelled' && (
            <button
              type="button"
              onClick={() => setPaymentModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 shadow-2xs transition-colors"
            >
              <PlusCircle className="h-4 w-4" />
              Record Payment
            </button>
          )}

          {/* Download PDF */}
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
          >
            <Download className="h-4 w-4 text-slate-500" />
            PDF
          </button>

          {/* Print */}
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
          >
            <Printer className="h-4 w-4 text-slate-500" />
            Print
          </button>

          {/* Share */}
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
            title="Copy share link"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Share2 className="h-4 w-4 text-slate-500" />}
            {copied ? 'Copied!' : 'Share'}
          </button>

          {/* Duplicate */}
          <button
            type="button"
            onClick={handleDuplicate}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
            title="Duplicate Invoice"
          >
            <Copy className="h-4 w-4 text-slate-500" />
            Duplicate
          </button>

          {/* Edit History */}
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
            title="View Audit Trail"
          >
            <History className="h-4 w-4 text-slate-500" />
            History ({invoice.editHistory?.length || 1})
          </button>

          {/* Edit */}
          <Link
            href={isProforma ? `/finance/proforma-invoices/${invoice.id}/edit` : `/finance/invoices/${invoice.id}/edit`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
          >
            <Edit className="h-4 w-4 text-slate-500" />
            Edit
          </Link>

          {/* Delete */}
          <button
            type="button"
            onClick={() => setDeleteConfirmOpen(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 shadow-2xs transition-colors"
            title="Delete invoice"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {actionError && (
        <div className="print:hidden rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Compliance / E-Way & E-Invoice Integration Badges (Client Reference) */}
      <div className="print:hidden flex flex-wrap items-center gap-3 bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs">
        <span className="font-semibold text-slate-700">Govt Compliance Integrations:</span>
        <button
          type="button"
          disabled
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-400 font-medium cursor-not-allowed opacity-80"
          title="E-Way Bill module ready for NIC API integration"
        >
          <ExternalLink className="h-3 w-3" />
          Generate E-Way Bill (Ready)
        </button>
        <button
          type="button"
          disabled
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-400 font-medium cursor-not-allowed opacity-80"
          title="E-Invoice IRP module ready for API integration"
        >
          <ExternalLink className="h-3 w-3" />
          Generate E-Invoice (Ready)
        </button>
      </div>

      {/* Payment & Balance Status Card */}
      <div className="print:hidden rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
          <div>
            <h3 className="text-xs font-bold tracking-wider text-slate-500 uppercase">Payment Summary</h3>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold text-slate-900">{formatCurrency(invoice.totalAmount)}</span>
              <span className="text-xs text-slate-500">total invoice value</span>
            </div>
          </div>

          <div className="flex items-center gap-6 text-right">
            <div>
              <span className="text-[11px] text-slate-500 block">Received Amount</span>
              <span className="text-base font-bold text-emerald-600">{formatCurrency(invoice.amountReceived)}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">Balance Pending</span>
              <span className={`text-base font-bold ${invoice.balanceAmount > 0 ? 'text-[#6E1D1D]' : 'text-slate-900'}`}>
                {formatCurrency(invoice.balanceAmount)}
              </span>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${
              percentagePaid >= 100 ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
            style={{ width: `${percentagePaid}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-slate-400">
          <span>{percentagePaid}% settled</span>
          <span>Due date: {formatDate(invoice.dueDate)}</span>
        </div>
      </div>

      {/* Actual Printable Invoice Document Layout */}
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
              {invoice.campaignName && (
                <div>
                  <span className="font-medium text-slate-700">Campaign: </span>
                  {invoice.campaignName}
                </div>
              )}
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
            const totalItemDiscount = invoice.items.reduce((sum, item) => sum + (item.discount || 0), 0);
            return (
              <>
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
                      <tr key={idx} className="hover:bg-slate-50/50">
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
              </>
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

      {/* Payment History Section (Hidden in Print) */}
      <div className="print:hidden rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#6E1D1D]" />
            Payment History & Settlements
          </h3>
          <span className="text-xs text-slate-500">
            {invoice.payments?.length || 0} payment transaction{(invoice.payments?.length || 0) > 1 ? 's' : ''}
          </span>
        </div>

        {invoice.payments && invoice.payments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Payment Method</th>
                  <th className="py-2.5 px-3">Transaction Reference</th>
                  <th className="py-2.5 px-3">Notes</th>
                  <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoice.payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 text-slate-700 font-medium">{formatDate(p.receivedAt)}</td>
                    <td className="py-2.5 px-3 text-slate-800 capitalize font-medium">
                      {p.method.replace('_', ' ')}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">{p.transactionId || '—'}</td>
                    <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate">{p.notes || '—'}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-600">
                      {formatCurrency(p.amount)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                        Recorded
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-slate-500">
            No payments recorded against this invoice yet.
            {!isFullyPaid && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(true)}
                  className="text-xs font-semibold text-[#6E1D1D] hover:underline"
                >
                  + Record first payment
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Audit History Modal */}
      <InvoiceEditHistoryModal
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        invoiceNumber={invoice.invoiceNumber}
        history={invoice.editHistory || []}
      />

      {/* Record Payment In Modal */}
      {paymentModalOpen && (
        <PaymentInModal
          isOpen={paymentModalOpen}
          onClose={() => setPaymentModalOpen(false)}
          onSuccess={() => {
            setPaymentModalOpen(false);
            onRefresh?.();
          }}
          invoiceId={invoice.id}
          prefillData={{
            campaignId: invoice.campaignId || '',
            clientId: invoice.partyId || '',
            amountPaise: invoice.balanceAmount,
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Confirm Deletion</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete invoice <strong className="text-slate-900">{invoice.invoiceNumber}</strong>?
              This will safely soft-delete the invoice record and preserve audit history.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                disabled={deleting}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
