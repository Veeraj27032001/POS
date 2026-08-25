import Link from "next/link";

export default async function ForbiddenPage({
  searchParams,
}: {
  searchParams: Promise<{ path?: string }>;
}) {
  const { path } = await searchParams;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold">Access denied</h1>
      <p className="text-muted-foreground max-w-md">
        Your account doesn&apos;t have permission to access{" "}
        {path ? <span className="font-mono">{path}</span> : "this page"}. If you believe this is a
        mistake, contact your store administrator.
      </p>
      <Link href="/" className="underline">
        Back to dashboard
      </Link>
    </main>
  );
}
