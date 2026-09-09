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

  // A visit to the app's own home (not some deep link that expired or was
  // shared) reads as an anonymous visitor arriving at the front door, not
  // someone hitting a permission wall — a plain landing page with a Login
  // button fits that better than "Sign in required" + a raw path.
  if (!callbackUrl || callbackUrl === "/") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="POS logo" width={56} height={56} className="mb-2 rounded-xl" />
        <h1 className="text-3xl font-extrabold">POS</h1>
        <p className="text-muted-foreground max-w-md">
          Run every register, warehouse and storefront from one portal.
        </p>
        <Link href={loginHref} className={buttonVariants()}>
          Login
        </Link>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold">Sign in required</h1>
      <p className="text-muted-foreground max-w-md">
        You need to be signed in to view <span className="font-mono">{callbackUrl}</span>.
      </p>
      <Link href={loginHref} className={buttonVariants()}>
        Sign in
      </Link>
    </main>
  );
}
