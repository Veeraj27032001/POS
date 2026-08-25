"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { AppNavItem } from "@/components/app-nav";

export function HeaderSearch({ items }: { items: AppNavItem[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    return items.filter((item) => item.label.toLowerCase().includes(q)).slice(0, 8);
  }, [items, query]);

  function goTo(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <Popover open={open && results.length > 0} onOpenChange={setOpen}>
      <PopoverTrigger
        nativeButton={false}
        render={
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search products, customers, settings…"
            className="w-full max-w-md"
          />
        }
      />
      <PopoverContent align="start" className="w-(--anchor-width) p-1.5">
        <ul>
          {results.map((item) => (
            <li key={item.href}>
              <button
                type="button"
                onClick={() => goTo(item.href)}
                className="hover:bg-accent flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm"
              >
                {item.icon}
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
