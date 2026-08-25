"use client";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-muted-foreground max-w-md">
        An unexpected server error occurred{error.digest ? ` (ref: ${error.digest})` : ""}. Try
        again, or contact support if this keeps happening.
      </p>
      <button
        onClick={reset}
        className="rounded-md border px-4 py-2 hover:bg-black/5 dark:hover:bg-white/10"
      >
        Try again
      </button>
    </main>
  );
}
