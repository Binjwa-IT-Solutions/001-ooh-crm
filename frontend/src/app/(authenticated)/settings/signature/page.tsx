'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Moved: signature settings now live on Company settings. */
export default function DocumentSignatureRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/settings/company#signature');
  }, [router]);
  return null;
}
