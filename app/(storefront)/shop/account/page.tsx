"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface StorefrontCustomer {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
}

export default function StorefrontAccountPage() {
  const router = useRouter();
  const [customer, setCustomer] = useState<StorefrontCustomer | null | undefined>(undefined);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/storefront/me")
      .then((res) => res.json())
      .then((body: { customer: StorefrontCustomer | null }) => {
        setCustomer(body.customer);
        if (!body.customer) router.replace("/shop/login?next=/shop/account");
      });
  }, [router]);

  async function setPasswordSubmit() {
    setSaving(true);
    try {
      const res = await fetch("/api/storefront/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to set the password.");
        return;
      }
      toast.success("Password set — you can now sign in with phone + password.");
      setPassword("");
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await fetch("/api/storefront/auth/logout", { method: "POST" });
    router.push("/shop");
  }

  if (!customer) return <p className="text-muted-foreground">Loading…</p>;

  return (
    <div className="mx-auto max-w-sm space-y-6">
      <h1 className="text-xl font-bold">My account</h1>
      <div className="space-y-1 text-sm">
        <p>
          <span className="text-muted-foreground">Name: </span>
          {customer.name ?? "—"}
        </p>
        <p>
          <span className="text-muted-foreground">Phone: </span>
          {customer.phone}
        </p>
        <p>
          <span className="text-muted-foreground">Email: </span>
          {customer.email ?? "—"}
        </p>
      </div>

      <div className="space-y-1.5 border-t pt-4">
        <Label>Set a password (for phone + password sign-in)</Label>
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button disabled={saving || password.length < 6} onClick={() => void setPasswordSubmit()}>
          {saving ? "Saving…" : "Save password"}
        </Button>
      </div>

      <Button variant="outline" onClick={() => void logout()}>
        Sign out
      </Button>
    </div>
  );
}
