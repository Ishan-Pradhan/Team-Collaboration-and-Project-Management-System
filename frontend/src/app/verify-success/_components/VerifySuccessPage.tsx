'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

// The backend has already verified the token and set the auth cookies
// before redirecting here — this page just confirms it and hands off to
// the root page, which reads the live session and routes into the app.
export default function VerifySuccessPage() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => router.replace('/'), 1800);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 shadow-card space-y-4">
        <div className="w-14 h-14 mx-auto rounded-full bg-success-soft flex items-center justify-center">
          <CheckCircle2 className="text-success" size={28} />
        </div>
        <h1 className="text-lg font-semibold text-text-primary">Email verified</h1>
        <p className="text-sm text-text-secondary">
          Your account is confirmed. Taking you to your workspace…
        </p>
        <Button className="w-full mt-2" onClick={() => router.replace('/')}>
          Continue
        </Button>
      </div>
    </div>
  );
}
