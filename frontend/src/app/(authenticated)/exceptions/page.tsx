'use client';

import { RequireAuth } from '@/shared/auth/require-auth';
import { ExceptionsDashboard } from '@/modules/exceptions/components/ExceptionsDashboard';

export default function ExceptionsPage() {
  return (
    <RequireAuth permission="audit.view">
      <ExceptionsDashboard />
    </RequireAuth>
  );
}
