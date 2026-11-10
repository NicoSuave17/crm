"use client";

import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FieldDefinition {
  id: string;
  name: string;
  label: string;
  fieldType: string;
  options: { value: string; label: string; color?: string }[] | null;
  isRequired: boolean | null;
}

interface CustomFieldsFormSectionProps {
  entityType: "contact" | "deal" | "company";
  values: Record<string, string | boolean>;
  onChange: (fieldId: string, value: string | boolean) => void;
}

export function CustomFieldsFormSection({
  entityType,
  values,
  onChange,
}: CustomFieldsFormSectionProps) {
  const { data: fields } = useQuery<FieldDefinition[]>({
    queryKey: ["custom-field-definitions", entityType],
    queryFn: async () => {
      const res = await fetch(`/api/custom-fields?entityType=${entityType}`);
      if (!res.ok) throw new Error("Failed to fetch custom fields");
      return res.json();
    },
  });

  if (!fields || fields.length === 0) return null;

  return (
    <div className="space-y-4 border-t pt-4">
      <p className="text-sm font-medium text-muted-foreground">Custom Fields</p>
      {fields.map((field) => (
        <div key={field.id} className="space-y-2">
          <Label htmlFor={`cf-${field.id}`}>
            {field.label}
            {field.isRequired && " *"}
          </Label>
          {renderFieldInput(field, values[field.id], (val) =>
            onChange(field.id, val)
          )}
        </div>
      ))}
    </div>
  );
}

function renderFieldInput(
  field: FieldDefinition,
  value: string | boolean | undefined,
  onChange: (val: string | boolean) => void
) {
  switch (field.fieldType) {
    case "text":
    case "url":
    case "email":
      return (
        <Input
          id={`cf-${field.id}`}
          type={field.fieldType === "email" ? "email" : "text"}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.fieldType === "url" ? "https://..." : undefined}
        />
      );

    case "number":
    case "currency":
      return (
        <Input
          id={`cf-${field.id}`}
          type="number"
          step={field.fieldType === "currency" ? "0.01" : "any"}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "date":
      return (
        <Input
          id={`cf-${field.id}`}
          type="date"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "boolean":
      return (
        <div className="flex items-center gap-2">
          <Checkbox
            id={`cf-${field.id}`}
            checked={(value as boolean) ?? false}
            onCheckedChange={(checked) => onChange(!!checked)}
          />
          <Label htmlFor={`cf-${field.id}`} className="text-sm font-normal">
            {field.label}
          </Label>
        </div>
      );

    case "select":
      return (
        <Select
          value={(value as string) ?? ""}
          onValueChange={(v) => onChange(v === "__none__" ? "" : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder={`Select ${field.label}`} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">None</SelectItem>
            {field.options?.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case "multi_select":
      return (
        <Input
          id={`cf-${field.id}`}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Comma-separated values"
        />
      );

    default:
      return (
        <Input
          id={`cf-${field.id}`}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}
