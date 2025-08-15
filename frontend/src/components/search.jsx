import Fuse from "fuse.js";
import { useEffect, useState } from "react";
import * as React from "react";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

function useDebounce(val, delay) {
  const [debouncedVal, setdebouncedVal] = useState(val);
  useEffect(() => {
    const handler = setTimeout(() => setdebouncedVal(val), delay);
    return () => clearTimeout(handler);
  }, [val, delay]);
  return debouncedVal;
}

export function Search() {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState("Select companies...");
  const [query, setQuery] = useState("");
  const [fuse, setFuse] = useState(null);
  const [results, setResults] = useState([]);

  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    fetch("/data/nse_list.json")
      .then((res) => res.json())
      .then((data) => {
        const fuse = new Fuse(data, {
          keys: ["ticker", "name"],
        });
        setFuse(fuse);
      });
  }, []);

  useEffect(() => {
    if (!fuse || debouncedQuery.trim() === "") {
      setResults([]);
      return;
    }
    const results = fuse.search(debouncedQuery);
    setResults(results.map((result) => result.item));
  }, [debouncedQuery, fuse]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-auto min-w-[200px] justify-between"
        >
          {value}
          <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput
            value={query}
            onValueChange={(val) => {
              setQuery(val);
            }}
          />
          <CommandList>
            <CommandEmpty>No company found.</CommandEmpty>
            <CommandGroup>
              {results.map((result) => {
                const label = `${result.name} (${result.ticker})`;
                return (
                  <CommandItem
                    key={result.ticker}
                    value={label}
                    onSelect={(currentValue) => {
                      setValue(currentValue === value ? "" : currentValue);
                      setQuery("");
                      setResults([]);
                      setOpen(false);
                    }}
                  >
                    <CheckIcon
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === label ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
