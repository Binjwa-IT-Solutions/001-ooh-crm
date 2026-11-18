'use client';

import { useRouter } from 'next/navigation';
import { Users } from 'lucide-react';
import { RequireAuth } from '@/shared/auth/require-auth';
import { TeamManagementView } from '@/modules/employees/components/team-management-view';

export default function TeamManagementPage() {
  const router = useRouter();

  return (
    <RequireAuth permission="employees.view">
      <div className="space-y-6 max-w-7xl mx-auto py-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F8E6E6] text-[#6E1D1D]">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Team Management
            </h1>
            <p className="text-xs text-slate-500">
              Manager-wise reporting hierarchy and team assignment
            </p>
          </div>
        </div>

        <TeamManagementView onNavigateToUserCreation={() => router.push('/employees?tab=user-creation')} />
      </div>
    </RequireAuth>
  );
}
