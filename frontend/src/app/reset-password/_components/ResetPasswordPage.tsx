'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react';

import AuthSideBar from '@/components/shared/auth/AuthSideBar';
import Logo from '@/components/shared/Logo';
import { resetPasswordSchema, ResetPasswordInput } from '@/schemas/auth.schema';
import { useResetPassword } from '@/hooks/useAuth';
import { parseApiError } from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  const { mutate: resetPassword, isPending } = useResetPassword();

  const { register, handleSubmit, formState: { errors } } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const onSubmit = (data: ResetPasswordInput) => {
    if (!token) return;
    setApiError(null);
    resetPassword(
      { token, newPassword: data.newPassword },
      {
        onSuccess: () => setSucceeded(true),
        onError: (err) => setApiError(parseApiError(err).message),
      },
    );
  };

  if (!token) {
    return (
      <div className="mx-auto w-full max-w-md text-center">
        <Logo className="mb-10 justify-center" />
        <div className="w-14 h-14 mx-auto rounded-full bg-danger-soft flex items-center justify-center mb-6">
          <AlertCircle className="text-danger" size={28} />
        </div>
        <h1 className="text-h1 text-text-primary tracking-tight mb-3">Invalid reset link</h1>
        <p className="text-body text-text-secondary mb-8">
          This link is missing its reset token. Request a new one from the sign-in page.
        </p>
        <Link href="/auth/forgot-password">
          <Button className="w-full h-11">Request a new link</Button>
        </Link>
      </div>
    );
  }

  if (succeeded) {
    return (
      <div className="mx-auto w-full max-w-md text-center">
        <Logo className="mb-10 justify-center" />
        <div className="w-14 h-14 mx-auto rounded-full bg-success-soft flex items-center justify-center mb-6">
          <CheckCircle2 className="text-success" size={28} />
        </div>
        <h1 className="text-h1 text-text-primary tracking-tight mb-3">Password reset</h1>
        <p className="text-body text-text-secondary mb-8">
          Your password has been updated. Sign in with your new password.
        </p>
        <Button className="w-full h-11" onClick={() => router.push('/auth/login')}>
          Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <Logo className="mb-10" />

      <h1 className="text-h1 text-text-primary tracking-tight mb-2">Set a new password</h1>
      <p className="text-body text-text-secondary mb-8">
        Choose a new password for your account.
      </p>

      {apiError && (
        <div className="mb-6 p-3.5 bg-danger-soft border border-danger/20 rounded-md text-sm text-danger">
          {apiError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="newPassword">New password</Label>
          <div className="relative">
            <Input
              id="newPassword"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••••••"
              className={`pr-10 ${errors.newPassword ? 'border-destructive focus-visible:ring-destructive/30' : ''}`}
              {...register('newPassword')}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.newPassword && <span className="text-xs text-danger">{errors.newPassword.message}</span>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <Input
            id="confirmPassword"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••••••"
            className={errors.confirmPassword ? 'border-destructive focus-visible:ring-destructive/30' : ''}
            {...register('confirmPassword')}
          />
          {errors.confirmPassword && <span className="text-xs text-danger">{errors.confirmPassword.message}</span>}
        </div>

        <Button type="submit" disabled={isPending} className="w-full h-11 mt-2">
          {isPending ? <><Loader2 className="animate-spin" size={16} />Resetting password...</> : 'Reset password'}
        </Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex bg-background w-full">
      <div className="flex-1 flex flex-col justify-center px-6 py-12 md:px-16 lg:px-24">
        <Suspense fallback={
          <div className="mx-auto w-full max-w-md flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-muted-foreground" size={24} />
          </div>
        }>
          <ResetPasswordContent />
        </Suspense>
      </div>
      <AuthSideBar
        headline={<>Pick up right<br />where you left off.</>}
        subtext="Your boards, tasks, and team are exactly as you left them."
      />
    </div>
  );
}
