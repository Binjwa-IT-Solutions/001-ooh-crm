'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ApplyLeaveRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/leave?apply=true');
  }, [router]);

  return null;
}
