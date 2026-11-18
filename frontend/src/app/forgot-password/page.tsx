'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, Mail } from 'lucide-react';

import { toErrorMessage } from '@/shared/api/errors';
import { authApi } from '@/shared/auth/auth-api';
import { AuthCard, authButtonClass, authInputClass } from '@/shared/auth/auth-card';
import { Alert, Spinner } from '@/shared/ui';

const RESEND_SECONDS = 60;

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(() => searchParams.get('email') ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const send = async () => {
    const value = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(value)) {
      setError('Enter a valid email address.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await authApi.forgotPassword(value);
      setSentTo(value);
      setDevResetUrl(res.devResetUrl ?? null);
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send();
  };

  return (
    <AuthCard>
      {sentTo ? (
        <div className="text-center space-y-5">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#6a1b21]/10 text-[#6a1b21]">
            <Mail className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Check your email</h1>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              If an account exists for <span className="font-semibold text-slate-800">{sentTo}</span>, we&apos;ve
              sent a link to reset your password. It expires in 30 minutes.
            </p>
            <p className="mt-2 text-xs text-slate-500">Don&apos;t see it? Check your spam folder.</p>
          </div>

          {devResetUrl && (
            <div className="text-left">
              <Alert tone="info">
                <span className="font-semibold">Development mode:</span>{' '}
                <a href={devResetUrl} className="underline break-all">
                  open the reset link
                </a>
              </Alert>
            </div>
          )}

          {error && <Alert tone="error">{error}</Alert>}

          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={() => void send()}
              disabled={cooldown > 0 || submitting}
              className="w-full py-3 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? 'Sending…' : cooldown > 0 ? `Resend link in ${cooldown}s` : 'Resend link'}
            </button>
            <button
              type="button"
              onClick={() => {
                setSentTo(null);
                setDevResetUrl(null);
                setError(null);
              }}
              className="text-sm font-semibold text-slate-600 hover:text-[#6a1b21]"
            >
              Use a different email
            </button>
          </div>

          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#6a1b21] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Back to sign in
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Forgot your password?</h1>
            <p className="mt-1.5 text-sm text-slate-600">
              Enter your work email and we&apos;ll send you a link to set a new one.
            </p>
          </div>

          {error && <Alert tone="error">{error}</Alert>}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-800 mb-1.5">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                autoFocus
                placeholder="your.work.email@mediaoctus.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={authInputClass}
                required
              />
            </div>

            <button type="submit" disabled={submitting} className={authButtonClass}>
              {submitting ? <Spinner /> : 'Send reset link'}
            </button>
          </form>

          <div className="text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-[#6a1b21]"
            >
              <ArrowLeft className="h-4 w-4" /> Back to sign in
            </Link>
          </div>
        </div>
      )}
    </AuthCard>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthCard>
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        </AuthCard>
      }
    >
      <ForgotPasswordForm />
    </Suspense>
  );
}
