"use client";

import { useState } from "react";
import { useFieldValues, useSetFieldValue } from "@/lib/hooks/use-custom-fields";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Pencil, Check, X } from "lucide-react";

interface FieldOption {
  value: string;
  label: string;
  color?: string;
}

interface FieldValue {
  id: string;
  fieldDefinitionId: string;
  fieldLabel: string;
  fieldType: string;
  textValue: string | null;
  numberValue: string | null;
  dateValue: string | null;
  booleanValue: boolean | null;
  options: FieldOption[] | null;
}

interface CustomFieldsDisplayProps {
  entityId: string;
}

export function CustomFieldsDisplay({ entityId }: CustomFieldsDisplayProps) {
  const { data: fieldValues } = useFieldValues(entityId);
  const setFieldValue = useSetFieldValue();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  if (!fieldValues || fieldValues.length === 0) return null;

  function handleSave(fieldDefinitionId: string, fieldType: string) {
    const payload: Record<string, unknown> = {
      fieldDefinitionId,
      entityId,
    };

    if (fieldType === "boolean") {
      payload.booleanValue = editValue === "true";
    } else if (fieldType === "number" || fieldType === "currency") {
      payload.numberValue = editValue;
    } else if (fieldType === "date") {
      payload.dateValue = editValue;
    } else {
      payload.textValue = editValue;
    }

    setFieldValue.mutate(payload as Parameters<typeof setFieldValue.mutate>[0], {
      onSuccess: () => setEditingId(null),
    });
  }

  function handleSelectChange(fieldDefinitionId: string, value: string) {
    setFieldValue.mutate({
      fieldDefinitionId,
      entityId,
      textValue: value,
    });
  }

  function handleMultiSelectToggle(
    fieldDefinitionId: string,
    optionValue: string,
    currentValues: string[],
    checked: boolean
  ) {
    const next = checked
      ? [...currentValues, optionValue]
      : currentValues.filter((v) => v !== optionValue);
    setFieldValue.mutate({
      fieldDefinitionId,
      entityId,
      textValue: JSON.stringify(next),
    });
  }

  function getDisplayValue(field: FieldValue) {
    if (field.fieldType === "boolean") return field.booleanValue ? "Yes" : "No";
    if (field.fieldType === "date" && field.dateValue)
      return new Date(field.dateValue).toLocaleDateString();
    if (field.fieldType === "number" || field.fieldType === "currency")
      return field.numberValue ?? "\u2014";
    if (field.fieldType === "select") {
      const options = field.options ?? [];
      const opt = options.find((o) => o.value === field.textValue);
      return opt?.label ?? field.textValue ?? "\u2014";
    }
    if (field.fieldType === "multi_select") {
      const options = field.options ?? [];
      let selectedValues: string[] = [];
      try {
        selectedValues = field.textValue ? JSON.parse(field.textValue) : [];
      } catch {
        selectedValues = [];
      }
      if (selectedValues.length === 0) return "\u2014";
      return selectedValues
        .map((v) => options.find((o) => o.value === v)?.label ?? v)
        .join(", ");
    }
    return field.textValue ?? "\u2014";
  }

  function getCurrentValue(field: FieldValue) {
    if (field.fieldType === "boolean") return String(field.booleanValue ?? false);
    if (field.fieldType === "date") return field.dateValue?.slice(0, 10) ?? "";
    if (field.fieldType === "number" || field.fieldType === "currency")
      return field.numberValue ?? "";
    return field.textValue ?? "";
  }

  function renderSelectField(field: FieldValue) {
    const options = field.options ?? [];
    return (
      <Select
        value={field.textValue ?? ""}
        onValueChange={(val) => handleSelectChange(field.fieldDefinitionId, val)}
      >
        <SelectTrigger className="h-7 w-40 text-sm">
          <SelectValue placeholder="Select..." />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  function renderMultiSelectField(field: FieldValue) {
    const options = field.options ?? [];
    let selectedValues: string[] = [];
    try {
      selectedValues = field.textValue ? JSON.parse(field.textValue) : [];
    } catch {
      selectedValues = [];
    }

    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="h-7 w-40 justify-start text-sm font-normal truncate"
          >
            {selectedValues.length > 0
              ? selectedValues
                  .map((v) => options.find((o) => o.value === v)?.label ?? v)
                  .join(", ")
              : "Select..."}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-2">
          {options.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2 px-2 py-1 hover:bg-muted rounded cursor-pointer"
            >
              <Checkbox
                checked={selectedValues.includes(opt.value)}
                onCheckedChange={(checked) =>
                  handleMultiSelectToggle(
                    field.fieldDefinitionId,
                    opt.value,
                    selectedValues,
                    !!checked
                  )
                }
              />
              <span className="text-sm">{opt.label}</span>
            </label>
          ))}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div className="space-y-3">
      {fieldValues.map((field: FieldValue) => (
        <div key={field.id} className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {field.fieldLabel}
          </span>
          {field.fieldType === "select" ? (
            renderSelectField(field)
          ) : field.fieldType === "multi_select" ? (
            renderMultiSelectField(field)
          ) : editingId === field.fieldDefinitionId ? (
            <div className="flex items-center gap-1">
              <Input
                className="h-7 w-32 text-sm"
                type={
                  field.fieldType === "number" || field.fieldType === "currency"
                    ? "number"
                    : field.fieldType === "date"
                      ? "date"
                      : "text"
                }
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() =>
                  handleSave(field.fieldDefinitionId, field.fieldType)
                }
              >
                <Check className="h-3 w-3" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => setEditingId(null)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium">
                {getDisplayValue(field)}
              </span>
              <button
                onClick={() => {
                  setEditingId(field.fieldDefinitionId);
                  setEditValue(getCurrentValue(field));
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
