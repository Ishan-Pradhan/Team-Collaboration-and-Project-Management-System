'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useAcceptInvite } from '@/hooks/useOrganization';
import { useAuthStore } from '@/store/auth.store';
import { useOrgStore } from '@/store/org.store';
import { parseApiError } from '@/lib/axios';
import { toast } from 'sonner';
import { Loader2, MailCheck, LogIn, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

function AcceptInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const { isAuthenticated } = useAuthStore();
  const { setCurrentOrg } = useOrgStore();
  const acceptInviteMutation = useAcceptInvite();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!token) {
      setErrorMsg('No invitation token found. Please check your invitation link.');
      return;
    }

    if (isAuthenticated) {
      acceptInviteMutation.mutate(token, {
        onSuccess: () => {
          toast.success('Successfully joined the organization!');
          router.push('/dashboard');
        },
        onError: (err: unknown) => {
          setErrorMsg(parseApiError(err).message);
        },
      });
    }
  }, [token, isAuthenticated, router, setCurrentOrg]);

  // Defer auth-dependent rendering until client has hydrated from localStorage.
  // Without this, the server (isAuthenticated=false) and client (isAuthenticated=true)
  // render different branches, causing a hydration mismatch.
  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md rounded-xl border border-border bg-white p-6 shadow-card">
          <AlertCircle className="mx-auto text-danger" size={40} />
          <h1 className="mt-4 text-lg font-semibold text-text-primary">Invalid Invitation</h1>
          <p className="mt-2 text-sm text-text-secondary">{errorMsg}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md rounded-xl border border-border bg-white p-6 shadow-card space-y-4">
          <MailCheck className="mx-auto text-brand" size={40} />
          <h1 className="text-lg font-semibold text-text-primary">You are invited!</h1>
          <p className="text-sm text-text-secondary">
            Please log in or register an account using the email address the invite was sent to in order to join the workspace.
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <Link href={`/auth/login?redirect=/accept-invite?token=${token}`}>
              <Button className="w-full flex items-center justify-center gap-2">
                <LogIn size={16} /><span>Log In to Accept</span>
              </Button>
            </Link>
            <Link href={`/auth/register?token=${token}`}>
              <Button variant="outline" className="w-full">Register New Account</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center bg-background">
      <div className="max-w-md rounded-xl border border-border bg-white p-8 shadow-card space-y-4">
        {errorMsg ? (
          <>
            <AlertCircle className="mx-auto text-danger" size={40} />
            <h1 className="text-lg font-semibold text-text-primary">Failed to Join</h1>
            <p className="text-sm text-text-secondary">{errorMsg}</p>
            <Link href="/dashboard">
              <Button className="w-full mt-2">Go to Dashboard</Button>
            </Link>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto animate-spin text-brand" size={40} />
            <h1 className="text-lg font-semibold text-text-primary">Joining Workspace</h1>
            <p className="text-sm text-text-secondary">
              Accepting your invitation and setting up your workspace access. Please wait...
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    }>
      <AcceptInviteContent />
    </Suspense>
  );
}
