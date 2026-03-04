"use client";

import { CheckSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BulkActionBarProps {
  selectedCount: number;
  onClear: () => void;
  children: React.ReactNode;
}

export function BulkActionBar({ selectedCount, onClear, children }: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border bg-background/95 px-4 py-3 shadow-lg backdrop-blur min-w-[400px] animate-in slide-in-from-bottom-4 duration-200">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground whitespace-nowrap">
        <CheckSquare className="h-4 w-4" />
        {selectedCount} selected
      </div>
      <div className="h-4 w-px bg-border" />
      <div className="flex items-center gap-2">
        {children}
      </div>
      <div className="ml-auto">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onClear}
          aria-label="Clear selection"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
