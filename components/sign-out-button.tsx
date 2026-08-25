"use client";

import { signOut, useSession } from "next-auth/react";

import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const { data: session } = useSession();

  if (!session?.user) return null;

  return (
    <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
      Sign out
    </Button>
  );
}
