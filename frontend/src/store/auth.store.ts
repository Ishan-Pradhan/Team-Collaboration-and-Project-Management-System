import { create } from 'zustand';
import { User } from '../types/auth.types';
import { useOrgStore } from './org.store';

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

export const useAuthStore = create<AuthState>((set, get) => ({
  user: getSafeUser(),
  // Auth is cookie-based — the access token lives in an HttpOnly cookie.
  // We derive authentication state from whether a user object is persisted locally.
  isAuthenticated: typeof window !== 'undefined' ? !!getSafeUser() : false,

  setAuth: (user) => {
    // A different account logging in in the same browser (e.g. switching
    // OAuth accounts without logging out first) must not inherit whichever
    // org the previous account had selected.
    const previousUserId = get().user?.id;
    if (previousUserId && previousUserId !== user.id) {
      useOrgStore.getState().clearCurrentOrg();
    }
    localStorage.setItem('user', JSON.stringify(user));
    set({ user, isAuthenticated: true });
  },

  clearAuth: () => {
    localStorage.removeItem('user');
    set({ user: null, isAuthenticated: false });
    useOrgStore.getState().clearCurrentOrg();
  },
}));
