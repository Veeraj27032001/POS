"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useEffect, useState } from "react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { cn } from "@/lib/utils";

export interface SearchableSelectOption {
  value: string;
  label: string;
  /** Extra text the option can be found by without being shown — e.g. a
   * customer's phone number alongside their name. */
  keywords?: string[];
}

export interface SearchableSelectProps {
  /** The full option list, held client-side — fine for masters up to a few
   * hundred rows. For anything larger, use `onSearch` instead so the list
   * is never fetched or rendered all at once. */
  options?: SearchableSelectOption[];
  /** Server-search mode: called (debounced) with the current search text,
   * including an empty string on first open, and expected to return an
   * already-capped page of matches. Use for masters too large to hold or
   * render as a flat list (e.g. tens of thousands of rows). */
  onSearch?: (query: string) => Promise<SearchableSelectOption[]>;
  /** Required alongside onSearch whenever `value` isn't null — the search
   * page is capped, so an already-selected value's label can't always be
   * found in it; this resolves that one value directly instead. */
  resolveLabel?: (value: string) => Promise<string | null>;
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  "data-kbd-item"?: string;
}

export function SearchableSelect({
  options,
  onSearch,
  resolveLabel,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyMessage = "No results found.",
  disabled,
  className,
  id,
  "data-kbd-item": dataKbdItem,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 250);
  const [searchResults, setSearchResults] = useState<SearchableSelectOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolvedLabel, setResolvedLabel] = useState<string | null>(null);

  // Server-search mode fetches a fresh page whenever the (debounced) query
  // changes, including once on open with an empty query so the list isn't
  // blank before the user types anything.
  useEffect(() => {
    if (!onSearch || !open) return;
    let cancelled = false;
    setSearching(true);
    onSearch(debouncedQuery)
      .then((results) => {
        if (!cancelled) setSearchResults(results);
      })
      .catch(() => {
        if (!cancelled) setSearchResults([]);
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [onSearch, open, debouncedQuery]);

  // The selected value's label may not be in the current search page —
  // resolve it directly so the trigger button doesn't just show a raw id.
  useEffect(() => {
    if (!onSearch || !resolveLabel || !value) {
      setResolvedLabel(null);
      return;
    }
    const fromResults = searchResults.find((o) => o.value === value)?.label;
    if (fromResults) {
      setResolvedLabel(fromResults);
      return;
    }
    let cancelled = false;
    resolveLabel(value).then((label) => {
      if (!cancelled) setResolvedLabel(label);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onSearch, resolveLabel, value]);

  const items = onSearch ? searchResults : (options ?? []);
  const selectedLabel = onSearch
    ? resolvedLabel
    : (options ?? []).find((o) => o.value === value)?.label;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger
        id={id}
        disabled={disabled}
        data-kbd-item={dataKbdItem}
        className={cn(
          "border-input bg-background ring-offset-background placeholder:text-muted-foreground flex h-9 w-full items-center justify-between rounded-md border px-3 py-2 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
      >
        <span className={selectedLabel ? "" : "text-muted-foreground"}>
          {selectedLabel ?? placeholder}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-(--anchor-width) p-0" align="start">
        <Command shouldFilter={!onSearch}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={onSearch ? query : undefined}
            onValueChange={onSearch ? setQuery : undefined}
          />
          <CommandList>
            <CommandEmpty>{searching ? "Searching…" : emptyMessage}</CommandEmpty>
            <CommandGroup>
              {items.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  keywords={[option.label, ...(option.keywords ?? [])]}
                  onSelect={() => {
                    onChange(option.value === value ? null : option.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      option.value === value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
