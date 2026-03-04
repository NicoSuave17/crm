"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useContacts } from "@/lib/hooks/use-contacts";
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
import { Badge } from "@/components/ui/badge";

export interface ContactPickerProps {
  value?: string | null;
  onChange: (contactId: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function ContactPicker({
  value,
  onChange,
  placeholder = "Select contact...",
  disabled = false,
  className,
}: ContactPickerProps) {
  const [open, setOpen] = useState(false);
  const result = useContacts({ limit: 100 });

  const contacts = (result.data?.data ?? []) as Array<{
    id: string;
    firstName: string;
    lastName: string | null;
    email: string | null;
    avatarUrl: string | null;
    type: "creator" | "lead" | "enterprise_prospect" | "partner";
  }>;

  // Find the selected contact for display
  const selectedContact = value ? contacts.find((c) => c.id === value) : null;

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
          {selectedContact ? (
            <span className="flex items-center gap-2 truncate">
              <Avatar className="h-5 w-5">
                <AvatarImage src={selectedContact.avatarUrl ?? undefined} alt={selectedContact.firstName} />
                <AvatarFallback className="text-xs">
                  {selectedContact.firstName?.[0]}{selectedContact.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">{selectedContact.firstName} {selectedContact.lastName ?? ""}</span>
              <Badge variant="outline" className="ml-1 shrink-0">{selectedContact.type}</Badge>
            </span>
          ) : value ? (
            <span className="truncate text-muted-foreground">Unknown contact</span>
          ) : (
            <span className="truncate">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search contacts..." />
          <CommandList>
            <CommandEmpty>No contact found.</CommandEmpty>
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
              {contacts.map((contact) => (
                <CommandItem
                  key={contact.id}
                  value={`${contact.firstName} ${contact.lastName ?? ""} ${contact.email ?? ""}`}
                  onSelect={() => {
                    onChange(contact.id === value ? null : contact.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === contact.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <Avatar className="h-6 w-6 mr-2">
                    <AvatarImage src={contact.avatarUrl ?? undefined} alt={contact.firstName} />
                    <AvatarFallback className="text-xs">
                      {contact.firstName?.[0]}{contact.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{contact.firstName} {contact.lastName ?? ""}</span>
                  <Badge variant="outline" className="ml-auto shrink-0">{contact.type}</Badge>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
