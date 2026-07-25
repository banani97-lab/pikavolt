import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Sign In' };

export default function LoginPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
