"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { listReportTypes } from "@/lib/admin/report-type-registry";

interface StepReportTypeProps {
  name: string;
  onNameChange: (name: string) => void;
  description: string;
  onDescriptionChange: (desc: string) => void;
  reportType: string;
  onReportTypeChange: (type: string) => void;
  format: string;
  onFormatChange: (format: string) => void;
}

export function StepReportType({
  name,
  onNameChange,
  description,
  onDescriptionChange,
  reportType,
  onReportTypeChange,
  format,
  onFormatChange,
}: StepReportTypeProps) {
  const reportTypes = listReportTypes();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Report Name</Label>
          <Input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g., Monthly Deal Summary"
            required
          />
        </div>
        <div>
          <Label>Format</Label>
          <Select value={format} onValueChange={onFormatChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tabular">Tabular (Flat rows)</SelectItem>
              <SelectItem value="summary">Summary (Grouped with subtotals)</SelectItem>
              <SelectItem value="matrix">Matrix (Pivot table)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Description (optional)</Label>
        <Textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="What does this report show?"
          rows={2}
        />
      </div>

      <div>
        <Label className="mb-3 block">Report Type</Label>
        <div className="grid grid-cols-2 gap-3">
          {reportTypes.map((rt) => (
            <Card
              key={rt.key}
              className={`cursor-pointer transition-colors hover:border-primary/50 ${
                reportType === rt.key ? "border-primary bg-primary/5" : ""
              }`}
              onClick={() => onReportTypeChange(rt.key)}
            >
              <CardContent className="p-3">
                <p className="font-medium text-sm">{rt.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {rt.description}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {rt.availableFields.length} fields available
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
