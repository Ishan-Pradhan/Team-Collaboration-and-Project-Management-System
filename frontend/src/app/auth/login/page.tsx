'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

import AuthSideBar from '@/components/shared/auth/AuthSideBar';
import Logo from '@/components/shared/Logo';
import OAuthButtons from '@/components/shared/auth/OAuthButtons';
import { loginSchema, LoginInput } from '@/schemas/auth.schema';
import { useLogin } from '@/hooks/useAuth';
import { parseApiError } from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const { mutate: login, isPending } = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = (data: LoginInput) => {
    setApiError(null);
    login(data, {
      onSuccess: () => {
        router.push('/auth/workspace');
      },
      onError: (err) => {
        const error = parseApiError(err);
        setApiError(error.message);
      },
    });
  };

  return (
    <div className="min-h-screen flex bg-background w-full">
      {/* Left Form Section */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 md:px-16 lg:px-24">
        <div className="mx-auto w-full max-w-md">

          {/* Logo */}
          <Logo className="mb-10" />

          <h1 className="text-h1 text-text-primary tracking-tight mb-2">Welcome back</h1>
          <p className="text-body text-text-secondary mb-8">
            Sign in to continue to your workspace.
          </p>

          {/* API Error */}
          {apiError && (
            <div className="mb-6 p-3.5 bg-danger-soft border border-danger/20 rounded-md text-caption text-danger text-sm">
              {apiError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@company.com"
                className={errors.email ? 'border-destructive focus-visible:ring-destructive/30' : ''}
                {...register('email')}
              />
              {errors.email && (
                <span className="text-xs text-destructive">{errors.email.message}</span>
              )}
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/auth/forgot-password"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  className={`pr-10 ${errors.password ? 'border-destructive focus-visible:ring-destructive/30' : ''}`}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <span className="text-xs text-destructive">{errors.password.message}</span>
              )}
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={isPending}
              className="w-full h-11 mt-2"
            >
              {isPending ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-7">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-3 text-xs uppercase tracking-wider text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

          {/* OAuth */}
          <OAuthButtons />

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link
              href="/auth/register"
              className="text-[var(--color-brand)] hover:text-[var(--color-brand-hover)] font-medium transition-colors"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>

      {/* Right Visual Panel */}
      <AuthSideBar />
    </div>
  );
}