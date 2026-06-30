'use client';

import { useState, useRef } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { useUpdateProfile, useUploadAvatar, useChangePassword } from '@/hooks/useAuth';
import { parseApiError } from '@/lib/axios';
import { toast } from 'sonner';
import { Camera, CheckCircle2, Loader2, Lock, Mail, Shield, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const AVATAR_COLORS = ['#22302a', '#d4a84f', '#6f8c78', '#a86c58', '#4b7f52', '#c38a2d'];
function getAvatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export default function ProfilePage() {
  const { user } = useAuthStore();
  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();
  const changePassword = useChangePassword();

  const [name, setName] = useState(user?.name ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  const isOAuth = user.authProvider !== 'local';
  const avatarColor = getAvatarColor(user.name);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadAvatar.mutate(file, {
      onSuccess: () => toast.success('Avatar updated'),
      onError: (err) => toast.error(parseApiError(err).message),
    });
    e.target.value = '';
  };

  const handleNameSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || name.trim() === user.name) return;
    updateProfile.mutate({ name: name.trim() }, {
      onSuccess: () => toast.success('Name updated'),
      onError: (err) => toast.error(parseApiError(err).message),
    });
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    changePassword.mutate({ currentPassword, newPassword }, {
      onSuccess: () => {
        toast.success('Password changed successfully');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      },
      onError: (err) => toast.error(parseApiError(err).message),
    });
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-text-primary">Profile</h1>
        <p className="text-xs text-text-secondary mt-0.5">Manage your account information and security.</p>
      </div>

      {/* Avatar + name */}
      <div className="rounded-xl border border-border-subtle bg-white p-6 shadow-card space-y-6">
        {/* Avatar */}
        <div className="flex items-center gap-5">
          <div className="relative">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="h-20 w-20 rounded-full object-cover"
              />
            ) : (
              <div
                className="h-20 w-20 rounded-full flex items-center justify-center text-white text-2xl font-bold"
                style={{ backgroundColor: avatarColor }}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadAvatar.isPending}
              className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-gray-800 text-white hover:bg-gray-700 transition-colors disabled:opacity-50"
              title="Change avatar"
            >
              {uploadAvatar.isPending
                ? <Loader2 size={13} className="animate-spin" />
                : <Camera size={13} />}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
          <div>
            <p className="font-semibold text-text-primary">{user.name}</p>
            <p className="text-sm text-text-secondary">{user.email}</p>
            <div className="flex items-center gap-2 mt-1.5">
              {user.isVerified ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success">
                  <CheckCircle2 size={11} /> Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-text-muted">
                  Unverified
                </span>
              )}
              <span className="text-text-muted">·</span>
              <span className={cn(
                'inline-flex items-center gap-1 text-[11px] font-medium',
                isOAuth ? 'text-text-secondary' : 'text-text-muted'
              )}>
                {user.authProvider === 'google' && <Mail size={11} />}
                {user.authProvider === 'local' && <User size={11} />}
                {user.authProvider === 'google' ? 'Google' : user.authProvider === 'github' ? 'GitHub' : 'Email'} account
              </span>
            </div>
          </div>
        </div>

        {/* Name */}
        <form onSubmit={handleNameSave} className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary">Display Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              maxLength={100}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary">Email</label>
            <Input value={user.email} disabled className="opacity-60" />
            <p className="text-[11px] text-text-muted">Email address cannot be changed.</p>
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={updateProfile.isPending || !name.trim() || name.trim() === user.name}
            >
              {updateProfile.isPending ? <><Loader2 size={14} className="mr-1.5 animate-spin" />Saving...</> : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>

      {/* Change password — local accounts only */}
      {!isOAuth && (
        <div className="rounded-xl border border-border-subtle bg-white p-6 shadow-card space-y-4">
          <div className="flex items-center gap-2">
            <Lock size={15} className="text-text-secondary" />
            <h2 className="text-sm font-semibold text-text-primary">Change Password</h2>
          </div>
          <form onSubmit={handleChangePassword} className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary">Current Password</label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary">New Password</label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary">Confirm New Password</label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={changePassword.isPending || !currentPassword || !newPassword || !confirmPassword}
              >
                {changePassword.isPending
                  ? <><Loader2 size={14} className="mr-1.5 animate-spin" />Updating...</>
                  : 'Update Password'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Account info */}
      <div className="rounded-xl border border-border-subtle bg-white p-6 shadow-card">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={15} className="text-text-secondary" />
          <h2 className="text-sm font-semibold text-text-primary">Account Info</h2>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-text-secondary">Member since</span>
            <span className="font-medium text-text-primary">
              {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">Account type</span>
            <span className="font-medium text-text-primary capitalize">{user.role === 'SUPER_ADMIN' ? 'Super Admin' : 'User'}</span>
          </div>
          {isOAuth && (
            <div className="flex justify-between">
              <span className="text-text-secondary">Signed in with</span>
              <span className="font-medium text-text-primary capitalize">{user.authProvider}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
