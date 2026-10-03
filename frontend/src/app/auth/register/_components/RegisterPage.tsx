'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

import AuthSideBar from '@/components/shared/auth/AuthSideBar';
import Logo from '@/components/shared/Logo';
import OAuthButtons from '@/components/shared/auth/OAuthButtons';
import { registerSchema, RegisterInput } from '@/schemas/auth.schema';
import { useRegister } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/auth.store';
import { parseApiError } from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, router]);

  const { mutate: registerUser, isPending } = useRegister();

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = (data: RegisterInput) => {
    setApiError(null);
    registerUser(data, {
      onSuccess: () => router.push(`/auth/verify-email?email=${encodeURIComponent(data.email)}`),
      onError: (err) => setApiError(parseApiError(err).message),
    });
  };

  return (
    <div className="min-h-screen flex bg-background w-full">
      <div className="flex-1 flex flex-col justify-center px-6 py-12 md:px-16 lg:px-24">
        <div className="animate-auth-rise-in mx-auto w-full max-w-md">
          <Logo className="mb-10" />

          <h1 className="text-h1 text-text-primary tracking-tight mb-2">Create an account</h1>
          <p className="text-body text-text-secondary mb-8">Get started with your collaborative workspace today.</p>

          {apiError && (
            <div className="mb-6 p-3.5 bg-danger-soft border border-danger/20 rounded-md text-sm text-danger">
              {apiError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name" className="text-text-primary">Full name</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                className={errors.name ? 'border-destructive focus-visible:ring-destructive/30' : ''}
                {...register('name')}
              />
              {errors.name && <span className="text-xs text-danger">{errors.name.message}</span>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" className="text-text-primary">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@company.com"
                className={errors.email ? 'border-destructive focus-visible:ring-destructive/30' : ''}
                {...register('email')}
              />
              {errors.email && <span className="text-xs text-danger">{errors.email.message}</span>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password" className="text-text-primary">Password</Label>
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <span className="text-xs text-danger">{errors.password.message}</span>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirmPassword" className="text-text-primary">Confirm password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  className={`pr-10 ${errors.confirmPassword ? 'border-destructive focus-visible:ring-destructive/30' : ''}`}
                  {...register('confirmPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.confirmPassword && <span className="text-xs text-danger">{errors.confirmPassword.message}</span>}
            </div>

            <Button type="submit" disabled={isPending} className="w-full h-11 mt-2">
              {isPending ? <><Loader2 className="animate-spin" size={16} />Creating account...</> : 'Create account'}
            </Button>
          </form>

          <div className="relative my-7">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border-subtle" /></div>
            <div className="relative flex justify-center">
              <span className="bg-background px-3 text-xs uppercase tracking-wider text-text-muted">Or sign up with</span>
            </div>
          </div>

          <OAuthButtons label="Sign up with" />

          <p className="mt-8 text-center text-sm text-text-secondary">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-brand hover:text-brand-hover font-medium transition-colors">Sign in</Link>
          </p>
        </div>
      </div>
      <AuthSideBar
        headline={<>Start shipping<br />with your team.</>}
        subtext="Boards, tasks, and chat — set up your workspace in minutes."
      />
    </div>
  );
}
