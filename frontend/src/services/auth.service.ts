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

export async function resetPassword(data: { token: string; newPassword: string }): Promise<void> {
  await api.post('/auth/reset-password', data);
}

export async function resendVerificationEmail(email: string): Promise<void> {
  await api.post('/auth/resend-verification-email', { email });
}

export interface UpdateProfileData {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
  jobTitle: string | null;
}

export async function updateProfile(data: { name: string; bio?: string; jobTitle?: string }): Promise<UpdateProfileData> {
  const res = await api.patch<{ data: UpdateProfileData }>('/auth/profile', data);
  return res.data.data;
}

export async function getCurrentUserProfile(): Promise<UpdateProfileData & { isVerified: boolean; role: 'USER' | 'SUPER_ADMIN' }> {
  const res = await api.get<{ data: UpdateProfileData & { isVerified: boolean; role: 'USER' | 'SUPER_ADMIN' } }>('/auth/current-user');
  return res.data.data;
}

export async function uploadAvatar(file: File): Promise<{ id: string; name: string; email: string; avatarUrl: string | null }> {
  const form = new FormData();
  form.append('file', file);
  const res = await api.patch<{ data: { id: string; name: string; email: string; avatarUrl: string | null } }>('/auth/profile/avatar', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data;
}

export async function changePassword(data: { currentPassword: string; newPassword: string }): Promise<void> {
  await api.post('/auth/change-password', data);
}
