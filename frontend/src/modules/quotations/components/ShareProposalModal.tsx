'use client';

import { useState } from 'react';
import {
  X,
  Mail,
  Check,
  ExternalLink,
  MessageSquare,
  Sparkles,
} from 'lucide-react';

function CopyIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function SendIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}
import { quotationsApi } from '../api';
import type { Quotation } from '../types';

interface Props {
  quotation: Quotation;
  isOpen: boolean;
  onClose: () => void;
  onSent: (updatedQuotation: Quotation) => void;
}

export default function ShareProposalModal({
  quotation,
  isOpen,
  onClose,
  onSent,
}: Props) {
  const [activeTab, setActiveTab] = useState<'email' | 'whatsapp' | 'link'>('email');

  // Email form state
  const leadObj: any = typeof quotation.leadId === 'object' ? quotation.leadId : null;
  const initialEmail = quotation.clientEmail || leadObj?.email || '';
  const initialPhone = quotation.clientPhone || leadObj?.mobile || '';
  const clientName = quotation.clientName || leadObj?.companyName || 'Valued Client';

  const [recipientEmail, setRecipientEmail] = useState(initialEmail);
  const [emailMessage, setEmailMessage] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  // WhatsApp form state
  const [recipientPhone, setRecipientPhone] = useState(initialPhone);
  const [sharingWhatsapp, setSharingWhatsapp] = useState(false);

  // Link state
  const [copyingLink, setCopyingLink] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen) return null;

  const quoteId = quotation._id || quotation.id;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const trackingToken = quotation.trackingToken || quoteId;
  const publicProposalUrl = `${origin}/q/${trackingToken}`;

  const formattedTotal = (quotation.total / 100).toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  });

  // Compose professional WhatsApp message
  const whatsappMessage = `Hello ${clientName},

Here is your official Outdoor Media Proposal #${quotation.quoteNumber} from Media Octus.

*Contract Value:* ${formattedTotal}
*Review Sites & Accept Proposal Online:*
${publicProposalUrl}

Please review the campaign details and let us know if you need any adjustments.

Best Regards,
Media Octus Team`;

  // 1. Handle Email Dispatch
  const handleSendEmail = async () => {
    if (!recipientEmail) {
      alert('Please enter a recipient email');
      return;
    }
    try {
      setSendingEmail(true);
      const res = await quotationsApi.send(quoteId, recipientEmail, emailMessage, 'email');
      if (res.quotation) {
        onSent(res.quotation);
      }
      alert(`Proposal #${quotation.quoteNumber} successfully sent to ${recipientEmail}!`);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to dispatch email');
    } finally {
      setSendingEmail(false);
    }
  };

  // 2. Handle WhatsApp Share (Marks as Sent and opens WhatsApp Web/App)
  const handleShareWhatsapp = async () => {
    const cleanPhone = recipientPhone.replace(/[^0-9]/g, '');
    try {
      setSharingWhatsapp(true);
      // Mark as Sent with channel 'whatsapp' in CRM backend
      const res = await quotationsApi.send(
        quoteId,
        cleanPhone ? `+91 ${cleanPhone}` : clientName,
        'Shared via WhatsApp',
        'whatsapp',
      );
      if (res.quotation) {
        onSent(res.quotation);
      }

      // Open WhatsApp web or native app
      const phoneParam = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
      const waUrl = phoneParam
        ? `https://wa.me/${phoneParam}?text=${encodeURIComponent(whatsappMessage)}`
        : `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`;

      window.open(waUrl, '_blank', 'noopener,noreferrer');
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to process WhatsApp share');
    } finally {
      setSharingWhatsapp(false);
    }
  };

  // 3. Handle Copy Link (Marks as Sent and copies link to clipboard)
  const handleCopyLink = async () => {
    try {
      setCopyingLink(true);
      await navigator.clipboard.writeText(publicProposalUrl);
      setCopiedLink(true);

      // Also record as Sent in backend if still Draft
      if (quotation.status === 'Draft') {
        const res = await quotationsApi.send(
          quoteId,
          recipientEmail || clientName,
          'Shared via Public Link',
          'link',
        );
        if (res.quotation) {
          onSent(res.quotation);
        }
      }

      setTimeout(() => setCopiedLink(false), 2500);
    } catch (err: any) {
      alert(err.message || 'Failed to copy link');
    } finally {
      setCopyingLink(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4 dark:border-slate-800 dark:bg-slate-800/40">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-[#8B2424] dark:text-rose-400">
                {quotation.quoteNumber}
              </span>
              <span
                className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  quotation.status === 'Sent'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300'
                    : quotation.status === 'Accepted'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300'
                }`}
              >
                {quotation.status}
              </span>
            </div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Dispatch &amp; Share Proposal
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Client: <strong className="text-slate-700 dark:text-slate-300">{clientName}</strong> &bull; Total Value: <strong className="text-slate-900 dark:text-white">{formattedTotal}</strong>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Dispatch Channel Tab Bar */}
        <div className="grid grid-cols-3 border-b border-slate-200 bg-slate-100/60 p-1.5 dark:border-slate-800 dark:bg-slate-950/40 gap-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('email')}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2 transition cursor-pointer ${
              activeTab === 'email'
                ? 'bg-white text-[#8B2424] shadow-xs dark:bg-slate-800 dark:text-rose-400'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <Mail className="h-3.5 w-3.5" />
            <span>Email</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('whatsapp')}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2 transition cursor-pointer ${
              activeTab === 'whatsapp'
                ? 'bg-white text-emerald-600 shadow-xs dark:bg-slate-800 dark:text-emerald-400'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>WhatsApp</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('link')}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2 transition cursor-pointer ${
              activeTab === 'link'
                ? 'bg-white text-indigo-600 shadow-xs dark:bg-slate-800 dark:text-indigo-400'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <CopyIcon className="h-3.5 w-3.5" />
            <span>Direct Link</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6">
          {/* TAB 1: EMAIL DISPATCH */}
          {activeTab === 'email' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-xs text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/20 dark:text-blue-300">
                Dispatches a formal branded email with quotation summary and an interactive review link.
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Recipient Email *
                </label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="client@company.com"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:border-[#8B2424] focus:ring-1 focus:ring-[#8B2424] dark:border-slate-700 dark:bg-slate-950 dark:text-white transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Personalized Note / Instructions (Optional)
                </label>
                <textarea
                  rows={3}
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                  placeholder="e.g. As discussed, special prime location discount has been applied for your Q4 brand launch."
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 outline-none focus:border-[#8B2424] focus:ring-1 focus:ring-[#8B2424] dark:border-slate-700 dark:bg-slate-950 dark:text-white transition resize-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  disabled={sendingEmail || !recipientEmail}
                  onClick={handleSendEmail}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#8B2424] px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#721c1c] disabled:opacity-50 transition cursor-pointer"
                >
                  <SendIcon className="h-3.5 w-3.5" />
                  <span>{sendingEmail ? 'Sending Email...' : 'Send Official Email'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: WHATSAPP SHARE */}
          {activeTab === 'whatsapp' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 text-xs text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300">
                Instantly opens WhatsApp Web or App with a pre-composed message and marks proposal as <strong>Sent</strong>.
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Client Mobile Number (10 digits)
                </label>
                <input
                  type="tel"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  placeholder="9876543210"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Message Preview
                </label>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 whitespace-pre-wrap font-mono leading-relaxed max-h-36 overflow-y-auto">
                  {whatsappMessage}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  disabled={sharingWhatsapp}
                  onClick={handleShareWhatsapp}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition cursor-pointer"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>{sharingWhatsapp ? 'Opening WhatsApp...' : 'Open WhatsApp & Mark Sent'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: DIRECT LINK */}
          {activeTab === 'link' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 text-xs text-indigo-800 dark:border-indigo-900/60 dark:bg-indigo-950/20 dark:text-indigo-300">
                Share this secure direct URL via SMS, Skype, Slack, or any channel. Client can view, accept, or reject online.
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Public Client Portal URL
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={publicProposalUrl}
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono text-xs text-slate-700 select-all outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
                  />
                  <a
                    href={publicProposalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition"
                    title="Open public link in new tab"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  disabled={copyingLink}
                  onClick={handleCopyLink}
                  className={`w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-xs transition cursor-pointer ${
                    copiedLink
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {copiedLink ? (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Copied to Clipboard! (Marked Sent)</span>
                    </>
                  ) : (
                    <>
                      <CopyIcon className="h-4 w-4" />
                      <span>{copyingLink ? 'Copying...' : 'Copy Link & Mark Sent'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-3 dark:border-slate-800 dark:bg-slate-800/40 text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-amber-500" />
            Automatic audit logging enabled
          </span>
          <button
            type="button"
            onClick={onClose}
            className="font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
