import type { Metadata } from 'next';
import ForgotPasswordPage from './_components/ForgotPasswordPage';

export const metadata: Metadata = { title: 'Reset password — Arbyte' };

export default function Page() {
  return <ForgotPasswordPage />;
}
