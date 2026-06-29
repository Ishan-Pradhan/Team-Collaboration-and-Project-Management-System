'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, MailCheck, RefreshCw } from 'lucide-react';
import Link from 'next/link';

import AuthSideBar from '@/components/shared/auth/AuthSideBar';
import Logo from '@/components/shared/Logo';
import { Button } from '@/components/ui/button';
import { useResendVerificationEmail } from '@/hooks/useAuth';
import { parseApiError } from '@/lib/axios';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') ?? '';

  const [resendError, setResendError] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState(false);

  const { mutate: resend, isPending: isResending } = useResendVerificationEmail();

  const handleResend = () => {
    if (!email) return;
    setResendError(null);
    setResendSuccess(false);
    resend(email, {
      onSuccess: () => setResendSuccess(true),
      onError: (err) => setResendError(parseApiError(err).message),
    });
  };

  return (
    <div className="mx-auto w-full max-w-md">
      <Logo className="mb-12" withLink={false} />

      <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-6">
        <MailCheck className="text-primary" size={28} />
      </div>

      <h1 className="text-h1 text-foreground tracking-tight mb-3">Check your email</h1>

      <p className="text-body text-muted-foreground mb-1">We sent a verification link to</p>
      {email && <p className="text-body font-semibold text-foreground mb-6">{email}</p>}

      <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
        Click the link in the email to verify your account. Once verified, you&apos;ll be able to sign in and set up your workspace.
        The link expires in <span className="font-medium text-foreground">24 hours</span>.
      </p>

      {resendSuccess && (
        <div className="mb-5 p-3.5 rounded-md text-sm bg-primary/10 border border-primary/20 text-primary">
          Verification email resent. Check your inbox.
        </div>
      )}
      {resendError && (
        <div className="mb-5 p-3.5 rounded-md text-sm bg-destructive/10 border border-destructive/20 text-destructive">
          {resendError}
        </div>
      )}

      <div className="space-y-3">
        <Link href="/auth/login">
          <Button variant="default" className="w-full h-11">Back to sign in</Button>
        </Link>
        <Button variant="outline" className="w-full h-11 gap-2" onClick={handleResend} disabled={isResending || !email}>
          {isResending ? <><Loader2 className="animate-spin" size={15} />Resending...</> : <><RefreshCw size={15} />Resend email</>}
        </Button>
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Wrong email?{' '}
        <Link href="/auth/register" className="font-medium text-foreground hover:underline">Go back to register</Link>
      </p>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex bg-background w-full">
      <div className="flex-1 flex flex-col justify-center px-6 py-12 md:px-16 lg:px-24">
        <Suspense fallback={
          <div className="mx-auto w-full max-w-md flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-muted-foreground" size={24} />
          </div>
        }>
          <VerifyEmailContent />
        </Suspense>
      </div>
      <AuthSideBar />
    </div>
  );
}
