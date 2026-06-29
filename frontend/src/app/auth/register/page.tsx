import type { Metadata } from 'next';
import RegisterPage from './_components/RegisterPage';

export const metadata: Metadata = { title: 'Create account — Arbyte' };

export default function Page() {
  return <RegisterPage />;
}
