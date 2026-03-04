"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  FileSpreadsheet,
  Check,
  X,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { parseCsvFile, type CsvParseResult } from "@/lib/utils/csv";
import {
  CONTACT_IMPORT_FIELDS,
  autoMapColumns,
  transformRow,
  applyDefaults,
} from "@/lib/utils/csv-mapping";
import { createContactSchema } from "@/lib/validators/contact";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────

interface ImportWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ValidationResult {
  index: number;
  data: Record<string, string>;
  valid: boolean;
  errors: string[];
}

interface ImportResults {
  created: number;
  skipped: number;
  errors: number;
  errorDetails: { index: number; message: string }[];
}

type Step = 1 | 2 | 3 | 4 | 5;

const STEP_LABELS = ["Upload", "Map", "Preview", "Import", "Done"];
const BATCH_SIZE = 50;

// ─── Step Indicator ──────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  return (
    <div className="flex items-center justify-center gap-1 py-4">
      {STEP_LABELS.map((label, i) => {
        const stepNum = (i + 1) as Step;
        const isCompleted = stepNum < current;
        const isActive = stepNum === current;

        return (
          <div key={label} className="flex items-center">
            {i > 0 && (
              <div
                className={cn(
                  "h-0.5 w-8 mx-1",
                  isCompleted ? "bg-green-500" : "bg-muted"
                )}
              />
            )}
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium border-2",
                  isCompleted &&
                    "bg-green-500 border-green-500 text-white",
                  isActive &&
                    "bg-primary border-primary text-primary-foreground",
                  !isCompleted &&
                    !isActive &&
                    "border-muted-foreground/30 text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  stepNum
                )}
              </div>
              <span
                className={cn(
                  "text-[10px]",
                  isActive
                    ? "text-foreground font-medium"
                    : "text-muted-foreground"
                )}
              >
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────

export function ImportWizardDialog({
  open,
  onOpenChange,
}: ImportWizardDialogProps) {
  const queryClient = useQueryClient();

  // Wizard state
  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<CsvParseResult | null>(null);
  const [columnMapping, setColumnMapping] = useState<
    Record<string, string | null>
  >({});
  const [autoMapped, setAutoMapped] = useState<Set<string>>(new Set());
  const [validationResults, setValidationResults] = useState<
    ValidationResult[]
  >([]);
  const [importProgress, setImportProgress] = useState({
    current: 0,
    total: 0,
  });
  const [importResults, setImportResults] = useState<ImportResults | null>(
    null
  );
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const cancelledRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset everything when dialog closes
  function resetWizard() {
    setStep(1);
    setFile(null);
    setParseResult(null);
    setColumnMapping({});
    setAutoMapped(new Set());
    setValidationResults([]);
    setImportProgress({ current: 0, total: 0 });
    setImportResults(null);
    setIsDragging(false);
    setIsImporting(false);
    cancelledRef.current = false;
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      // Don't allow closing during import
      if (isImporting) return;
      resetWizard();
    }
    onOpenChange(open);
  }

  // ─── Step 1: Upload ──────────────────────────────────────────

  async function handleFile(f: File) {
    if (!f.name.toLowerCase().endsWith(".csv")) {
      toast.error("Please select a CSV file");
      return;
    }
    setFile(f);
    try {
      const result = await parseCsvFile(f);
      setParseResult(result);
    } catch {
      toast.error("Failed to parse CSV file");
    }
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  // ─── Step 2: Map Columns ─────────────────────────────────────

  useEffect(() => {
    if (step === 2 && parseResult && Object.keys(columnMapping).length === 0) {
      const auto = autoMapColumns(parseResult.headers);
      setColumnMapping(auto);
      // Track which ones were auto-mapped
      const mapped = new Set<string>();
      for (const [header, fieldKey] of Object.entries(auto)) {
        if (fieldKey) mapped.add(header);
      }
      setAutoMapped(mapped);
    }
  }, [step, parseResult, columnMapping]);

  function handleMappingChange(csvHeader: string, fieldKey: string) {
    setColumnMapping((prev) => ({
      ...prev,
      [csvHeader]: fieldKey === "__skip__" ? null : fieldKey,
    }));
    // Remove auto-mapped badge if user changes it
    setAutoMapped((prev) => {
      const next = new Set(prev);
      next.delete(csvHeader);
      return next;
    });
  }

  const isFirstNameMapped = Object.values(columnMapping).includes("firstName");
  const isTypeMapped = Object.values(columnMapping).includes("type");

  // ─── Step 3: Preview ─────────────────────────────────────────

  function runValidation() {
    if (!parseResult) return;

    const results = parseResult.rows.map((csvRow, index) => {
      const transformed = transformRow(csvRow, columnMapping);
      const withDefaults = applyDefaults(transformed);
      const result = createContactSchema.safeParse(withDefaults);
      return {
        index,
        data: withDefaults,
        valid: result.success,
        errors: result.success
          ? []
          : result.error.issues.map((i) => i.message),
      };
    });

    setValidationResults(results);
  }

  useEffect(() => {
    if (step === 3) {
      runValidation();
    }
  }, [step]);

  const validCount = validationResults.filter((r) => r.valid).length;
  const invalidCount = validationResults.filter((r) => !r.valid).length;
  const previewRows = validationResults.slice(0, 5);
  const mappedFields = CONTACT_IMPORT_FIELDS.filter((f) =>
    Object.values(columnMapping).includes(f.key)
  );

  // ─── Step 4: Import ──────────────────────────────────────────

  async function runImport() {
    if (!parseResult) return;

    setIsImporting(true);
    cancelledRef.current = false;

    // Transform and validate all rows
    const allTransformed = parseResult.rows.map((row) => {
      const transformed = transformRow(row, columnMapping);
      return applyDefaults(transformed);
    });

    const validRows = allTransformed.filter(
      (row) => createContactSchema.safeParse(row).success
    );
    const skipped = allTransformed.length - validRows.length;

    setImportProgress({ current: 0, total: validRows.length });

    let created = 0;
    let errors = 0;
    const errorDetails: { index: number; message: string }[] = [];

    for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
      if (cancelledRef.current) break;

      const batch = validRows.slice(i, i + BATCH_SIZE);

      try {
        const res = await fetch("/api/bulk", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "import_contacts",
            contacts: batch,
          }),
        });
        const result = await res.json();
        created += result.created ?? 0;
        errors += result.errors ?? 0;

        if (result.errorDetails) {
          for (const detail of result.errorDetails) {
            errorDetails.push({
              index: i + detail.index,
              message: detail.message,
            });
          }
        }
      } catch {
        errors += batch.length;
      }

      setImportProgress({
        current: Math.min(i + BATCH_SIZE, validRows.length),
        total: validRows.length,
      });
    }

    setImportResults({
      created,
      skipped,
      errors,
      errorDetails,
    });
    setIsImporting(false);
    setStep(5);
  }

  function handleCancel() {
    cancelledRef.current = true;
  }

  // ─── Step 5: Summary ─────────────────────────────────────────

  function handleDone() {
    queryClient.invalidateQueries({ queryKey: ["contacts"] });
    handleOpenChange(false);
    toast.success(
      `Import complete: ${importResults?.created ?? 0} contacts created`
    );
  }

  // ─── Navigation ──────────────────────────────────────────────

  function handleNext() {
    if (step === 3) {
      setStep(4);
      // Start import on next tick so the UI renders step 4 first
      setTimeout(() => runImport(), 100);
      return;
    }
    if (step < 5) {
      setStep((s) => (s + 1) as Step);
    }
  }

  function handleBack() {
    if (step === 2) {
      // Going back to step 1 clears everything
      setFile(null);
      setParseResult(null);
      setColumnMapping({});
      setAutoMapped(new Set());
      setValidationResults([]);
    }
    if (step === 4 && isImporting) {
      handleCancel();
    }
    if (step > 1 && step < 4) {
      setStep((s) => (s - 1) as Step);
    }
  }

  // ─── Render ──────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Import Contacts — Step {step} of 5
          </DialogTitle>
        </DialogHeader>

        <StepIndicator current={step} />

        {/* Step 1: Upload */}
        {step === 1 && (
          <div className="space-y-4">
            <div
              className={cn(
                "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 transition-colors cursor-pointer",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50"
              )}
              onDragOver={handleDragOver}
              onDragEnter={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-10 w-10 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">
                  Drop a CSV file here or click to browse
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Supports .csv files with headers
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </div>

            {file && parseResult && (
              <div className="flex items-center gap-3 rounded-lg border p-3 bg-muted/50">
                <FileSpreadsheet className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {parseResult.rowCount} rows found
                  </p>
                </div>
                {parseResult.errors.length > 0 && (
                  <Badge variant="destructive" className="shrink-0">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {parseResult.errors.length} parse errors
                  </Badge>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Map Columns */}
        {step === 2 && parseResult && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Map CSV columns to contact fields. Auto-detected mappings are
              shown. Change any mapping manually.
            </p>

            {!isFirstNameMapped && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md p-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                First Name must be mapped to continue.
              </div>
            )}

            {!isTypeMapped && (
              <div className="flex items-center gap-2 text-sm text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 rounded-md p-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Type is not mapped. Rows will default to &quot;lead&quot;.
              </div>
            )}

            <div className="rounded-md border max-h-[340px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>CSV Column</TableHead>
                    <TableHead>Maps To</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parseResult.headers.map((header) => {
                    const currentValue = columnMapping[header];
                    const isAuto = autoMapped.has(header);

                    // Determine which fields are already used by other headers
                    const usedByOthers = new Set(
                      Object.entries(columnMapping)
                        .filter(
                          ([h, v]) => h !== header && v !== null
                        )
                        .map(([, v]) => v)
                    );

                    return (
                      <TableRow key={header}>
                        <TableCell className="font-mono text-sm">
                          &quot;{header}&quot;
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Select
                              value={currentValue ?? "__skip__"}
                              onValueChange={(v) =>
                                handleMappingChange(header, v)
                              }
                            >
                              <SelectTrigger className="w-[180px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__skip__">
                                  (Skip)
                                </SelectItem>
                                <SelectGroup>
                                  <SelectLabel>Required</SelectLabel>
                                  {CONTACT_IMPORT_FIELDS.filter(
                                    (f) => f.required
                                  ).map((f) => (
                                    <SelectItem
                                      key={f.key}
                                      value={f.key}
                                      disabled={usedByOthers.has(
                                        f.key
                                      )}
                                    >
                                      {f.label}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                                <SelectGroup>
                                  <SelectLabel>Optional</SelectLabel>
                                  {CONTACT_IMPORT_FIELDS.filter(
                                    (f) => !f.required
                                  ).map((f) => (
                                    <SelectItem
                                      key={f.key}
                                      value={f.key}
                                      disabled={usedByOthers.has(
                                        f.key
                                      )}
                                    >
                                      {f.label}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                            {isAuto && currentValue && (
                              <Badge
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0"
                              >
                                auto
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm">
              <span>
                5 of {validationResults.length} rows previewed.
              </span>
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                {validCount} valid
              </Badge>
              {invalidCount > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="h-3 w-3" />
                  {invalidCount} with issues
                </Badge>
              )}
            </div>

            {!isTypeMapped && (
              <p className="text-xs text-muted-foreground bg-muted rounded-md p-2">
                Rows without a valid type will default to &quot;lead&quot;.
                Source is set to &quot;import&quot; for all rows.
              </p>
            )}

            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]" />
                    {mappedFields.map((f) => (
                      <TableHead key={f.key} className="text-xs whitespace-nowrap">
                        {f.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row) => (
                    <TableRow key={row.index}>
                      <TableCell>
                        {row.valid ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <div title={row.errors.join("; ")}>
                            <XCircle className="h-4 w-4 text-destructive" />
                          </div>
                        )}
                      </TableCell>
                      {mappedFields.map((f) => (
                        <TableCell
                          key={f.key}
                          className="text-xs max-w-[150px] truncate"
                        >
                          {row.data[f.key] || (
                            <span className="text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {previewRows.some((r) => !r.valid) && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-destructive">
                  Validation issues in preview:
                </p>
                {previewRows
                  .filter((r) => !r.valid)
                  .map((r) => (
                    <p
                      key={r.index}
                      className="text-xs text-muted-foreground"
                    >
                      Row {r.index + 1}: {r.errors.join(", ")}
                    </p>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Step 4: Import */}
        {step === 4 && (
          <div className="space-y-6 py-8">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="text-center space-y-1">
                <p className="text-sm font-medium">
                  Importing... {importProgress.current} of{" "}
                  {importProgress.total}
                </p>
                <p className="text-xs text-muted-foreground">
                  Processing in batches of {BATCH_SIZE}
                </p>
              </div>
              <div className="w-full max-w-md">
                <Progress
                  value={
                    importProgress.total > 0
                      ? (importProgress.current /
                          importProgress.total) *
                        100
                      : 0
                  }
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Summary */}
        {step === 5 && importResults && (
          <div className="space-y-4 py-4">
            <div className="text-center space-y-2 mb-6">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
              <p className="text-lg font-semibold">Import Complete</p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg border p-4 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-2xl font-bold">
                    {importResults.created}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">Created</p>
              </div>

              <div className="rounded-lg border p-4 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <span className="text-2xl font-bold">
                    {importResults.skipped}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Skipped (invalid)
                </p>
              </div>

              <div className="rounded-lg border p-4 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <XCircle className="h-4 w-4 text-destructive" />
                  <span className="text-2xl font-bold">
                    {importResults.errors}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Failed (server)
                </p>
              </div>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              Total rows processed:{" "}
              {importResults.created +
                importResults.skipped +
                importResults.errors}
            </p>

            {importResults.errorDetails.length > 0 && (
              <details className="rounded-md border p-3">
                <summary className="text-sm font-medium cursor-pointer text-destructive">
                  {importResults.errorDetails.length} error details
                </summary>
                <div className="mt-2 space-y-1 max-h-[200px] overflow-y-auto">
                  {importResults.errorDetails.map((e, i) => (
                    <p
                      key={i}
                      className="text-xs text-muted-foreground"
                    >
                      Row {e.index + 1}: {e.message}
                    </p>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        {/* Footer */}
        <DialogFooter>
          {step === 1 && (
            <Button
              onClick={handleNext}
              disabled={!parseResult || parseResult.rowCount === 0}
            >
              Next
            </Button>
          )}

          {step === 2 && (
            <>
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
              <Button onClick={handleNext} disabled={!isFirstNameMapped}>
                Next
              </Button>
            </>
          )}

          {step === 3 && (
            <>
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
              <Button onClick={handleNext} disabled={validCount === 0}>
                Import {validCount} Contacts
              </Button>
            </>
          )}

          {step === 4 && (
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={!isImporting}
            >
              Cancel
            </Button>
          )}

          {step === 5 && (
            <Button onClick={handleDone}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
