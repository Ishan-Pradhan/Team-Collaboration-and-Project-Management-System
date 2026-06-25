import axios, { AxiosError } from 'axios';
import { ApiError } from '../types/auth.types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // to send cookies (like refresh tokens)
});


// Auth is cookie-based: withCredentials:true ensures cookies (accessToken, refreshToken)
// are automatically sent with every request. No manual token injection needed.


// Better error parser utility
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
