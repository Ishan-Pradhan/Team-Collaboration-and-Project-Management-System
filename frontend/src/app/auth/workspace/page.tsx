import type { Metadata } from 'next';
import WorkspacePage from './_components/WorkspacePage';

export const metadata: Metadata = { title: 'Choose workspace — Arbyte' };

export default function Page() {
  return <WorkspacePage />;
}
