import type { Metadata } from 'next';
import VerifySuccessPage from './_components/VerifySuccessPage';

export const metadata: Metadata = { title: 'Email verified — Arbyte' };

export default function Page() {
  return <VerifySuccessPage />;
}
