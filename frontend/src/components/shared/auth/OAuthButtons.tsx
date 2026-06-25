'use client';

import { FaGithub, FaGoogle } from 'react-icons/fa';
import { Button } from '@/components/ui/button';

interface OAuthButtonsProps {
  label?: string;
}

export default function OAuthButtons({ label = 'Continue with' }: OAuthButtonsProps) {
  const handleOAuth = (provider: 'google' | 'github') => {
    window.location.href = `http://localhost:8080/api/v1/auth/oauth/${provider}`;
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      <Button
        type="button"
        variant="outline"
        className="h-11 gap-2"
        onClick={() => handleOAuth('google')}
      >
        <FaGoogle size={16} />
        <span>{label === 'Continue with' ? 'Google' : 'Google'}</span>
      </Button>
      <Button
        type="button"
        variant="outline"
        className="h-11 gap-2"
        onClick={() => handleOAuth('github')}
      >
        <FaGithub size={16} />
        <span>GitHub</span>
      </Button>
    </div>
  );
}
