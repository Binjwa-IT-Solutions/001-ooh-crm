'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState, type FormEvent } from 'react';

import { ApiError, toErrorMessage } from '@/shared/api/errors';
import { authApi } from '@/shared/auth/auth-api';
import { useAuth } from '@/shared/auth/auth-context';
import type { LoginChallenge } from '@/shared/auth/types';
import { Alert, Spinner } from '@/shared/ui';

/**
 * Sign-in, in two steps.
 *
 *   Step 1  email + password  -> the API issues an OTP
 *   Step 2  the 6-digit code  -> the API issues a session
 */

type Step = 'credentials' | 'otp' | 'success';

const SHOW_DEMO_HINT = process.env.NODE_ENV !== 'production';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { completeSignIn, isAuthenticated, isLoading } = useAuth();

  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [challenge, setChallenge] = useState<LoginChallenge | null>(null);
  const [devMode, setDevMode] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const codeInputRef = useRef<HTMLInputElement>(null);

  // Already signed in? Skip the form.
  useEffect(() => {
    if (!isLoading && isAuthenticated && step !== 'success') router.replace('/dashboard');
  }, [isLoading, isAuthenticated, router, step]);

  // Resend cooldown countdown.
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  useEffect(() => {
    if (step === 'otp') {
      const firstInput = document.getElementById('otp-input-0');
      if (firstInput) firstInput.focus();
    }
  }, [step]);

  const displayedNotice =
    notice ??
    (searchParams.get('reason') === 'expired' && step === 'credentials' && !error
      ? 'Your session expired. Please sign in again.'
      : null);

  function applyError(err: unknown) {
    setError(toErrorMessage(err));
    setFieldErrors(err instanceof ApiError ? err.fieldErrors() : {});
  }

  function applyChallenge(response: { devMode: boolean; challenge: LoginChallenge }) {
    setChallenge(response.challenge);
    setDevMode(response.devMode);
    setResendIn(response.challenge.resendAvailableInSeconds);
    setCode(response.challenge.devOtp ?? '');
  }

  async function handleCredentials(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const response = await authApi.startLogin(email, password);
      applyChallenge(response);
      setStep('otp');
    } catch (err) {
      applyError(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerify(event: FormEvent) {
    event.preventDefault();
    if (!challenge) return;

    setError(null);
    setNotice(null);
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const session = await authApi.verifyOtp(challenge.challengeId, code);
      completeSignIn(session);
      setStep('success');
      // Delay navigation to show success screen briefly if desired, or let user click
    } catch (err) {
      applyError(err);
      setCode('');
      const firstInput = document.getElementById('otp-input-0');
      if (firstInput) firstInput.focus();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    if (!challenge || resendIn > 0) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await authApi.resendOtp(challenge.challengeId);
      applyChallenge(response);
      setNotice('A new code has been sent.');
    } catch (err) {
      applyError(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  function backToCredentials() {
    setStep('credentials');
    setChallenge(null);
    setCode('');
    setError(null);
    setNotice(null);
  }

  const handleCodeChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = code.split('').slice(0, 6);
    while (newCode.length < 6) newCode.push('');
    newCode[index] = value;
    const joined = newCode.join('');
    setCode(joined.slice(0, 6));

    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-input-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && (!code[index] || code[index] === '') && index > 0) {
      const prevInput = document.getElementById(`otp-input-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  return (
    <main
      className="flex min-h-screen items-center justify-center bg-cover bg-center px-4 py-12"
      style={{ backgroundImage: "url('/bglogin.png?v=2')" }}
    >
      <div className="w-full max-w-md bg-white rounded-3xl p-8 sm:p-10 shadow-2xl relative">
        <div className="text-center mb-8">
          <img src="/logo.png?v=3" alt="Media Octus" className="h-20 mx-auto object-contain" />
        </div>

        {displayedNotice && (
          <div className="mb-6">
            <Alert tone="info">{displayedNotice}</Alert>
          </div>
        )}

        {error && (
          <div className="mb-6">
            <Alert tone="error">{error}</Alert>
          </div>
        )}

        {step === 'credentials' && (
          <>
            <div className="text-left mb-8">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Welcome to Media Octus.<br />
                Login and get started.
              </h1>
              <p className="mt-2 text-sm text-slate-500 font-medium">
                Enter your details to proceed further
              </p>
            </div>

            <form onSubmit={handleCredentials} className="space-y-5" noValidate>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  autoComplete="username"
                  placeholder="youremail@gmail.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={`w-full px-4 py-3 rounded-xl border ${
                    fieldErrors.email ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-slate-400'
                  } focus:outline-none focus:ring-2 bg-white text-slate-900`}
                  required
                />
                {fieldErrors.email && (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.email}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className={`w-full px-4 py-3 rounded-xl border ${
                      fieldErrors.password ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-slate-400'
                    } focus:outline-none focus:ring-2 bg-white text-slate-900 pr-12`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                  </button>
                </div>
                {fieldErrors.password && (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.password}</p>
                )}
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-[#9E2931] focus:ring-[#9E2931]"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm font-medium text-slate-500">
                    Remember me
                  </label>
                </div>

                <div className="text-sm">
                  <a href="#" className="font-medium text-slate-500 hover:text-slate-700">
                    Forgot Password?
                  </a>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 bg-[#A32A32] hover:bg-[#8B2228] text-white font-semibold py-3.5 px-4 rounded-xl transition-colors duration-200 mt-4 disabled:opacity-70"
              >
                {isSubmitting ? (
                  <Spinner className="w-5 h-5 border-white" />
                ) : (
                  <>
                    LOG IN
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                  </>
                )}
              </button>
            </form>

            {SHOW_DEMO_HINT && (
              <div className="mt-8">
                <Alert tone="info" title="Demo accounts">
                  <p className="text-xs">
                    Sign in as <code className="font-mono">admin@</code>,{' '}
                    <code className="font-mono">manager@</code>, etc. with password <code className="font-mono">Password123!</code>
                  </p>
                </Alert>
              </div>
            )}
          </>
        )}

        {step === 'otp' && (
          <>
            <div className="text-left mb-8">
              <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#fceceb] text-[#A32A32]">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Verify Your Identity
              </h1>
              <p className="mt-2 text-sm text-slate-500 font-medium leading-relaxed">
                Open Microsoft Authenticator and enter the 6-digit code to continue.
              </p>
            </div>

            <form onSubmit={handleVerify} className="space-y-8" noValidate>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  Verification Code
                </label>
                <div className="flex justify-between gap-2">
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <input
                      key={index}
                      id={`otp-input-${index}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={code[index] || ''}
                      onChange={(e) => handleCodeChange(index, e.target.value)}
                      onKeyDown={(e) => handleCodeKeyDown(index, e)}
                      className={`w-12 h-14 text-center text-xl font-bold rounded-xl border ${
                        fieldErrors.code ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-slate-400'
                      } focus:outline-none focus:ring-2 bg-white text-slate-900 transition-colors`}
                      required
                    />
                  ))}
                </div>
                {fieldErrors.code && (
                  <p className="mt-2 text-sm text-red-600">{fieldErrors.code}</p>
                )}
              </div>

              <div className="flex flex-col gap-4">
                <div className="inline-flex items-center self-start gap-2 rounded-md bg-[#fceceb] px-3 py-1.5 text-xs font-semibold text-[#A32A32]">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                  {resendIn > 0 ? (
                    <span>New code available in <span className="font-bold">00:{resendIn.toString().padStart(2, '0')}</span></span>
                  ) : (
                    <button type="button" onClick={handleResend} disabled={isSubmitting} className="hover:underline">
                      Resend code
                    </button>
                  )}
                </div>

                <p className="flex items-center gap-2 text-xs font-medium text-slate-500">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  Your verification code helps keep your account safe
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || code.length !== 6}
                className="w-full flex items-center justify-center gap-2 bg-[#A32A32] hover:bg-[#8B2228] text-white font-semibold py-3.5 px-4 rounded-xl transition-colors duration-200 disabled:opacity-70"
              >
                {isSubmitting ? (
                  <Spinner className="w-5 h-5 border-white" />
                ) : (
                  <>
                    SUBMIT
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                  </>
                )}
              </button>

              <div className="mt-8 text-center text-sm">
                <div className="flex items-center justify-center gap-4 mb-4">
                  <div className="h-px bg-slate-200 flex-1"></div>
                  <p className="text-slate-400 font-medium">Having trouble?</p>
                  <div className="h-px bg-slate-200 flex-1"></div>
                </div>
                <button
                  type="button"
                  onClick={backToCredentials}
                  className="font-bold text-[#A32A32] hover:text-[#8B2228] underline underline-offset-4"
                >
                  Try another way
                </button>
              </div>

              {devMode && challenge?.devOtp && (
                <Alert tone="warning" title="Development mode">
                  <p>
                    Your code is{' '}
                    <span className="font-mono text-base font-semibold tracking-widest">
                      {challenge.devOtp}
                    </span>
                  </p>
                </Alert>
              )}
            </form>
          </>
        )}

        {step === 'success' && (
          <div className="text-center py-12">
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-[#4ade80] text-white shadow-lg shadow-green-200">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-12 h-12">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-3">
              Welcome back
            </h1>
            <p className="text-sm text-slate-500 font-medium mb-12">
              you have been logged in successfully
            </p>
            
            <button
              type="button"
              onClick={() => router.replace('/dashboard')}
              className="w-full bg-[#A32A32] hover:bg-[#8B2228] text-white font-semibold py-3.5 px-4 rounded-xl transition-colors duration-200 uppercase tracking-wide text-sm"
            >
              GO TO DASHBOARD
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main
          className="flex min-h-screen items-center justify-center bg-cover bg-center px-4"
          style={{ backgroundImage: "url('/bglogin.png?v=2')" }}
        >
          <div className="w-full max-w-md bg-white rounded-3xl p-12 shadow-2xl flex justify-center">
            <Spinner />
          </div>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
