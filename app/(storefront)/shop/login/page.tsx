"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "otp" | "password";

export default function StorefrontLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>("otp");

  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function goBack() {
    router.push(searchParams.get("next") ?? "/shop");
  }

  async function sendCode() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/storefront/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, email, name: name || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to send the code.");
        return;
      }
      toast.success("Code sent — check your email.");
      setCodeSent(true);
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyCode() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/storefront/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Invalid code.");
        return;
      }
      toast.success("Signed in.");
      goBack();
    } finally {
      setSubmitting(false);
    }
  }

  async function loginWithPassword() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/storefront/auth/login-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to sign in.");
        return;
      }
      toast.success("Signed in.");
      goBack();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm space-y-5">
      <h1 className="text-xl font-bold">Sign in</h1>

      <div className="flex gap-2">
        <Button
          type="button"
          variant={mode === "otp" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("otp")}
        >
          Phone + code
        </Button>
        <Button
          type="button"
          variant={mode === "password" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("password")}
        >
          Phone + password
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label>Phone number</Label>
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9999999999" />
      </div>

      {mode === "otp" && !codeSent && (
        <>
          <div className="space-y-1.5">
            <Label>Email (for your sign-in code)</Label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Name (first time only)</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
          </div>
          <Button className="w-full" disabled={submitting} onClick={() => void sendCode()}>
            {submitting ? "Sending…" : "Send code"}
          </Button>
        </>
      )}

      {mode === "otp" && codeSent && (
        <>
          <div className="space-y-1.5">
            <Label>6-digit code</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} />
          </div>
          <Button className="w-full" disabled={submitting} onClick={() => void verifyCode()}>
            {submitting ? "Verifying…" : "Verify & sign in"}
          </Button>
          <button
            type="button"
            className="text-muted-foreground block w-full text-center text-sm hover:underline"
            onClick={() => setCodeSent(false)}
          >
            Use a different phone/email
          </button>
        </>
      )}

      {mode === "password" && (
        <>
          <div className="space-y-1.5">
            <Label>Password</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button className="w-full" disabled={submitting} onClick={() => void loginWithPassword()}>
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
          <p className="text-muted-foreground text-center text-sm">
            No password set yet? Sign in with a code, then set one from your account page.
          </p>
        </>
      )}
    </div>
  );
}
