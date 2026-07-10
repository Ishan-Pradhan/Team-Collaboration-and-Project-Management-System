import type { Metadata } from 'next';
import ResetPasswordPage from './_components/ResetPasswordPage';

export const metadata: Metadata = { title: 'Reset password — Arbyte' };

export default function Page() {
  return <ResetPasswordPage />;
}
