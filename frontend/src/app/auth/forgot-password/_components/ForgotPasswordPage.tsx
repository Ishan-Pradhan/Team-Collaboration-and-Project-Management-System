'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Loader2, MailCheck } from 'lucide-react';

import AuthSideBar from '@/components/shared/auth/AuthSideBar';
import Logo from '@/components/shared/Logo';
import { forgotPasswordSchema, ForgotPasswordInput } from '@/schemas/auth.schema';
import { useForgotPassword } from '@/hooks/useAuth';
import { parseApiError } from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ForgotPasswordPage() {
  const [apiError, setApiError] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const { mutate: forgotPassword, isPending } = useForgotPassword();

  const { register, handleSubmit, formState: { errors } } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = (data: ForgotPasswordInput) => {
    setApiError(null);
    forgotPassword(data.email, {
      onSuccess: () => setSubmittedEmail(data.email),
      onError: (err) => setApiError(parseApiError(err).message),
    });
  };

  if (submittedEmail) {
    return (
      <div className="min-h-screen flex bg-background w-full">
        <div className="flex-1 flex flex-col justify-center px-6 py-12 md:px-16 lg:px-24">
          <div className="mx-auto w-full max-w-md text-center">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-full bg-[var(--color-success-soft)] flex items-center justify-center">
                <MailCheck className="text-[var(--color-success)]" size={32} />
              </div>
            </div>
            <h1 className="text-h1 text-text-primary tracking-tight mb-3">Check your email</h1>
            <p className="text-body text-text-secondary mb-2">We sent a password reset link to</p>
            <p className="text-body font-semibold text-text-primary mb-8">{submittedEmail}</p>
            <p className="text-sm text-text-secondary mb-8 leading-relaxed">
              Click the link in the email to reset your password. The link expires in 1 hour.
            </p>
            <div className="space-y-3">
              <Link href="/auth/login">
                <Button variant="outline" className="w-full h-11">
                  <ArrowLeft size={16} />Back to sign in
                </Button>
              </Link>
              <p className="text-xs text-muted-foreground">
                Didn&apos;t receive the email?{' '}
                <button type="button" className="text-[var(--color-primary)] hover:underline font-medium" onClick={() => setSubmittedEmail(null)}>
                  Try a different email
                </button>
              </p>
            </div>
          </div>
        </div>
        <AuthSideBar />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background w-full">
      <div className="flex-1 flex flex-col justify-center px-6 py-12 md:px-16 lg:px-24">
        <div className="mx-auto w-full max-w-md">
          <Logo className="mb-10" />

          <Link href="/auth/login" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8">
            <ArrowLeft size={14} />Back to sign in
          </Link>

          <h1 className="text-h1 text-text-primary tracking-tight mb-2">Reset your password</h1>
          <p className="text-body text-text-secondary mb-8">
            Enter your email and we&apos;ll send you a link to reset your password.
          </p>

          {apiError && (
            <div className="mb-6 p-3.5 bg-danger-soft border border-danger/20 rounded-md text-sm text-danger">
              {apiError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@company.com"
                className={errors.email ? 'border-destructive focus-visible:ring-destructive/30' : ''}
                {...register('email')}
              />
              {errors.email && <span className="text-xs text-destructive">{errors.email.message}</span>}
            </div>

            <Button type="submit" disabled={isPending} className="w-full h-11 mt-2">
              {isPending ? <><Loader2 className="animate-spin" size={16} />Sending reset link...</> : 'Send reset link'}
            </Button>
          </form>
        </div>
      </div>
      <AuthSideBar />
    </div>
  );
}
