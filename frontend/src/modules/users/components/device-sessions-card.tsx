'use client';

import { useEffect, useState } from 'react';
import { LogOut, ShieldCheck, Trash2 } from 'lucide-react';

import { toErrorMessage } from '@/shared/api/errors';
import { Alert, Button, Card, Modal, Spinner } from '@/shared/ui';

import { usersApi } from '../api';
import type { UserDeviceAndSessions } from '../types';

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Rough "Chrome on Windows" summary; the full user-agent stays in the tooltip. */
function describeBrowser(userAgent: string): string {
  if (!userAgent) return 'Unknown browser';
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /Chrome\//.test(userAgent)
      ? 'Chrome'
      : /Firefox\//.test(userAgent)
        ? 'Firefox'
        : /Safari\//.test(userAgent)
          ? 'Safari'
          : 'Browser';
  const os = /Windows/.test(userAgent)
    ? 'Windows'
    : /Android/.test(userAgent)
      ? 'Android'
      : /iPhone|iPad/.test(userAgent)
        ? 'iOS'
        : /Mac OS X/.test(userAgent)
          ? 'macOS'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : 'unknown OS';
  return `${browser} on ${os}`;
}

type PendingAction = 'sessions' | 'device' | null;

export function DeviceSessionsCard({ userId, userName }: { userId: string; userName: string }) {
  const [data, setData] = useState<UserDeviceAndSessions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    usersApi
      .getDeviceAndSessions(userId)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch((cause) => {
        if (!cancelled) setError(toErrorMessage(cause));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, reloadVersion]);

  async function confirmAction() {
    if (!pendingAction) return;
    setIsWorking(true);
    setError(null);
    try {
      if (pendingAction === 'sessions') {
        const result = await usersApi.revokeSessions(userId);
        setFeedback(`Signed out of ${result.revokedSessions} session(s). ${userName} must sign in again.`);
      } else {
        await usersApi.removeDevice(userId);
        setFeedback(
          `Device removed and all sessions ended. ${userName}'s next sign-in needs admin approval.`,
        );
      }
      setPendingAction(null);
      setReloadVersion((value) => value + 1);
    } catch (cause) {
      setError(toErrorMessage(cause));
    } finally {
      setIsWorking(false);
    }
  }

  const device = data?.device ?? null;
  const sessions = data?.sessions ?? [];

  return (
    <Card className="space-y-5 border border-[#E6E8EC] p-6 sm:p-8">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-[#6E1D1D]" />
        <div>
          <h2 className="text-base font-semibold text-slate-900">Device &amp; sessions</h2>
          <p className="text-xs text-slate-500">
            Each user has one approved device. Visible to admins only.
          </p>
        </div>
      </div>

      {feedback && <Alert tone="success">{feedback}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      {isLoading ? (
        <Spinner label="Loading device details…" />
      ) : (
        <>
          <div className="space-y-3 rounded-lg border border-slate-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Approved device
              </span>
              {device && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setPendingAction('device')}
                  className="h-8 px-2.5 text-xs text-rose-700 hover:bg-rose-50"
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Remove device
                </Button>
              )}
            </div>
            {device ? (
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-slate-500">Device ID</dt>
                  <dd className="font-mono font-semibold text-slate-900">
                    {device.deviceTag ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Browser</dt>
                  <dd className="text-slate-900" title={device.userAgent}>
                    {describeBrowser(device.userAgent)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Approved since</dt>
                  <dd className="text-slate-900">{formatDateTime(device.firstSeenAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Last sign-in</dt>
                  <dd className="text-slate-900">{formatDateTime(device.lastSeenAt)}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs text-slate-500">Saved location</dt>
                  <dd className="font-mono text-slate-900">
                    {device.location
                      ? `${device.location.latitude.toFixed(3)}, ${device.location.longitude.toFixed(3)} (±${Math.round(device.location.accuracyMeters)} m)`
                      : 'Not recorded (no accurate location reported yet)'}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-slate-600">
                No approved device. The next sign-in will need admin approval.
              </p>
            )}
          </div>

          <div className="space-y-3 rounded-lg border border-slate-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Active sessions ({sessions.length})
              </span>
              {sessions.length > 0 && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setPendingAction('sessions')}
                  className="h-8 px-2.5 text-xs text-amber-700 hover:bg-amber-50"
                >
                  <LogOut className="mr-1.5 h-3.5 w-3.5" />
                  Sign out everywhere
                </Button>
              )}
            </div>
            {sessions.length > 0 ? (
              <ul className="divide-y divide-slate-100 text-sm">
                {sessions.map((session) => (
                  <li key={session.id} className="flex flex-wrap justify-between gap-2 py-2">
                    <span className="text-slate-900" title={session.userAgent}>
                      {describeBrowser(session.userAgent)}
                    </span>
                    <span className="text-xs text-slate-500">
                      Signed in {formatDateTime(session.startedAt)} · expires{' '}
                      {formatDateTime(session.expiresAt)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-600">Not signed in anywhere.</p>
            )}
            {data?.sessionsRevokedAt && (
              <p className="text-xs text-slate-500">
                Last forced sign-out: {formatDateTime(data.sessionsRevokedAt)}
              </p>
            )}
          </div>
        </>
      )}

      <Modal
        open={pendingAction !== null}
        onClose={() => !isWorking && setPendingAction(null)}
        title={pendingAction === 'device' ? 'Remove approved device' : 'Sign out everywhere'}
      >
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-slate-600">
            {pendingAction === 'device' ? (
              <>
                This removes <strong className="text-slate-900">{userName}</strong>&apos;s approved
                device and signs them out immediately. Their next sign-in, from any device, will
                need admin approval.
              </>
            ) : (
              <>
                This signs <strong className="text-slate-900">{userName}</strong> out of every
                session immediately. Their device stays approved, so they can sign in again
                normally.
              </>
            )}
          </p>
          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPendingAction(null)}
              disabled={isWorking}
            >
              Cancel
            </Button>
            <Button
              type="button"
              isLoading={isWorking}
              onClick={() => void confirmAction()}
              className="bg-rose-700 text-white hover:bg-rose-800"
            >
              {pendingAction === 'device' ? 'Remove device' : 'Sign out everywhere'}
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
