'use client';

import { FaGithub, FaGoogle } from 'react-icons/fa';
import { Button } from '@/components/ui/button';

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1').replace(/\/$/, '');

interface OAuthButtonsProps {
  label?: string;
}

export default function OAuthButtons({ label = 'Continue with' }: OAuthButtonsProps) {
  const handleOAuth = (provider: 'google' | 'github') => {
    window.location.href = `${API_URL}/auth/oauth/${provider}`;
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      <Button type="button" variant="outline" className="h-11 gap-2" onClick={() => handleOAuth('google')}>
        <FaGoogle size={16} />
        <span>{label} Google</span>
      </Button>
      <Button type="button" variant="outline" className="h-11 gap-2" onClick={() => handleOAuth('github')}>
        <FaGithub size={16} />
        <span>{label} GitHub</span>
      </Button>
    </div>
  );
}
