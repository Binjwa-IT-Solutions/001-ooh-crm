/**
 * Emergency login approval script for administrators.
 * Run this when an admin is locked out because no other admin is online to approve them.
 *
 * Usage:
 *   npm run approve-login
 *   npm run approve-login -- [email]
 */
import { config } from '../config/index.js';
import { AuthUser } from '../core/auth/auth-model.js';
import { OtpChallenge } from '../core/auth/otp-model.js';
import { LoginApproval, LoginSecurityEvent } from '../core/auth/security-models.js';
import { connectDatabase, disconnectDatabase } from '../core/db/connect.js';

async function main() {
  const targetEmail = process.argv[2]?.trim().toLowerCase();

  console.log('[approve-login] Connecting to database...');
  await connectDatabase();

  try {
    const query: Record<string, unknown> = {
      status: 'pending',
      expiresAt: { $gt: new Date() },
    };

    if (targetEmail) {
      const user = await AuthUser.findOne({ email: targetEmail });
      if (!user) {
        console.error(`[approve-login] No user found with email: ${targetEmail}`);
        process.exit(1);
      }
      query.userId = user._id;
    }

    const pendingApprovals = await LoginApproval.find(query).sort({ createdAt: -1 });

    if (pendingApprovals.length === 0) {
      console.log(
        targetEmail
          ? `[approve-login] No active pending login approval found for ${targetEmail}.`
          : '[approve-login] No active pending login approvals found.',
      );
      console.log('If your login screen expired, please try signing in again, then run this command immediately.');
      return;
    }

    for (const approval of pendingApprovals) {
      const user = await AuthUser.findById(approval.userId);
      const challenge = await OtpChallenge.findById(approval.challengeId);

      if (!user || !challenge) {
        console.log(`[approve-login] Skipping approval ${approval._id}: user or challenge missing.`);
        continue;
      }

      console.log(`[approve-login] Approving login for: ${user.name} (${user.email})`);

      challenge.method = user.totpEnabledAt ? 'totp' : 'email';
      challenge.expiresAt = new Date(Date.now() + config.otp.ttlMinutes * 60 * 1000);
      await challenge.save();

      approval.status = 'approved';
      approval.decidedAt = new Date();
      approval.decisionNote = 'Emergency approved via backend CLI';
      await approval.save();

      await LoginSecurityEvent.updateOne(
        { _id: approval.eventId },
        { $set: { outcome: 'approved' } },
      );

      console.log(`[approve-login] Successfully approved! Return to your browser to complete verification.`);
    }
  } finally {
    await disconnectDatabase();
  }
}

main().catch((err) => {
  console.error('[approve-login] Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});

