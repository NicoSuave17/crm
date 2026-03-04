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
  const { data: users = [] } = useUsers();

  // Type the users array
  const allUsers = users as Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl: string | null;
    isActive: boolean;
  }>;

  // Only show active users in the picker
  const activeUsers = allUsers.filter((user) => user.isActive === true);

  // Find the selected user from all users (including inactive) for display
  const selectedUser = value ? allUsers.find((u) => u.id === value) : null;

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
          {selectedUser ? (
            <span className="flex items-center gap-2 truncate">
              <Avatar className="h-5 w-5">
                <AvatarImage src={selectedUser.avatarUrl ?? undefined} alt={selectedUser.firstName} />
                <AvatarFallback className="text-xs">
                  {selectedUser.firstName?.[0]}{selectedUser.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">{selectedUser.firstName} {selectedUser.lastName}</span>
            </span>
          ) : value ? (
            <span className="truncate text-muted-foreground">Unknown user</span>
          ) : (
            <span className="truncate">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search team members..." />
          <CommandList>
            <CommandEmpty>No team member found.</CommandEmpty>
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
              {activeUsers.map((user) => (
                <CommandItem
                  key={user.id}
                  value={`${user.firstName} ${user.lastName} ${user.email}`}
                  onSelect={() => {
                    onChange(user.id === value ? null : user.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === user.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <Avatar className="h-6 w-6 mr-2">
                    <AvatarImage src={user.avatarUrl ?? undefined} alt={user.firstName} />
                    <AvatarFallback className="text-xs">
                      {user.firstName?.[0]}{user.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{user.firstName} {user.lastName}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
