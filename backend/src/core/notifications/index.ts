import { Types } from 'mongoose';

import { AuthUser } from '../auth/auth-model.js';
import { ForbiddenError } from '../errors/index.js';
import { Notification, type INotification } from './notification-model.js';
import { resolveTransport } from './transports.js';
import type { EmailMessage } from './types.js';

export * from './types.js';
export { consoleTransport, emailTransport, resolveTransport } from './transports.js';
export { Notification, type INotification } from './notification-model.js';

/**
 * NOTIFICATIONS.
 *
 * One entry point for every module: `notify()`. It writes the in-app record and
 * optionally sends an email, so a module never has to know which channels are
 * configured or which are switched on.
 *
 *   await notify({
 *     userId: lead.claimedBy,
 *     type: 'leads.assigned',
 *     title: 'New lead assigned',
 *     body: `${lead.companyName} is now yours.`,
 *     link: `/leads/${lead.id}`,
 *     email: true,
 *   });
 *
 * Notifications are best-effort. A failure is logged, never thrown — a lead
 * must not fail to save because an email provider was briefly down.
 */

/** The single way anything in this codebase sends an email. */
export async function sendEmail(message: EmailMessage): Promise<{ transport: string }> {
  const transport = resolveTransport();
  await transport.send(message);
  return { transport: transport.name };
}

export async function sendOtpEmail(params: {
  to: string;
  name: string;
  code: string;
  ttlMinutes: number;
}): Promise<{ transport: string }> {
  const { to, name, code, ttlMinutes } = params;

  return sendEmail({
    to,
    subject: `${code} is your Media Octus CRM verification code`,
    text: [
      `Hi ${name},`,
      '',
      `Your verification code is: ${code}`,
      '',
      `It expires in ${ttlMinutes} minutes. If you did not try to sign in, ignore this email.`,
      '',
      '— Media Octus CRM',
    ].join('\n'),
  });
}

export interface NotifyInput {
  userId: string | Types.ObjectId;
  type: string;
  title: string;
  body?: string;
  link?: string;
  /** Also send it by email. Off by default — do not spam people. */
  email?: boolean;
}

/** Notifies one user in-app, and by email when asked. */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    await Notification.create({
      userId: new Types.ObjectId(String(input.userId)),
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link,
    });
  } catch (err) {
    console.error('[notify] failed to write in-app notification', err);
  }

  if (!input.email) return;

  try {
    const user = await AuthUser.findById(input.userId).select('email name');
    if (!user) return;

    await sendEmail({
      to: user.email,
      subject: input.title,
      text: [`Hi ${user.name},`, '', input.body ?? input.title, '', '— Media Octus CRM'].join('\n'),
    });
  } catch (err) {
    console.error('[notify] failed to send email', err);
  }
}

/** Notifies several people at once — "every eligible agent", say. */
export async function notifyMany(
  userIds: Array<string | Types.ObjectId>,
  input: Omit<NotifyInput, 'userId'>,
): Promise<void> {
  await Promise.all(userIds.map((userId) => notify({ ...input, userId })));
}

export const notificationService = {
  async listForUser(
    userId: string,
    options: { unreadOnly?: boolean; limit?: number } = {},
  ): Promise<{ notifications: INotification[]; unreadCount: number }> {
    const filter: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
    if (options.unreadOnly) filter.readAt = null;

    const [notifications, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .limit(Math.min(options.limit ?? 25, 100))
        .lean<INotification[]>(),
      Notification.countDocuments({ userId: new Types.ObjectId(userId), readAt: null }),
    ]);

    return { notifications, unreadCount };
  },

  /** Scoped to the owner by construction — you cannot mark someone else's as read. */
  async markRead(userId: string, notificationId: string): Promise<void> {
    await Notification.updateOne(
      { _id: notificationId, userId: new Types.ObjectId(userId), readAt: null },
      { $set: { readAt: new Date() } },
    );
  },

  async markAllRead(userId: string): Promise<number> {
    const result = await Notification.updateMany(
      { userId: new Types.ObjectId(userId), readAt: null },
      { $set: { readAt: new Date() } },
    );
    return result.modifiedCount;
  },

  /** Scoped to the owner by construction — you cannot delete someone else's notification. */
  async deleteForUser(userId: string, notificationId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(notificationId) || !Types.ObjectId.isValid(userId)) {
      return false;
    }

    const notification = await Notification.findById(notificationId);
    if (!notification) {
      return false;
    }

    if (notification.userId.toString() !== userId.toString()) {
      throw new ForbiddenError('You do not have permission to delete this notification');
    }

    await Notification.deleteOne({ _id: notification._id });
    return true;
  },
};
