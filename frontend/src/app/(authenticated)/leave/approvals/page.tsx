'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LeaveApprovalsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/leave?tab=approvals');
  }, [router]);

  return null;
}
