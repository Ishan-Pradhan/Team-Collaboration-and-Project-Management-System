import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/axios';
import { useAuthStore } from '../store/auth.store';
import { AuthResponse, User } from '../types/auth.types';
import { LoginInput, RegisterInput } from '../schemas/auth.schema';

export const useLogin = () => {
  const setAuth = useAuthStore((state) => state.setAuth);

  return useMutation({
    mutationFn: async (credentials: LoginInput) => {
      const response = await api.post<AuthResponse>('/auth/login', {
        email: credentials.email,
        password: credentials.password,
      });
      return response.data;
    },
    onSuccess: (data) => {
      if (data.data) {
        // Backend returns flat user fields in data (id, name, email, avatarUrl).
        // The access token is set as an HttpOnly cookie — not in the response body.
        const user: User = {
          id: data.data.id,
          name: data.data.name,
          email: data.data.email,
          avatarUrl: data.data.avatarUrl,
          role: 'USER',
          isVerified: true,
          isActive: true,
          authProvider: 'local',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setAuth(user);
      }
    },
  });
};


export const useRegister = () => {
  return useMutation({
    mutationFn: async (userData: RegisterInput) => {
      const response = await api.post<AuthResponse>('/auth/register', {
        name: userData.name,
        email: userData.email,
        password: userData.password,
      });
      return response.data;
    },
  });
};

export const useForgotPassword = () => {
  return useMutation({
    mutationFn: async (email: string) => {
      const response = await api.post('/auth/forgot-password', { email });
      return response.data;
    },
  });
};

export const useLogout = () => {
  const clearAuth = useAuthStore((state) => state.clearAuth);

  return useMutation({
    mutationFn: async () => {
      await api.post('/auth/logout');
    },
    onSuccess: () => {
      clearAuth();
    },
  });
};
