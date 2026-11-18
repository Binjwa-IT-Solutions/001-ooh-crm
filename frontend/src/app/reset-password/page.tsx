'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, Check, AlertCircle, Eye, EyeOff, ShieldCheck } from 'lucide-react';

import { toErrorMessage } from '@/shared/api/errors';
import { authApi } from '@/shared/auth/auth-api';
import { AuthCard, authButtonClass, authInputClass } from '@/shared/auth/auth-card';
import { Alert, Spinner } from '@/shared/ui';

type LinkState = 'checking' | 'valid' | 'invalid' | 'done';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [state, setState] = useState<LinkState>(token ? 'checking' : 'invalid');
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    authApi
      .checkResetToken(token)
      .then((res) => {
        if (cancelled) return;
        setMaskedEmail(res.email ?? null);
        setState(res.valid ? 'valid' : 'invalid');
      })
      .catch(() => !cancelled && setState('invalid'));
    return () => {
      cancelled = true;
    };
  }, [token]);

  const rules = [
    { ok: password.length >= 8, label: 'At least 8 characters' },
    { ok: /[A-Za-z]/.test(password) && /\d/.test(password), label: 'Letters and numbers' },
    { ok: password.length > 0 && password === confirm, label: 'Both passwords match' },
  ];
  const canSubmit = rules.every((r) => r.ok) && !submitting;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await authApi.resetPassword(token, password);
      setState('done');
    } catch (err) {
      const message = toErrorMessage(err);
      setError(message);
      if (/invalid or has expired/i.test(message)) setState('invalid');
    } finally {
      setSubmitting(false);
    }
  };

  if (state === 'checking') {
    return (
      <AuthCard>
        <div className="flex flex-col items-center gap-3 py-8 text-sm text-slate-500">
          <Spinner />
          Checking your reset link…
        </div>
      </AuthCard>
    );
  }

  if (state === 'invalid') {
    return (
      <AuthCard>
        <div className="text-center space-y-5">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <AlertCircle className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">This link has expired</h1>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Reset links work once and expire after 30 minutes. If you requested more than one, only the newest
              link works.
            </p>
          </div>
          <Link href="/forgot-password" className={authButtonClass}>
            Request a new link
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-[#6a1b21]"
          >
            <ArrowLeft className="h-4 w-4" /> Back to sign in
          </Link>
        </div>
      </AuthCard>
    );
  }

  if (state === 'done') {
    return (
      <AuthCard>
        <div className="text-center space-y-5">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Password updated</h1>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Your password has been changed and you&apos;ve been signed out of all devices. Sign in with your new
              password.
            </p>
          </div>
          <button type="button" onClick={() => router.replace('/login?reason=password-reset')} className={authButtonClass}>
            Go to sign in
          </button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Choose a new password</h1>
          <p className="mt-1.5 text-sm text-slate-600">
            {maskedEmail ? (
              <>
                For <span className="font-semibold text-slate-800">{maskedEmail}</span>
              </>
            ) : (
              'Enter a new password for your account.'
            )}
          </p>
        </div>

        {error && <Alert tone="error">{error}</Alert>}

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div>
            <label htmlFor="new-password" className="block text-sm font-semibold text-slate-800 mb-1.5">
              New password
            </label>
            <div className="relative">
              <input
                id="new-password"
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${authInputClass} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirm-password" className="block text-sm font-semibold text-slate-800 mb-1.5">
              Confirm new password
            </label>
            <input
              id="confirm-password"
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={authInputClass}
            />
          </div>

          <ul className="space-y-1.5 text-xs">
            {rules.map((r) => (
              <li key={r.label} className={`flex items-center gap-2 ${r.ok ? 'text-emerald-700' : 'text-slate-500'}`}>
                <Check className={`h-3.5 w-3.5 ${r.ok ? 'opacity-100' : 'opacity-30'}`} />
                {r.label}
              </li>
            ))}
          </ul>

          <button type="submit" disabled={!canSubmit} className={authButtonClass}>
            {submitting ? <Spinner /> : 'Update password'}
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
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
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
      <ResetPasswordForm />
    </Suspense>
  );
}
