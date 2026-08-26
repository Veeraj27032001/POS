"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";

import { AuthSplitLayout } from "@/components/auth-split-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PasswordLoginInput } from "@/lib/auth/schemas";
import { passwordLoginSchema } from "@/lib/auth/schemas";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PasswordLoginInput>({ resolver: zodResolver(passwordLoginSchema) as never });

  async function onSubmit(values: PasswordLoginInput) {
    setFormError(null);

    const res = await fetch("/api/auth/login-step1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!res.ok) {
      setFormError("Invalid email or password.");
      return;
    }

    const { mfaRequired, method, ticket } = (await res.json()) as {
      mfaRequired: boolean;
      method?: "totp" | "email_otp";
      ticket: string;
    };

    if (mfaRequired) {
      router.push(
        `/mfa-verify?ticket=${encodeURIComponent(ticket)}&method=${encodeURIComponent(method ?? "totp")}`,
      );
      return;
    }

    const result = await signIn("credentials", { ticket, redirect: false });
    if (result?.error) {
      setFormError("Sign in failed. Please try again.");
      return;
    }

    const callbackUrl = searchParams.get("callbackUrl");
    router.push(
      `/select-financial-year${callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`,
    );
    router.refresh();
  }

  return (
    <AuthSplitLayout>
      <Image src="/logo.png" alt="POS logo" width={36} height={36} className="mb-7 rounded-lg" />
      <h1 className="mb-1.5 text-[26px] font-extrabold">Welcome back</h1>
      <p className="text-muted-foreground mb-8 text-sm">Sign in to your POS account</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="username" {...register("email")} />
          {errors.email && <p className="text-sm text-red-600">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            {...register("password")}
          />
          {errors.password && <p className="text-sm text-red-600">{errors.password.message}</p>}
        </div>

        {formError && <p className="text-sm text-red-600">{formError}</p>}

        <Button type="submit" disabled={isSubmitting} className="mt-1 w-full">
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthSplitLayout>
  );
}
