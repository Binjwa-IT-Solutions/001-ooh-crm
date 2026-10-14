'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';

import { RequireAuth } from '@/shared/auth/require-auth';
import {
  securityApi,
  type LoginSecurityEvent,
  type PendingLoginApproval,
} from '@/shared/auth/security-api';
import { useAuth } from '@/shared/auth/auth-context';
import { toErrorMessage } from '@/shared/api/errors';
import { Alert, Button, Card, Spinner } from '@/shared/ui';

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function formatLocation(location: LoginSecurityEvent['location']) {
  if (!location) return 'Unavailable';
  return `${location.latitude.toFixed(3)}, ${location.longitude.toFixed(3)} (±${Math.round(location.accuracyMeters)} m)`;
}

function ApprovalCard({
  approval,
  onDecided,
}: {
  approval: PendingLoginApproval;
  onDecided: () => void;
}) {
  const [totpCode, setTotpCode] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function decide(decision: 'approve' | 'deny') {
    setError(null);
    setBusy(true);
    try {
      await securityApi.decideLoginApproval(approval.id, { decision, totpCode, note });
      onDecided();
    } catch (cause) {
      setError(toErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void decide('approve');
  }

  return (
    <Card className="space-y-4 border-amber-300">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold text-slate-900">{approval.user?.name ?? 'Unknown user'}</h2>
          <p className="text-sm text-slate-600">{approval.user?.email ?? 'Account unavailable'}</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">
          <AlertTriangle className="h-3.5 w-3.5" /> High risk
        </span>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase text-slate-500">Reported location</dt>
          <dd className="mt-1 break-all font-mono text-slate-900">
            {formatLocation(approval.login?.location ?? null)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-slate-500">Requested</dt>
          <dd className="mt-1 text-slate-900">{formatDate(approval.requestedAt)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-slate-500">Device ID</dt>
          <dd className="mt-1 font-mono text-slate-900">
            {approval.login?.deviceTag ?? 'Not reported'}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium uppercase text-slate-500">Browser</dt>
          <dd className="mt-1 break-words text-slate-700">
            {approval.login?.userAgent || 'Unavailable'}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium uppercase text-slate-500">Signals</dt>
          <dd className="mt-1 text-slate-900">
            {approval.login?.riskReasons.join(', ').replaceAll('_', ' ') ||
              'Location or device requires review'}
            {approval.login?.distanceFromBaselineMeters !== null &&
              approval.login?.distanceFromBaselineMeters !== undefined &&
              `; ${Math.round(approval.login.distanceFromBaselineMeters)} m from saved location`}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-slate-500">Request expires</dt>
          <dd className="mt-1 text-slate-900">{formatDate(approval.expiresAt)}</dd>
        </div>
      </dl>

      <form
        onSubmit={handleSubmit}
        className="grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2"
      >
        {error && (
          <div className="sm:col-span-2">
            <Alert tone="error">{error}</Alert>
          </div>
        )}
        <label className="space-y-1.5 text-sm font-medium text-slate-700">
          Current authenticator code
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={totpCode}
            onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            className="h-10 w-full rounded-lg border border-slate-300 px-3"
            required
          />
        </label>
        <label className="space-y-1.5 text-sm font-medium text-slate-700 sm:col-span-2">
          Decision note
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            minLength={10}
            maxLength={500}
            rows={2}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            required
          />
        </label>
        <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
          <Button
            type="button"
            variant="secondary"
            disabled={busy || totpCode.length !== 6 || note.trim().length < 10}
            onClick={() => void decide('deny')}
          >
            <X className="h-4 w-4" /> Deny
          </Button>
          <Button
            type="submit"
            disabled={busy || totpCode.length !== 6 || note.trim().length < 10}
            className="bg-emerald-700 text-white hover:bg-emerald-800"
          >
            {busy ? (
              <Spinner label="Checking" />
            ) : (
              <>
                <Check className="h-4 w-4" /> Approve login
              </>
            )}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function ApprovalsPageContent() {
  const { user } = useAuth();
  const [approvals, setApprovals] = useState<PendingLoginApproval[]>([]);
  const [events, setEvents] = useState<LoginSecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    let cancelled = false;

    async function fetchApprovals() {
      try {
        const [result, eventResult] = await Promise.all([
          securityApi.listLoginApprovals(),
          securityApi.listLoginEvents(),
        ]);
        if (!cancelled) {
          setApprovals(result.approvals);
          setEvents(eventResult.events);
          setError(null);
        }
      } catch (cause) {
        if (!cancelled) setError(toErrorMessage(cause));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchApprovals();
    return () => {
      cancelled = true;
    };
  }, [reloadVersion, user?.role]);

  if (user?.role !== 'admin') {
    return (
      <Alert tone="error" title="Admin access required">
        You do not have permission to review login requests.
      </Alert>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 py-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Login approvals</h1>
          <p className="mt-1 text-sm text-slate-600">
            Sign-ins from an unapproved device or from outside the office.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setReloadVersion((value) => value + 1)}
          disabled={loading}
        >
          Refresh
        </Button>
      </div>
      <Alert tone="info">
        Approval is bound to one login and expires after five minutes. The user must still complete
        their own MFA.
      </Alert>
      {error && <Alert tone="error">{error}</Alert>}
      {loading ? (
        <Spinner label="Loading approvals" />
      ) : approvals.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-600">No pending login approvals.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {approvals.map((approval) => (
            <ApprovalCard
              key={approval.id}
              approval={approval}
              onDecided={() => setReloadVersion((value) => value + 1)}
            />
          ))}
        </div>
      )}

      <section className="space-y-3 pt-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Recent login activity</h2>
          <p className="mt-1 text-sm text-slate-600">Security records are retained for 180 days.</p>
        </div>
        <Card className="overflow-x-auto p-0">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Time</th>
                <th className="px-4 py-3 font-semibold">Account</th>
                <th className="px-4 py-3 font-semibold">Location</th>
                <th className="px-4 py-3 font-semibold">Risk / outcome</th>
                <th className="px-4 py-3 font-semibold">Signals</th>
                <th className="px-4 py-3 font-semibold">Device / browser</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {events.map((event) => (
                <tr key={event.id} className="align-top text-slate-700">
                  <td className="whitespace-nowrap px-4 py-3">{formatDate(event.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">
                      {event.user?.name ?? 'Unknown account'}
                    </div>
                    <div>{event.email}</div>
                  </td>
                  <td className="px-4 py-3 font-mono">
                    <div>{formatLocation(event.location)}</div>
                    {event.distanceFromBaselineMeters !== null && (
                      <div className="text-xs text-slate-500">
                        {Math.round(event.distanceFromBaselineMeters)} m from baseline
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        event.riskLevel === 'high'
                          ? 'font-semibold text-rose-700'
                          : 'text-slate-700'
                      }
                    >
                      {event.riskLevel}
                    </span>
                    <div className="capitalize">{event.outcome}</div>
                  </td>
                  <td className="px-4 py-3">
                    {event.riskReasons.join(', ').replaceAll('_', ' ') || 'No flags'}
                  </td>
                  <td className="max-w-64 px-4 py-3 break-words">
                    <div className="font-mono text-slate-900">{event.deviceTag ?? 'No device ID'}</div>
                    <div className="text-xs">{event.userAgent || 'Unavailable'}</div>
                  </td>
                </tr>
              ))}
              {!loading && events.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    No login events recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  );
}

export default function LoginApprovalsPage() {
  return (
    <RequireAuth>
      <ApprovalsPageContent />
    </RequireAuth>
  );
}
