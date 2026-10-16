'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  useEffect(() => {
    if (id) {
      router.replace(`/campaigns?id=${encodeURIComponent(id)}`);
    } else {
      router.replace('/campaigns');
    }
  }, [id, router]);

  return (
    <div className="flex h-64 items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8B2424]" />
    </div>
  );
}
