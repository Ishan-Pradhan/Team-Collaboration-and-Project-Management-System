import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { ApiError } from '../types/auth.types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// ─── Token Refresh Interceptor ───────────────────────────────────────────────
// When a request fails with 401, attempt to refresh the access token using the
// refresh token cookie. If refresh succeeds, replay the original request.
// If refresh fails (refresh token expired/invalid), clear auth and redirect to login.

type FailedRequest = {
  resolve: () => void;
  reject: (error: unknown) => void;
};

let isRefreshing = false;
let failedQueue: FailedRequest[] = [];

const processQueue = (error: unknown = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve();
    }
  });
  failedQueue = [];
};

const logoutAndRedirect = () => {
  // Import store dynamically to avoid circular deps and SSR issues
  import('../store/auth.store').then(({ useAuthStore }) => {
    useAuthStore.getState().clearAuth();
  });
  if (typeof window !== 'undefined') {
    window.location.href = '/auth/login';
  }
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status !== 401 || !originalRequest) {
      return Promise.reject(error);
    }

    // If the refresh endpoint itself returned 401, we must logout — don't retry
    if (originalRequest.url?.includes('/auth/refresh-access-token')) {
      processQueue(error);
      logoutAndRedirect();
      return Promise.reject(error);
    }

    // If a refresh is already in flight, queue this request to replay after it finishes
    if (isRefreshing) {
      return new Promise<void>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then(() => api(originalRequest))
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      await api.post('/auth/refresh-access-token');
      processQueue();
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError);
      logoutAndRedirect();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

// ─── Error Parser ─────────────────────────────────────────────────────────────
export const parseApiError = (error: unknown): ApiError => {
  if (error instanceof AxiosError) {
    const data = error.response?.data;
    return {
      message: data?.message || error.message || 'An unexpected error occurred',
      errors: data?.errors || [],
    };
  }
  return {
    message: error instanceof Error ? error.message : 'An unknown error occurred',
  };
};
