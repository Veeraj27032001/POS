"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { AuthSplitLayout } from "@/components/auth-split-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const codeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Must be a 6-digit code."),
});
type CodeInput = z.infer<typeof codeSchema>;

export default function MfaVerifyPage() {
  return (
    <Suspense fallback={null}>
      <MfaVerifyForm />
    </Suspense>
  );
}

function MfaVerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ticket = searchParams.get("ticket");
  const method = searchParams.get("method") === "email_otp" ? "email_otp" : "totp";
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CodeInput>({ resolver: zodResolver(codeSchema) as never });

  async function onSubmit(values: CodeInput) {
    setFormError(null);
    if (!ticket) {
      setFormError("Your login attempt has expired. Please sign in again.");
      return;
    }

    const result = await signIn("credentials", {
      ticket,
      code: values.code,
      redirect: false,
    });
    if (result?.error) {
      setFormError("Incorrect or expired code. Please try again.");
      return;
    }

    router.push("/select-financial-year");
    router.refresh();
  }

  if (!ticket) {
    return (
      <AuthSplitLayout>
        <div className="space-y-4 text-center">
          <p>Your login attempt has expired.</p>
          <Button render={<a href="/login">Back to sign in</a>} />
        </div>
      </AuthSplitLayout>
    );
  }

  return (
    <AuthSplitLayout>
      <div className="bg-primary mb-7 size-9 rounded-lg" />
      <h1 className="mb-1.5 text-[26px] font-extrabold">
        {method === "email_otp" ? "Enter emailed code" : "Enter authenticator code"}
      </h1>
      <p className="text-muted-foreground mb-8 text-sm">
        {method === "email_otp"
          ? "We sent a 6-digit code to your email address."
          : "Enter the 6-digit code from your authenticator app."}
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="code">Verification code</Label>
          <Input id="code" inputMode="numeric" maxLength={6} {...register("code")} />
          {errors.code && <p className="text-sm text-red-600">{errors.code.message}</p>}
        </div>

        {formError && <p className="text-sm text-red-600">{formError}</p>}

        <Button type="submit" disabled={isSubmitting} className="mt-1 w-full">
          {isSubmitting ? "Verifying…" : "Verify"}
        </Button>
      </form>
    </AuthSplitLayout>
  );
}
