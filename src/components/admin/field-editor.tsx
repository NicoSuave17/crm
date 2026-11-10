"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X } from "lucide-react";

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "boolean", label: "Boolean" },
  { value: "select", label: "Select" },
  { value: "multi_select", label: "Multi Select" },
  { value: "url", label: "URL" },
  { value: "email", label: "Email" },
  { value: "currency", label: "Currency" },
];

interface FieldEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: string;
  initialData?: {
    id: string;
    name: string;
    label: string;
    fieldType: string;
    options: { value: string; label: string; color?: string }[] | null;
    isRequired: boolean;
    isVisibleInList: boolean;
    position: number;
  };
  /** Pre-populate label for new field creation (without triggering edit mode) */
  defaultLabel?: string;
  onSave: (data: {
    id?: string;
    entityType: string;
    name: string;
    label: string;
    fieldType: string;
    options?: { value: string; label: string }[];
    isRequired: boolean;
    isVisibleInList: boolean;
    position: number;
  }) => void;
  isPending?: boolean;
}

export function FieldEditor({
  open,
  onOpenChange,
  entityType,
  initialData,
  defaultLabel,
  onSave,
  isPending,
}: FieldEditorProps) {
  const seedLabel = initialData?.label ?? defaultLabel ?? "";
  const seedName = initialData?.name ?? (defaultLabel
    ? defaultLabel.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")
    : "");
  const [label, setLabel] = useState(seedLabel);
  const [name, setName] = useState(seedName);
  const [fieldType, setFieldType] = useState(initialData?.fieldType ?? "text");
  const [isRequired, setIsRequired] = useState(initialData?.isRequired ?? false);
  const [isVisibleInList, setIsVisibleInList] = useState(
    initialData?.isVisibleInList ?? false
  );
  const [options, setOptions] = useState<{ value: string; label: string }[]>(
    initialData?.options ?? []
  );
  const [newOption, setNewOption] = useState("");

  const showOptions = fieldType === "select" || fieldType === "multi_select";

  function handleLabelChange(val: string) {
    setLabel(val);
    if (!initialData) {
      // Auto-generate name from label
      setName(
        val
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_|_$/g, "")
      );
    }
  }

  function addOption() {
    if (!newOption.trim()) return;
    const value = newOption.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
    setOptions([...options, { value, label: newOption.trim() }]);
    setNewOption("");
  }

  function removeOption(idx: number) {
    setOptions(options.filter((_, i) => i !== idx));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      id: initialData?.id,
      entityType,
      name,
      label,
      fieldType,
      options: showOptions ? options : undefined,
      isRequired,
      isVisibleInList,
      position: initialData?.position ?? 0,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Edit Field" : "Add Custom Field"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Label</Label>
            <Input
              value={label}
              onChange={(e) => handleLabelChange(e.target.value)}
              placeholder="Field label"
              required
            />
          </div>

          <div>
            <Label>Name (API key)</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="field_name"
              disabled={!!initialData}
              required
            />
          </div>

          <div>
            <Label>Type</Label>
            <Select
              value={fieldType}
              onValueChange={setFieldType}
              disabled={!!initialData}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((ft) => (
                  <SelectItem key={ft.value} value={ft.value}>
                    {ft.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showOptions && (
            <div>
              <Label className="mb-2 block">Options</Label>
              <div className="space-y-1.5 mb-2">
                {options.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-sm flex-1">{opt.label}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removeOption(idx)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newOption}
                  onChange={(e) => setNewOption(e.target.value)}
                  placeholder="Add option"
                  className="h-8"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addOption();
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={addOption}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={isRequired}
                onCheckedChange={(c) => setIsRequired(!!c)}
              />
              Required field
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={isVisibleInList}
                onCheckedChange={(c) => setIsVisibleInList(!!c)}
              />
              Visible in list view
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
