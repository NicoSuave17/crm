"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";

interface OptionsEditorProps {
  options: { value: string; label: string; color?: string }[];
  onChange: (options: { value: string; label: string; color?: string }[]) => void;
}

export function OptionsEditor({ options, onChange }: OptionsEditorProps) {
  const [newOption, setNewOption] = useState("");

  function handleAdd() {
    const label = newOption.trim();
    if (!label) return;
    // Auto-generate value from label (lowercase, underscored)
    const value = label.toLowerCase().replace(/\s+/g, "_");
    // Prevent duplicates
    if (options.some((o) => o.value === value)) return;
    onChange([...options, { value, label }]);
    setNewOption("");
  }

  function handleRemove(index: number) {
    onChange(options.filter((_, i) => i !== index));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Options</label>
      {options.length > 0 && (
        <div className="space-y-1">
          {options.map((option, index) => (
            <div
              key={option.value}
              className="flex items-center gap-2 rounded border px-2 py-1"
            >
              <span className="text-sm flex-1">{option.label}</span>
              <span className="text-xs text-muted-foreground">
                {option.value}
              </span>
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          placeholder="Add an option..."
          value={newOption}
          onChange={(e) => setNewOption(e.target.value)}
          onKeyDown={handleKeyDown}
          className="text-sm"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAdd}
          disabled={!newOption.trim()}
        >
          Add
        </Button>
      </div>
      {options.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Add at least one option for this field type.
        </p>
      )}
    </div>
  );
}
