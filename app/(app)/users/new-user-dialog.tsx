"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { SearchableSelect } from "@/components/searchable-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFormActions,
  DialogFormBody,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSubmitGuard } from "@/lib/forms/useSubmitGuard";
import { userCreateSchema } from "@/lib/masters/schemas";
import { useOptionsList } from "@/lib/masters/useOptionsList";
import { useInvalidateResource } from "@/lib/pagination/useList";

const formSchema = userCreateSchema
  .extend({ confirmPassword: z.string().min(1, "Confirm the password") })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
type UserCreateInput = z.infer<typeof formSchema>;

export function NewUserDialog() {
  const [open, setOpen] = useState(false);
  const invalidate = useInvalidateResource();
  const roles = useOptionsList("roles", "name");
  const stores = useOptionsList("stores/options", "name");

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UserCreateInput>({ resolver: zodResolver(formSchema) as never });

  async function onSubmit(values: UserCreateInput) {
    const { confirmPassword: _confirmPassword, ...payload } = values;
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast.error(body?.error?.message ?? "Failed to save.");
      return;
    }
    setOpen(false);
    reset();
    invalidate("users");
    toast.success("User created.");
  }

  const guardedSubmit = useSubmitGuard(onSubmit);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>New User</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New User</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(guardedSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <DialogFormBody>
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" {...register("name")} />
              {errors.name && <p className="text-sm text-red-600">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register("email")} />
              {errors.email && <p className="text-sm text-red-600">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Temporary password</Label>
              <Input id="password" type="password" {...register("password")} />
              {errors.password && <p className="text-sm text-red-600">{errors.password.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input id="confirmPassword" type="password" {...register("confirmPassword")} />
              {errors.confirmPassword && (
                <p className="text-sm text-red-600">{errors.confirmPassword.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Role</Label>
              <Controller
                name="roleId"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    options={roles}
                    value={field.value ?? null}
                    onChange={(v) => field.onChange(v ?? "")}
                    placeholder="Select role…"
                  />
                )}
              />
              {errors.roleId && <p className="text-sm text-red-600">{errors.roleId.message}</p>}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label>
                Store (required for Manager/Cashier; leave blank for cross-store access)
              </Label>
              <Controller
                name="storeId"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    options={stores}
                    value={field.value ?? null}
                    onChange={field.onChange}
                    placeholder="Select store…"
                  />
                )}
              />
            </div>
          </DialogFormBody>

          <DialogFormActions>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save"}
            </Button>
          </DialogFormActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}
