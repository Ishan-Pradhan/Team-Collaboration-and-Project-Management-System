import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth.store';
import type { User } from '../types/auth.types';
import type { LoginInput, RegisterInput } from '../schemas/auth.schema';
import {
  loginUser,
  registerUser,
  logoutUser,
  forgotPassword,
  resendVerificationEmail,
} from '../services/auth.service';

export const useLogin = () => {
  const setAuth = useAuthStore((s) => s.setAuth);
  return useMutation({
    mutationFn: loginUser,
    onSuccess: (data) => {
      if (data.data) {
        // Backend returns partial user on login; tokens are in HttpOnly cookies.
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

export const useRegister = () =>
  useMutation({
    mutationFn: (data: RegisterInput) => registerUser(data),
  });

export const useForgotPassword = () =>
  useMutation({ mutationFn: forgotPassword });

export const useResendVerificationEmail = () =>
  useMutation({ mutationFn: resendVerificationEmail });

export const useLogout = () => {
  const clearAuth = useAuthStore((s) => s.clearAuth);
  return useMutation({
    mutationFn: logoutUser,
    onSuccess: () => { clearAuth(); },
  });
};
