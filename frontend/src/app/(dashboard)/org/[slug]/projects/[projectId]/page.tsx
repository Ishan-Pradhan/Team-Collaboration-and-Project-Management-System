import { Suspense } from 'react';
import KanbanPage from './_components/KanbanPage';
import { KanbanSkeleton } from '@/components/shared/skeletons/KanbanSkeleton';

interface Props {
  params: Promise<{ slug: string; projectId: string }>;
}

export default function Page({ params }: Props) {
  return (
    <Suspense fallback={<KanbanSkeleton />}>
      <KanbanPage params={params} />
    </Suspense>
  );
}
