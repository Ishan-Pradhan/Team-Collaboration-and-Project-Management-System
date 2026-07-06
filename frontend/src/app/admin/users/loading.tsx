import { AdminListSkeleton } from '@/components/shared/skeletons/AdminListSkeleton';

export default function AdminUsersLoading() {
  return <AdminListSkeleton rows={8} withToolbar />;
}
