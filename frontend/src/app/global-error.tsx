'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex h-screen flex-col items-center justify-center gap-4 bg-[#f8f7f4] p-6 text-center font-sans">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <AlertTriangle className="text-red-600" size={30} />
        </div>
        <h1 className="text-xl font-semibold text-[#161616]">Application error</h1>
        <p className="max-w-sm text-sm text-[#5d5d5d]">
          A critical error occurred. Please refresh the page.
        </p>
        <button
          onClick={reset}
          className="mt-2 rounded-md bg-[#22302a] px-4 py-2 text-sm font-medium text-white hover:bg-[#18211d] transition-colors"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
