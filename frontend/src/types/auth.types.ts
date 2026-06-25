export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: 'USER' | 'SUPER_ADMIN';
  isVerified: boolean;
  isActive: boolean;
  authProvider: 'local' | 'google' | 'github';
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  // Backend sends the user fields directly in data (no nested .user or .accessToken)
  // The access token is set as a cookie automatically
  data: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  } | null;
  errors?: string[];
}

export interface ApiError {
  message: string;
  errors?: string[];
}
