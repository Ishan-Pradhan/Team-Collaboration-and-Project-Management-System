import type { Metadata } from 'next';
import LoginPage from './_components/LoginPage';

export const metadata: Metadata = { title: 'Sign in — Arbyte' };

export default function Page() {
  return <LoginPage />;
}
