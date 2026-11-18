'use client';

import { AppShell } from '@/shared/layout/app-shell';
import { RequireAuth } from '@/shared/auth/require-auth';
import { ProfileCompletionGuard } from '@/modules/employees/components/profile-completion-guard';

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireAuth>
      <ProfileCompletionGuard>
        <AppShell>{children}</AppShell>
      </ProfileCompletionGuard>
    </RequireAuth>
  );
}
