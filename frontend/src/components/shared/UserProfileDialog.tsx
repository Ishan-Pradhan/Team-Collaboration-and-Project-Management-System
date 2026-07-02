'use client';

import { Loader2, Mail, MessageSquare, X } from 'lucide-react';
import { useMemberProfile } from '@/hooks/useOrganization';
import { useAuthStore } from '@/store/auth.store';

interface Props {
  userId: string;
  organizationId: string;
  onMessage: (userId: string) => void;
  onClose: () => void;
}

export default function UserProfileDialog({ userId, organizationId, onMessage, onClose }: Props) {
  const { user: currentUser } = useAuthStore();
  const { data: profile, isLoading } = useMemberProfile(organizationId, userId);

  const isSelf = currentUser?.id === userId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-sm rounded-xl border border-border bg-white shadow-modal">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded p-1 text-text-secondary hover:bg-surface-muted transition-colors"
        >
          <X size={16} />
        </button>

        {isLoading || !profile ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-text-secondary" />
          </div>
        ) : (
          <div className="p-6">
            <div className="flex flex-col items-center text-center">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.name}
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary">
                  {profile.name.charAt(0).toUpperCase()}
                </div>
              )}
              <h2 className="mt-3 text-base font-semibold text-text-primary">{profile.name}</h2>
              {profile.jobTitle && (
                <p className="mt-0.5 text-sm text-text-secondary">{profile.jobTitle}</p>
              )}
              <span className="mt-2 inline-flex items-center rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-text-secondary">
                {profile.orgRole}
              </span>
            </div>

            {profile.bio && (
              <p className="mt-4 text-sm leading-relaxed text-text-primary">{profile.bio}</p>
            )}

            <div className="mt-4 flex items-center gap-1.5 text-xs text-text-secondary">
              <Mail size={12} />
              {profile.email}
            </div>

            {!isSelf && (
              <button
                onClick={() => onMessage(userId)}
                className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
              >
                <MessageSquare size={14} />
                Message
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
