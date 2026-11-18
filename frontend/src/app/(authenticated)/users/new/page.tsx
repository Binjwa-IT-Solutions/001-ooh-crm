'use client';

import Link from 'next/link';
import { ArrowLeft, Plus, Users } from 'lucide-react';

import { RequireAuth } from '@/shared/auth/require-auth';
import { UserForm } from '@/modules/users/components/user-form';

function NewUserContent() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto py-2">
      {/* Back button and page title */}
      <div className="flex items-center gap-4">
        <Link
          href="/users"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E6E8EC] bg-white text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
          title="Back to Users"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-[#6E1D1D]" />
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Create New User
            </h1>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Add a new user to the CRM system and assign their access role and permissions.
          </p>
        </div>
      </div>

      <UserForm mode="create" />
    </div>
  );
}

export default function NewUserPage() {
  return (
    <RequireAuth permission="users.create">
      <NewUserContent />
    </RequireAuth>
  );
}
