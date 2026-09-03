"use client";

import { SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { AppNavItem } from "@/components/app-nav";

function useSearchResults(items: AppNavItem[], query: string) {
  return useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    return items.filter((item) => item.label.toLowerCase().includes(q)).slice(0, 8);
  }, [items, query]);
}

function ResultsList({
  results,
  onSelect,
}: {
  results: AppNavItem[];
  onSelect: (href: string) => void;
}) {
  return (
    <ul>
      {results.map((item) => (
        <li key={item.href}>
          <button
            type="button"
            onClick={() => onSelect(item.href)}
            className="hover:bg-accent flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm"
          >
            {item.icon}
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function HeaderSearch({ items }: { items: AppNavItem[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const results = useSearchResults(items, query);

  function goTo(href: string) {
    setOpen(false);
    setMobileOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <>
      <div className="hidden md:block">
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
          <PopoverContent align="start" className="w-(--anchor-width) p-1.5" initialFocus={false}>
            <ResultsList results={results} onSelect={goTo} />
          </PopoverContent>
        </Popover>
      </div>

      <div className="md:hidden">
        <Popover
          open={mobileOpen}
          onOpenChange={(next) => {
            setMobileOpen(next);
            if (!next) setQuery("");
          }}
        >
          <PopoverTrigger
            render={
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Search">
                <SearchIcon className="size-4" />
              </Button>
            }
          />
          <PopoverContent align="start" className="w-[min(90vw,22rem)] p-2" initialFocus={false}>
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products, customers, settings…"
              className="w-full"
            />
            {results.length > 0 && (
              <div className="mt-2 max-h-72 overflow-y-auto">
                <ResultsList results={results} onSelect={goTo} />
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </>
  );
}
