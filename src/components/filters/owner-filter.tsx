"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentUser } from "@/lib/hooks/use-current-user";

export type OwnerFilterValue = "my" | "all" | "unassigned";

interface OwnerFilterProps {
  value: OwnerFilterValue;
  onChange: (value: OwnerFilterValue) => void;
  label?: string;
}

export function OwnerFilter({ value, onChange, label = "Owner" }: OwnerFilterProps) {
  const { isLoading } = useCurrentUser();

  return (
    <Select value={value} onValueChange={(v) => onChange(v as OwnerFilterValue)} disabled={isLoading}>
      <SelectTrigger className="w-[150px]">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="my">My Records</SelectItem>
        <SelectItem value="all">All Records</SelectItem>
        <SelectItem value="unassigned">Unassigned</SelectItem>
      </SelectContent>
    </Select>
  );
}

/**
 * Resolves the OwnerFilter value to an ownerId string for API calls.
 * Returns undefined for "all", the user's ID for "my", or "unassigned" for unassigned.
 */
export function resolveOwnerFilter(
  filterValue: OwnerFilterValue,
  userId: string | undefined
): string | undefined {
  switch (filterValue) {
    case "my":
      return userId;
    case "unassigned":
      return "unassigned";
    case "all":
    default:
      return undefined;
  }
}
