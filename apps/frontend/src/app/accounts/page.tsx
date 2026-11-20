'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AccountsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/payments');
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 text-center">
      <div className="w-8 h-8 border-4 border-brand-fabric border-t-transparent rounded-full animate-spin" />
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
        Redirecting to Payments...
      </p>
    </div>
  );
}
