import type { Metadata } from 'next';
import VerifyEmailPage from './_components/VerifyEmailPage';

export const metadata: Metadata = { title: 'Verify email — Arbyte' };

export default function Page() {
  return <VerifyEmailPage />;
}
