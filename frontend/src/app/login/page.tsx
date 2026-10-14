'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ShieldCheck } from 'lucide-react';

import { ApiError, toErrorMessage } from '@/shared/api/errors';
import { authApi } from '@/shared/auth/auth-api';
import { useAuth } from '@/shared/auth/auth-context';
import type {
  LoginChallenge,
  LoginLocation,
  MfaEnrollmentRequiredResponse,
} from '@/shared/auth/types';
import { Alert, Spinner } from '@/shared/ui';

/**
 * Sign-in, in two steps.
 *
 *   Step 1  email + password  -> the API requests a second factor
 *   Step 2  verify a code     -> enroll an authenticator or issue a session
 */

type Step = 'credentials' | 'approval' | 'otp' | 'enroll' | 'success';

function requestLoginLocation(): Promise<LoginLocation | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null);

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 8_000 },
    );
  });
}

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
  const [enrollment, setEnrollment] = useState<MfaEnrollmentRequiredResponse | null>(null);
  const [approvalRequestId, setApprovalRequestId] = useState<string | null>(null);
  const [approvalPollToken, setApprovalPollToken] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    if (step === 'otp' || step === 'enroll') {
      const firstInput = document.getElementById('otp-input-0');
      if (firstInput) firstInput.focus();
    }
  }, [step]);

  useEffect(() => {
    const requestId = approvalRequestId;
    const pollToken = approvalPollToken;
    if (step !== 'approval' || !requestId || !pollToken) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function checkApproval(requestId: string, token: string) {
      try {
        const result = await authApi.loginApprovalStatus(requestId, token);
        if (cancelled) return;

        if (result.status === 'approved' && result.challenge) {
          setChallenge(result.challenge);
          setResendIn(result.challenge.resendAvailableInSeconds);
          setApprovalRequestId(null);
          setApprovalPollToken(null);
          setNotice('An administrator approved your login. Complete verification to continue.');
          setStep('otp');
          return;
        }

        if (result.status === 'denied' || result.status === 'expired') {
          setApprovalRequestId(null);
          setApprovalPollToken(null);
          setError(
            result.status === 'denied'
              ? 'An administrator denied this login request.'
              : 'This login approval request expired. Please sign in again.',
          );
          setStep('credentials');
          return;
        }
      } catch {
        if (!cancelled) {
          setError('Could not check approval status. Retrying automatically.');
        }
      }

      if (!cancelled) timer = setTimeout(() => void checkApproval(requestId, token), 2500);
    }

    void checkApproval(requestId, pollToken);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [approvalPollToken, approvalRequestId, step]);

  const displayedNotice =
    notice ??
    (searchParams.get('reason') === 'expired' && step === 'credentials' && !error
      ? 'Your session expired. Please sign in again.'
      : null);

  function applyError(err: unknown) {
    setError(toErrorMessage(err));
    setFieldErrors(err instanceof ApiError ? err.fieldErrors() : {});
  }

  function applyChallenge(response: { challenge: LoginChallenge }) {
    setChallenge(response.challenge);
    setResendIn(response.challenge.resendAvailableInSeconds);
    setCode('');
  }

  async function handleCredentials(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const location = await requestLoginLocation();
      const response = await authApi.startLogin(email, password, location);
      if ('requiresAdminApproval' in response) {
        setApprovalRequestId(response.approvalRequestId);
        setApprovalPollToken(response.pollToken);
        setStep('approval');
      } else {
        applyChallenge(response);
        setStep('otp');
      }
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
      const result = await authApi.verifyOtp(challenge.challengeId, code);
      if ('requiresMfaEnrollment' in result) {
        setEnrollment(result);
        setCode('');
        setStep('enroll');
      } else {
        completeSignIn(result);
        setStep('success');
      }
    } catch (err) {
      applyError(err);
      setCode('');
      const firstInput = document.getElementById('otp-input-0');
      if (firstInput) firstInput.focus();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleEnrollmentVerify(event: FormEvent) {
    event.preventDefault();
    if (!enrollment) return;

    setError(null);
    setNotice(null);
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const session = await authApi.completeMfaEnrollment(enrollment.enrollmentToken, code);
      completeSignIn(session);
      setStep('success');
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
    if (!challenge || challenge.method !== 'email' || resendIn > 0) return;

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

  async function handleEmailFallback() {
    if (!challenge || challenge.method !== 'totp') return;

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await authApi.requestEmailFallback(challenge.challengeId);
      applyChallenge(response);
      setNotice('A verification code has been sent by email.');
    } catch (err) {
      applyError(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  function backToCredentials() {
    setStep('credentials');
    setChallenge(null);
    setEnrollment(null);
    setApprovalRequestId(null);
    setApprovalPollToken(null);
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
      className="flex min-h-screen items-center justify-end bg-cover bg-center px-4 sm:px-12 lg:px-24 xl:px-32 py-12"
      style={{ backgroundImage: "url('/bglogin.png?v=2')" }}
    >
      <div className="w-full max-w-4xl bg-[#e6ddcd] p-3 sm:p-4 rounded-[2.5rem] shadow-2xl relative transition-all duration-300">
        <div className="bg-white rounded-[2rem] p-8 sm:p-10 lg:p-12 w-full h-full min-h-[650px] relative flex flex-col">
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

          <div className="text-center mb-8">
            <img src="/logo.png?v=4" alt="Media Octus" className="h-20 mx-auto object-contain" />
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#6a1b21] mt-4">
              Employee Portal
            </h1>
          </div>

          <div className="flex flex-col md:flex-row gap-10 lg:gap-16 items-center flex-1">
            <div className="w-full md:w-1/2 flex justify-center order-2 md:order-1 hidden md:flex">
              <img
                src="/login.png"
                alt="Workspace Illustration"
                className="w-full max-w-[300px] object-contain"
              />
            </div>

            <div className="w-full md:w-1/2 order-1 md:order-2 flex flex-col justify-center">
              {step === 'credentials' && (
                <>
                  <div className="text-center md:text-left mb-6">
                    <p className="text-sm text-slate-800 font-medium">
                      Please sign in to access your CRM workspace.
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-slate-500">
                      Your browser will request your location once to help verify this sign-in. If
                      location is unavailable or has changed, an administrator may need to approve
                      the login. Approximate coordinates are retained with login security events.
                    </p>
                  </div>

                  <form onSubmit={handleCredentials} className="space-y-5" noValidate>
                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                        Email Address
                      </label>
                      <input
                        type="email"
                        name="email"
                        autoComplete="username"
                        placeholder="your.work.email@mediaoctus.com"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        className={`w-full px-4 py-3 rounded-xl border ${
                          fieldErrors.email
                            ? 'border-red-500 focus:ring-red-500'
                            : 'border-slate-300 focus:ring-slate-500'
                        } focus:outline-none focus:ring-2 bg-white text-slate-900`}
                        required
                      />
                      {fieldErrors.email && (
                        <p className="mt-1 text-sm text-red-600">{fieldErrors.email}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-1.5">
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
                            fieldErrors.password
                              ? 'border-red-500 focus:ring-red-500'
                              : 'border-slate-300 focus:ring-slate-500'
                          } focus:outline-none focus:ring-2 bg-white text-slate-900 pr-12`}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 focus:outline-none"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                            className="w-5 h-5"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                            />
                          </svg>
                        </button>
                      </div>
                      {fieldErrors.password && (
                        <p className="mt-1 text-sm text-red-600">{fieldErrors.password}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center">
                        <input
                          id="remember-me"
                          name="remember-me"
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-[#6a1b21] focus:ring-[#6a1b21]"
                        />
                        <label
                          htmlFor="remember-me"
                          className="ml-2 block text-sm font-semibold text-slate-800"
                        >
                          Remember Me
                        </label>
                      </div>

                      <div className="text-sm">
                        <a href="#" className="font-semibold text-slate-800 hover:text-[#6a1b21]">
                          Forgot Password?
                        </a>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full flex items-center justify-center gap-2 bg-[#6a1b21] hover:bg-[#521318] text-white font-semibold py-3.5 px-4 rounded-xl transition-colors duration-200 mt-6 disabled:opacity-70"
                    >
                      {isSubmitting ? (
                        <Spinner className="w-5 h-5 border-white" />
                      ) : (
                        'LOGIN TO PORTAL'
                      )}
                    </button>
                  </form>

                  <div className="mt-8 text-center text-xs font-semibold text-slate-800 space-y-3">
                    <p>
                      New Employee?{' '}
                      <a href="#" className="text-[#6a1b21] hover:underline">
                        Contact IT Support
                      </a>
                    </p>
                    <p>
                      <a href="#" className="hover:underline">
                        View Company Announcements (Public)
                      </a>
                    </p>
                  </div>
                </>
              )}

              {step === 'otp' && (
                <>
                  <div className="text-center md:text-left mb-6">
                    <h2 className="text-xl font-bold tracking-tight text-slate-900">
                      {challenge?.method === 'totp'
                        ? 'Authenticator Verification'
                        : 'Verify Your Identity'}
                    </h2>
                    <p className="mt-2 text-sm text-slate-600 font-medium leading-relaxed">
                      {challenge?.method === 'totp'
                        ? challenge.emailFallbackRequiresEnrollment
                          ? 'Open your authenticator app and enter the current 6-digit code. Email recovery requires setting up a new authenticator before you can access the CRM.'
                          : 'Open your authenticator app and enter the current 6-digit code.'
                        : challenge?.delivery === 'console'
                          ? 'Enter the verification code shown in the API server output.'
                          : `Enter the verification code sent to ${challenge?.email}.`}
                    </p>
                  </div>

                  <form onSubmit={handleVerify} className="space-y-6" noValidate>
                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-3 text-center md:text-left">
                        {challenge?.method === 'totp' ? 'Authenticator Code' : 'Verification Code'}
                      </label>
                      <div className="flex justify-center md:justify-between gap-1 sm:gap-2">
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
                            className={`w-10 sm:w-12 h-12 sm:h-14 text-center text-lg sm:text-xl font-bold rounded-xl border ${
                              fieldErrors.code
                                ? 'border-red-500 focus:ring-red-500'
                                : 'border-slate-300 focus:ring-slate-500'
                            } focus:outline-none focus:ring-2 bg-white text-slate-900 transition-colors`}
                            required
                          />
                        ))}
                      </div>
                      {fieldErrors.code && (
                        <p className="mt-2 text-sm text-red-600 text-center md:text-left">
                          {fieldErrors.code}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-4 items-center md:items-start">
                      <div className="inline-flex items-center gap-2 rounded-md bg-[#fceceb] px-3 py-1.5 text-xs font-semibold text-[#6a1b21]">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          stroke="currentColor"
                          className="w-4 h-4"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
                          />
                        </svg>
                        {challenge?.method === 'totp' ? (
                          <button
                            type="button"
                            onClick={handleEmailFallback}
                            disabled={isSubmitting}
                            className="hover:underline"
                          >
                            {challenge?.emailFallbackRequiresEnrollment
                              ? 'Recover by email and set up a new authenticator'
                              : 'Use email code instead'}
                          </button>
                        ) : resendIn > 0 ? (
                          <span>
                            New code available in{' '}
                            <span className="font-bold">
                              00:{resendIn.toString().padStart(2, '0')}
                            </span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={handleResend}
                            disabled={isSubmitting}
                            className="hover:underline"
                          >
                            Resend code
                          </button>
                        )}
                      </div>

                      <p className="flex items-center gap-2 text-xs font-medium text-slate-600 text-center">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                          className="w-4 h-4"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                          />
                        </svg>
                        Your verification code helps keep your account safe
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting || code.length !== 6}
                      className="w-full flex items-center justify-center gap-2 bg-[#6a1b21] hover:bg-[#521318] text-white font-semibold py-3.5 px-4 rounded-xl transition-colors duration-200 disabled:opacity-70"
                    >
                      {isSubmitting ? (
                        <Spinner className="w-5 h-5 border-white" />
                      ) : (
                        <>
                          VERIFY CODE
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                            className="w-4 h-4"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
                            />
                          </svg>
                        </>
                      )}
                    </button>

                    <div className="mt-8 text-center text-sm">
                      <div className="flex items-center justify-center gap-4 mb-4">
                        <div className="h-px bg-slate-200 flex-1"></div>
                        <p className="text-slate-500 font-medium">Having trouble?</p>
                        <div className="h-px bg-slate-200 flex-1"></div>
                      </div>
                      <button
                        type="button"
                        onClick={backToCredentials}
                        className="font-bold text-[#6a1b21] hover:text-[#521318] underline underline-offset-4"
                      >
                        Try another way
                      </button>
                    </div>
                  </form>
                </>
              )}

              {step === 'approval' && (
                <div className="space-y-5 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-800">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Admin approval required</h2>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                      This device or location needs administrator approval. An administrator has
                      been alerted. After approval, you’ll still need to complete your authenticator
                      verification. Location is requested once for this sign-in only.
                    </p>
                  </div>
                  {error && <Alert tone="error">{error}</Alert>}
                  <div className="flex items-center justify-center gap-2 text-sm font-medium text-slate-600">
                    <Spinner className="h-4 w-4" />
                    Waiting for an administrator
                  </div>
                  <button
                    type="button"
                    onClick={backToCredentials}
                    className="text-sm font-semibold text-[#6a1b21] underline underline-offset-4"
                  >
                    Cancel sign-in
                  </button>
                </div>
              )}

              {step === 'enroll' && enrollment && (
                <>
                  <div className="text-center md:text-left mb-6">
                    <h2 className="text-xl font-bold tracking-tight text-slate-900">
                      Set Up Your Authenticator
                    </h2>
                    <p className="mt-2 text-sm text-slate-600 font-medium leading-relaxed">
                      Scan this code with Microsoft Authenticator or another TOTP app. Verify a code
                      to finish setup.
                    </p>
                  </div>

                  <div className="flex flex-col items-center gap-4 mb-6">
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <QRCodeSVG value={enrollment.otpauthUrl} size={192} level="M" includeMargin />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-semibold text-slate-600 mb-1">
                        Can’t scan? Enter this setup key manually
                      </p>
                      <code className="block max-w-full break-all rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-900">
                        {enrollment.secret}
                      </code>
                    </div>
                  </div>

                  <form onSubmit={handleEnrollmentVerify} className="space-y-5" noValidate>
                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-3 text-center md:text-left">
                        Enter the 6-digit authenticator code
                      </label>
                      <div className="flex justify-center md:justify-between gap-1 sm:gap-2">
                        {[0, 1, 2, 3, 4, 5].map((index) => (
                          <input
                            key={index}
                            id={`otp-input-${index}`}
                            type="text"
                            inputMode="numeric"
                            autoComplete={index === 0 ? 'one-time-code' : 'off'}
                            maxLength={1}
                            value={code[index] || ''}
                            onChange={(event) => handleCodeChange(index, event.target.value)}
                            onKeyDown={(event) => handleCodeKeyDown(index, event)}
                            aria-label={`Authenticator digit ${index + 1}`}
                            className={`w-10 sm:w-12 h-12 sm:h-14 text-center text-lg sm:text-xl font-bold rounded-xl border ${
                              fieldErrors.code
                                ? 'border-red-500 focus:ring-red-500'
                                : 'border-slate-300 focus:ring-slate-500'
                            } focus:outline-none focus:ring-2 bg-white text-slate-900 transition-colors`}
                            required
                          />
                        ))}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting || code.length !== 6}
                      className="w-full flex items-center justify-center gap-2 bg-[#6a1b21] hover:bg-[#521318] text-white font-semibold py-3.5 px-4 rounded-xl transition-colors duration-200 disabled:opacity-70"
                    >
                      {isSubmitting ? (
                        <Spinner className="w-5 h-5 border-white" />
                      ) : (
                        'ENABLE AUTHENTICATOR'
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={backToCredentials}
                      className="w-full text-sm font-semibold text-slate-600 hover:text-[#6a1b21]"
                    >
                      Cancel and sign in again
                    </button>
                  </form>
                </>
              )}

              {step === 'success' && (
                <div className="text-center py-6">
                  <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#6a1b21] text-white shadow-lg shadow-red-900/20">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={3}
                      stroke="currentColor"
                      className="w-10 h-10"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m4.5 12.75 6 6 9-13.5"
                      />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">
                    Welcome back
                  </h2>
                  <p className="text-sm text-slate-600 font-medium mb-10">
                    you have been logged in successfully
                  </p>

                  <button
                    type="button"
                    onClick={() => router.replace('/dashboard')}
                    className="w-full bg-[#6a1b21] hover:bg-[#521318] text-white font-semibold py-3.5 px-4 rounded-xl transition-colors duration-200 uppercase tracking-wide text-sm"
                  >
                    GO TO DASHBOARD
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main
          className="flex min-h-screen items-center justify-end bg-cover bg-center px-4 sm:px-12 lg:px-24 xl:px-32"
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
