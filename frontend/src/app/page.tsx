import type { Metadata } from 'next';
import LandingPage from '@/components/landing/LandingPage';

export const metadata: Metadata = {
  title: 'capms — Team Collaboration & Project Management',
  description:
    'capms combines Kanban boards, team chat, calendars, notifications, and org analytics in one workspace for teams that ship.',
};

export default function Home() {
  return <LandingPage />;
}
