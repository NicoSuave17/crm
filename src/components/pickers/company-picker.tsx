"use client";

import { useState } from "react";
import { Building2, Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCompanies } from "@/lib/hooks/use-companies";
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

export interface CompanyPickerProps {
  value?: string | null;
  onChange: (companyId: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function CompanyPicker({
  value,
  onChange,
  placeholder = "Select company...",
  disabled = false,
  className,
}: CompanyPickerProps) {
  const [open, setOpen] = useState(false);
  const { data } = useCompanies();

  const companies = ((data?.data ?? data ?? []) as Array<{ id: string; name: string; domain: string | null }>);

  // Find the selected company for display
  const selectedCompany = value ? companies.find((c) => c.id === value) : null;

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
          {selectedCompany ? (
            <span className="flex items-center gap-2 truncate">
              <Building2 className="h-4 w-4" />
              <span className="truncate">{selectedCompany.name}</span>
              {selectedCompany.domain && (
                <span className="text-xs text-muted-foreground truncate">{selectedCompany.domain}</span>
              )}
            </span>
          ) : value ? (
            <span className="truncate text-muted-foreground">Unknown company</span>
          ) : (
            <span className="truncate">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search companies..." />
          <CommandList>
            <CommandEmpty>No company found.</CommandEmpty>
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
              {companies.map((company) => (
                <CommandItem
                  key={company.id}
                  value={`${company.name} ${company.domain ?? ""}`}
                  onSelect={() => {
                    onChange(company.id === value ? null : company.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === company.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <Building2 className="h-5 w-5 mr-2 text-muted-foreground" />
                  <span className="text-sm">{company.name}</span>
                  {company.domain && (
                    <span className="ml-1 text-xs text-muted-foreground">{company.domain}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
