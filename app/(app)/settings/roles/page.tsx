"use client";

import { Loader2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { RequiredMark } from "@/components/required-mark";
import { DataTable } from "@/components/data-table/data-table";
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
import { focusCurrentNavLink } from "@/lib/keyboard/focusCurrentNavLink";
import { useArrowKeyNav } from "@/lib/keyboard/useArrowKeyNav";
import { useInvalidateResource } from "@/lib/pagination/useList";

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

  const kbdRef = useArrowKeyNav<HTMLFormElement>({ selector: "[data-kbd-item]" });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button data-kbd-item="">New Role</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Role</DialogTitle>
        </DialogHeader>
        <form
          ref={kbdRef}
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <DialogFormBody>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="role-name">
                Name
                <RequiredMark />
              </Label>
              <Input
                id="role-name"
                data-kbd-item=""
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </DialogFormBody>
          <DialogFormActions>
            <Button type="submit" data-kbd-item="" disabled={submitting}>
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
  const invalidate = useInvalidateResource();
  const kbdRef = useArrowKeyNav<HTMLDivElement>({
    selector: "[data-kbd-item]",
    onBoundaryLeft: focusCurrentNavLink,
  });

  return (
    <div ref={kbdRef} className="space-y-4 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Roles</h1>
          <p className="text-muted-foreground text-sm">
            Control what each role can see and do. Super Admin isn&apos;t listed here — it always
            has full access and can&apos;t be edited.
          </p>
        </div>
        <NewRoleDialog onCreated={() => invalidate("roles")} />
      </div>

      <DataTable<RoleRow>
        resource="roles"
        getRowId={(row) => row.id}
        searchable
        emptyMessage="No roles yet."
        rowHref={(row) => `/settings/roles/${row.id}`}
        columns={[{ key: "name", header: "Name", sortable: true }]}
      />
    </div>
  );
}
