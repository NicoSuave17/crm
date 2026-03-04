"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Handshake, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDeals } from "@/lib/hooks/use-deals";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";

export interface DealPickerProps {
  value?: string | null;
  onChange: (dealId: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function DealPicker({
  value,
  onChange,
  placeholder = "Select deal...",
  disabled = false,
  className,
}: DealPickerProps) {
  const [open, setOpen] = useState(false);
  const { data } = useDeals();

  const allDeals = (data ?? []) as Array<{
    id: string;
    title: string;
    stageName: string;
    stageColor: string | null;
    value: string | null;
    pipelineName: string;
  }>;

  // Find the selected deal for display
  const selectedDeal = value ? allDeals.find((d) => d.id === value) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={disabled}
        >
          {selectedDeal ? (
            <span className="flex items-center gap-2 truncate">
              <Handshake className="h-4 w-4" />
              <span className="truncate">{selectedDeal.title}</span>
            </span>
          ) : value ? (
            <span className="truncate text-muted-foreground">Unknown deal</span>
          ) : (
            <span className="truncate">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search deals..." />
          <CommandList>
            <CommandEmpty>No deal found.</CommandEmpty>
            {value && (
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                >
                  <X className="mr-2 h-4 w-4" />
                  <span className="text-muted-foreground">Clear selection</span>
                </CommandItem>
              </CommandGroup>
            )}
            {value && <CommandSeparator />}
            <CommandGroup>
              {allDeals.map((deal) => (
                <CommandItem
                  key={deal.id}
                  value={deal.title}
                  onSelect={() => {
                    onChange(deal.id === value ? null : deal.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === deal.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <Handshake className="h-5 w-5 mr-2 text-muted-foreground" />
                  <span className="text-sm truncate mr-2">{deal.title}</span>
                  <span className="flex items-center ml-auto shrink-0">
                    <span
                      className="inline-block h-2 w-2 rounded-full mr-1"
                      style={{ backgroundColor: deal.stageColor ?? "#6B7280" }}
                    />
                    <span className="text-xs text-muted-foreground">{deal.stageName}</span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
