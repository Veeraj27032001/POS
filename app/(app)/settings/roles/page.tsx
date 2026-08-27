"use client";

import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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

interface RoleRow {
  id: string;
  name: string;
}

function NewRoleDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to create role.");
        return;
      }
      setOpen(false);
      setName("");
      onCreated();
      toast.success("Role created.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>New Role</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Role</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <DialogFormBody>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="role-name">Name</Label>
              <Input
                id="role-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </DialogFormBody>
          <DialogFormActions>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2Icon className="size-3.5 animate-spin" />}
              Save
            </Button>
          </DialogFormActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function RolesPage() {
  const [roles, setRoles] = useState<RoleRow[] | null>(null);

  function refresh() {
    fetch("/api/roles")
      .then((res) => res.json())
      .then((json: { data: RoleRow[] }) => setRoles(json.data));
  }

  useEffect(refresh, []);

  return (
    <div className="space-y-4 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Roles</h1>
          <p className="text-muted-foreground text-sm">
            Control what each role can see and do. Super Admin isn&apos;t listed here — it always
            has full access and can&apos;t be edited.
          </p>
        </div>
        <NewRoleDialog onCreated={refresh} />
      </div>

      {!roles ? (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2Icon className="size-4 animate-spin" />
          Loading…
        </div>
      ) : (
        <div className="divide-y rounded-lg border">
          {roles.map((role) => (
            <Link
              key={role.id}
              href={`/settings/roles/${role.id}`}
              className="hover:bg-accent/50 flex items-center justify-between px-4 py-3 text-sm"
            >
              {role.name}
            </Link>
          ))}
          {roles.length === 0 && (
            <div className="text-muted-foreground px-4 py-6 text-center text-sm">No roles yet.</div>
          )}
        </div>
      )}
    </div>
  );
}
