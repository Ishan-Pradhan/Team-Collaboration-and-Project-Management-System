import { api } from '@/lib/axios';
import type { AuthResponse } from '@/types/auth.types';
import type { LoginInput, RegisterInput } from '@/schemas/auth.schema';

export async function loginUser(credentials: LoginInput): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>('/auth/login', credentials);
  return res.data;
}

export async function registerUser(data: RegisterInput): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>('/auth/register', {
    name: data.name,
    email: data.email,
    password: data.password,
  });
  return res.data;
}

export async function logoutUser(): Promise<void> {
  await api.post('/auth/logout');
}

export async function forgotPassword(email: string): Promise<void> {
  await api.post('/auth/forgot-password', { email });
}

export async function resendVerificationEmail(email: string): Promise<void> {
  await api.post('/auth/resend-verification-email', { email });
}
