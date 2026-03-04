"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUsers } from "@/lib/hooks/use-users";
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
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

export interface UserPickerProps {
  value?: string | null;
  onChange: (userId: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function UserPicker({
  value,
  onChange,
  placeholder = "Select user...",
  disabled = false,
  className,
}: UserPickerProps) {
  const [open, setOpen] = useState(false);

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
          <span className="truncate">{placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search team members..." />
          <CommandList>
            <CommandEmpty>No team member found.</CommandEmpty>
            <CommandGroup />
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
