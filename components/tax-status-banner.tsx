"use client";

import { XIcon } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { asAppSession } from "@/lib/auth/types";

const DISMISS_KEY = "pos:tax-status-banner-dismissed";

export function TaxStatusBanner() {
  const { data } = useSession();
  const session = asAppSession(data ?? null);
  const isSuperAdmin = session?.user?.roleName === "Super Admin";

  const [configured, setConfigured] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!session?.user) return;
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      // sessionStorage unavailable — just don't remember the dismissal.
    }
    fetch("/api/stores/tax-status")
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { configured: boolean } | null) => setConfigured(body?.configured ?? true));
  }, [session?.user]);

  function dismiss() {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Best-effort only.
    }
  }

  if (!session?.user || configured !== false || dismissed) return null;

  return (
    <div className="bg-warning/15 text-warning flex items-center justify-between gap-3 border-b px-6 py-2 text-sm">
      <span>
        Tax rules aren&apos;t configured for your store yet.
        {isSuperAdmin && (
          <>
            {" "}
            <Link href="/settings/tax-engine" className="font-medium underline">
              Configure now
            </Link>
          </>
        )}
      </span>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="hover:bg-warning/20 shrink-0 rounded-full p-1"
      >
        <XIcon className="size-3.5" />
      </button>
    </div>
  );
}
