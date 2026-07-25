import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SignupForm } from './SignupForm';

export const metadata: Metadata = { title: 'Sign Up' };

export default function SignupPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <Suspense>
        <SignupForm />
      </Suspense>
    </div>
  );
}
