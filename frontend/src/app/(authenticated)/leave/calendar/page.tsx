'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HolidayCalendarRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/leave?tab=calendar');
  }, [router]);

  return null;
}
