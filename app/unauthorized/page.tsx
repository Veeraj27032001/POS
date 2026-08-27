import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default async function UnauthorizedPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const loginHref = callbackUrl
    ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
    : "/login";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold">Sign in required</h1>
      <p className="text-muted-foreground max-w-md">
        You need to be signed in to view{" "}
        {callbackUrl ? <span className="font-mono">{callbackUrl}</span> : "this page"}.
      </p>
      <Link href={loginHref} className={buttonVariants()}>
        Sign in
      </Link>
    </main>
  );
}
