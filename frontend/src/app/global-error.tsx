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
      <body className="global-error-body flex h-screen flex-col items-center justify-center gap-4 p-6 text-center font-sans">
        {/* This tree replaces the whole root layout on a catastrophic crash, so it
            can't rely on next-themes' `.dark` class — fall back to the OS setting. */}
        <style>{`
          .global-error-body { background: #f8f7f4; }
          .global-error-body .ge-icon-bg { background: #fde3e3; }
          .global-error-body .ge-icon { color: #c23b3b; }
          .global-error-body h1 { color: #161616; }
          .global-error-body p { color: #5d5d5d; }
          .global-error-body button { background: #22302a; color: #fff; }
          .global-error-body button:hover { background: #18211d; }
          @media (prefers-color-scheme: dark) {
            .global-error-body { background: #121314; }
            .global-error-body .ge-icon-bg { background: #3a2323; }
            .global-error-body .ge-icon { color: #e28f8f; }
            .global-error-body h1 { color: #ededec; }
            .global-error-body p { color: #b0b0b0; }
            .global-error-body button { background: #3a4d43; color: #edeae4; }
            .global-error-body button:hover { background: #46594e; }
          }
        `}</style>
        <div className="ge-icon-bg flex h-16 w-16 items-center justify-center rounded-full">
          <AlertTriangle className="ge-icon" size={30} />
        </div>
        <h1 className="text-xl font-semibold">Application error</h1>
        <p className="max-w-sm text-sm">
          A critical error occurred. Please refresh the page.
        </p>
        <button
          onClick={reset}
          className="mt-2 rounded-md px-4 py-2 text-sm font-medium transition-colors"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
