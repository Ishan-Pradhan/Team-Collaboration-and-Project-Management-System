import { create } from 'zustand';
import { User } from '../types/auth.types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (user: User) => void;
  clearAuth: () => void;
}

const getSafeUser = (): User | null => {
  if (typeof window === 'undefined') return null;
  const userStr = localStorage.getItem('user');
  if (!userStr || userStr === 'undefined') return null;
  try {
    return JSON.parse(userStr);
  } catch (error) {
    console.error('Failed to parse user from localStorage', error);
    return null;
  }
};

export const useAuthStore = create<AuthState>((set) => ({
  user: getSafeUser(),
  // Auth is cookie-based — the access token lives in an HttpOnly cookie.
  // We derive authentication state from whether a user object is persisted locally.
  isAuthenticated: typeof window !== 'undefined' ? !!getSafeUser() : false,

  setAuth: (user) => {
    localStorage.setItem('user', JSON.stringify(user));
    set({ user, isAuthenticated: true });
  },

  clearAuth: () => {
    localStorage.removeItem('user');
    set({ user: null, isAuthenticated: false });
  },
}));
