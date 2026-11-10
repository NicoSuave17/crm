"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FormulaEditorProps {
  formula: string;
  onChange: (formula: string) => void;
  outputType: string;
  onOutputTypeChange: (type: string) => void;
  availableFields: string[];
  error?: string;
}

export function FormulaEditor({
  formula,
  onChange,
  outputType,
  onOutputTypeChange,
  availableFields,
  error,
}: FormulaEditorProps) {
  return (
    <div className="space-y-3">
      <div>
        <Label>Formula</Label>
        <Input
          value={formula}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g., currentMrr * 12 or wonDeals / totalDeals * 100"
          className={error ? "border-destructive" : ""}
          spellCheck={false}
        />
        {error && (
          <p className="text-xs text-destructive mt-1">{error}</p>
        )}
      </div>

      <div>
        <Label>Output Type</Label>
        <Select value={outputType} onValueChange={onOutputTypeChange}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="number">Number</SelectItem>
            <SelectItem value="currency">Currency</SelectItem>
            <SelectItem value="percent">Percent</SelectItem>
            <SelectItem value="text">Text</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">Available Fields (click to insert)</Label>
        <div className="flex flex-wrap gap-1 mt-1">
          {availableFields.slice(0, 20).map((field) => (
            <Badge
              key={field}
              variant="outline"
              className="text-[10px] cursor-pointer hover:bg-primary/10"
              onClick={() => {
                const fieldRef = field.replace(/\./g, "_");
                onChange(formula ? `${formula} ${fieldRef}` : fieldRef);
              }}
            >
              {field}
            </Badge>
          ))}
          {availableFields.length > 20 && (
            <span className="text-[10px] text-muted-foreground">
              +{availableFields.length - 20} more
            </span>
          )}
        </div>
      </div>

      <div className="text-xs text-muted-foreground space-y-0.5">
        <p>Supported: + - * / round() abs() min() max() ceil() floor() ifelse(cond, true, false)</p>
      </div>
    </div>
  );
}
