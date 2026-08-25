"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
          <h1 className="text-2xl font-semibold">Application error</h1>
          <p className="max-w-md text-gray-500">
            A critical error occurred{error.digest ? ` (ref: ${error.digest})` : ""}. Please reload
            the page.
          </p>
          <button onClick={reset} className="rounded-md border px-4 py-2 hover:bg-black/5">
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
