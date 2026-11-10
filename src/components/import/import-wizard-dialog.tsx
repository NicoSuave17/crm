"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
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
import {
  Upload,
  FileSpreadsheet,
  Check,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Info,
  Plus,
  UserIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { parseCsvFile, type CsvParseResult } from "@/lib/utils/csv";
import {
  CONTACT_IMPORT_FIELDS,
  COMPANY_IMPORT_FIELDS,
  autoMapColumnsForFields,
  transformRow,
  applyDefaults,
  applyCompanyDefaults,
  customFieldsToImportFields,
  separateCompanyData,
  type ImportField,
} from "@/lib/utils/csv-mapping";
import { createContactSchema } from "@/lib/validators/contact";
import { createCompanySchema } from "@/lib/validators/company";
import { normalizeDomain, normalizeCompanyName } from "@/lib/utils/normalize";
import { useFieldDefinitions } from "@/lib/hooks/use-custom-fields";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { useUsers } from "@/lib/hooks/use-users";
import { FieldEditor } from "@/components/admin/field-editor";
// field-resolution removed — dedup is now server-side
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────

export interface ImportWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "contact" | "company";
}

interface ValidationResult {
  index: number;
  data: Record<string, string>;
  valid: boolean;
  errors: string[];
}

type Step = 1 | 2 | 3 | 4;

const STEP_LABELS = ["Upload", "Tag & Map", "Preview", "Confirm"];

// ─── Within-CSV Dedup ────────────────────────────────────────────

interface CsvDedupResult {
  deduped: Record<string, string>[];
  removedCount: number;
  hadDifferingData: boolean;
}

function dedupCsvRows(
  rows: Record<string, string>[],
  mapping: Record<string, string | null>,
  mode: "contact" | "company"
): CsvDedupResult {
  if (mode === "contact") {
    // Dedup by email
    const emailField = Object.entries(mapping).find(([, v]) => v === "email");
    if (!emailField) return { deduped: rows, removedCount: 0, hadDifferingData: false };

    const emailHeader = emailField[0];
    const seen = new Map<string, Record<string, string>>();
    let removedCount = 0;
    let hadDifferingData = false;

    for (const row of rows) {
      const email = row[emailHeader]?.trim().toLowerCase();
      if (!email) {
        // No email — keep the row (can't dedup without email)
        seen.set(`__no_email_${seen.size}`, row);
        continue;
      }
      if (seen.has(email)) {
        removedCount++;
        // Check if data differs
        const existing = seen.get(email)!;
        const differs = Object.keys(row).some(
          (k) => k !== emailHeader && row[k]?.trim() !== existing[k]?.trim()
        );
        if (differs) hadDifferingData = true;
      } else {
        seen.set(email, row);
      }
    }

    return { deduped: [...seen.values()], removedCount, hadDifferingData };
  }

  // Company dedup: by normalized domain first, then normalized name
  const domainField = Object.entries(mapping).find(([, v]) => v === "domain");
  const nameField = Object.entries(mapping).find(([, v]) => v === "name");

  const seen = new Map<string, Record<string, string>>();
  let removedCount = 0;
  let hadDifferingData = false;

  for (const row of rows) {
    const rawDomain = domainField ? row[domainField[0]]?.trim() : "";
    const rawName = nameField ? row[nameField[0]]?.trim() : "";
    const normalizedDom = normalizeDomain(rawDomain);
    const normalizedNm = normalizeCompanyName(rawName);

    const key = normalizedDom || (normalizedNm ? `name:${normalizedNm}` : `__unique_${seen.size}`);

    if (seen.has(key)) {
      removedCount++;
      const existing = seen.get(key)!;
      const differs = Object.keys(row).some((k) => row[k]?.trim() !== existing[k]?.trim());
      if (differs) hadDifferingData = true;
    } else {
      seen.set(key, row);
    }
  }

  return { deduped: [...seen.values()], removedCount, hadDifferingData };
}

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
                  isCompleted && "bg-green-500 border-green-500 text-white",
                  isActive && "bg-primary border-primary text-primary-foreground",
                  !isCompleted && !isActive && "border-muted-foreground/30 text-muted-foreground"
                )}
              >
                {isCompleted ? <Check className="h-3.5 w-3.5" /> : stepNum}
              </div>
              <span
                className={cn(
                  "text-[10px]",
                  isActive ? "text-foreground font-medium" : "text-muted-foreground"
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

// ─── Confidence Badge ────────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: number }) {
  if (confidence >= 80) {
    return (
      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
        {confidence}%
      </Badge>
    );
  }
  if (confidence >= 50) {
    return (
      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
        {confidence}%
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
      {confidence}%
    </Badge>
  );
}

// ─── Main Component ──────────────────────────────────────────────

export function ImportWizardDialog({
  open,
  onOpenChange,
  mode = "contact",
}: ImportWizardDialogProps) {
  const queryClient = useQueryClient();
  const isContact = mode === "contact";
  const builtInFields = isContact ? CONTACT_IMPORT_FIELDS : COMPANY_IMPORT_FIELDS;
  const schema = isContact ? createContactSchema : createCompanySchema;
  const applyDefaultsFn = isContact ? applyDefaults : applyCompanyDefaults;

  // Custom fields
  const entityType = isContact ? "contact" : "company";
  const { data: customFieldDefs } = useFieldDefinitions(entityType);
  const { isAdminOrManager } = useCurrentUser();

  const importFields = useMemo(() => {
    const defs = Array.isArray(customFieldDefs) ? customFieldDefs : [];
    if (defs.length === 0) return builtInFields;
    const customFields = customFieldsToImportFields(defs, isContact ? "contact" : "company");
    return [...builtInFields, ...customFields];
  }, [builtInFields, customFieldDefs]);

  // Split import fields by category for Phase B dropdowns
  const contactImportFields = useMemo(
    () => importFields.filter((f) => f.group !== "company"),
    [importFields]
  );
  const companyImportFields = useMemo(
    () => importFields.filter((f) => f.group === "company"),
    [importFields]
  );

  // Inline custom field creation state
  const [creatingFieldForHeader, setCreatingFieldForHeader] = useState<string | null>(null);
  const createFieldMutation = useMutation({
    mutationFn: async (data: {
      entityType: string;
      name: string;
      label: string;
      fieldType: string;
      options?: { value: string; label: string }[];
      isRequired: boolean;
      isVisibleInList: boolean;
      position: number;
    }) => {
      const res = await fetch("/api/custom-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create field");
      return res.json();
    },
    onSuccess: (newField) => {
      // Invalidate to refetch custom field definitions
      queryClient.invalidateQueries({ queryKey: ["custom-fields", "definitions", entityType] });

      // Auto-map the CSV column to the new custom field
      if (creatingFieldForHeader) {
        const fieldKey = `cf_${newField.name}`;
        setColumnMapping((prev) => ({
          ...prev,
          [creatingFieldForHeader]: fieldKey,
        }));
        setAutoMapped((prev) => {
          const next = new Set(prev);
          next.delete(creatingFieldForHeader);
          return next;
        });
      }

      setCreatingFieldForHeader(null);
      toast.success("Custom field created");
    },
    onError: () => {
      toast.error("Failed to create custom field");
    },
  });

  // Wizard state
  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<CsvParseResult | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string | null>>({});
  const [autoMapped, setAutoMapped] = useState<Set<string>>(new Set());
  const [dedupedRows, setDedupedRows] = useState<Record<string, string>[]>([]);
  const [csvDedupInfo, setCsvDedupInfo] = useState<{ removedCount: number; hadDifferingData: boolean } | null>(null);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isAiMapping, setIsAiMapping] = useState(false);
  const [aiMappingMethod, setAiMappingMethod] = useState<"ai" | "alias" | null>(null);

  // Owner assignment
  const [defaultOwnerId, setDefaultOwnerId] = useState<string | null>(null);
  const { data: usersList } = useUsers();

  // Column categories (Phase A of Step 2)
  const [columnCategories, setColumnCategories] = useState<Record<string, "contact" | "company" | "skip">>({});
  // Confidence scores from AI mapping
  const [columnConfidences, setColumnConfidences] = useState<Record<string, number>>({});


  // Reset everything when dialog closes
  function resetWizard() {
    setStep(1);
    setFile(null);
    setParseResult(null);
    setColumnMapping({});
    setAutoMapped(new Set());
    setDedupedRows([]);
    setCsvDedupInfo(null);
    setValidationResults([]);
    setIsDragging(false);
    setIsSubmitting(false);
    setCreatingFieldForHeader(null);
    setIsAiMapping(false);
    setAiMappingMethod(null);
    setColumnCategories({});
    setColumnConfidences({});
    setDefaultOwnerId(null);
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      if (isSubmitting) return;
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

  // ─── Step 2: Tag & Map ────────────────────────────────────────

  // Apply alias-based mapping instantly when entering Step 2
  useEffect(() => {
    if (step === 2 && parseResult && Object.keys(columnMapping).length === 0) {
      applyAliasMapping();
    }
  }, [step, parseResult, columnMapping]);

  /** Instant alias-based field mapping */
  function applyAliasMapping() {
    if (!parseResult) return;
    const auto = autoMapColumnsForFields(parseResult.headers, importFields);
    setColumnMapping(auto);
    const mapped = new Set<string>();
    const categories: Record<string, "contact" | "company" | "skip"> = {};
    const confidences: Record<string, number> = {};

    const fieldGroupMap = new Map<string, "contact" | "company">();
    for (const f of importFields) {
      if (f.group) fieldGroupMap.set(f.key, f.group);
    }

    for (const [header, fieldKey] of Object.entries(auto)) {
      if (fieldKey) {
        mapped.add(header);
        categories[header] = fieldGroupMap.get(fieldKey) || "contact";
        confidences[header] = 80;
      } else {
        categories[header] = "skip";
        confidences[header] = 0;
      }
    }
    setAutoMapped(mapped);
    setColumnCategories(categories);
    setColumnConfidences(confidences);
    setAiMappingMethod("alias");
    setIsAiMapping(false);
  }

  /** Optional AI re-analyze: sends headers + sample rows to OpenRouter */
  async function handleAiReanalyze() {
    if (!parseResult) return;
    setIsAiMapping(true);
    try {
      const res = await fetch("/api/gatekeeper/map-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headers: parseResult.headers,
          sampleRows: parseResult.rows.slice(0, 2).map((row) =>
            parseResult.headers.map((h) => row[h] || "")
          ),
          entityType: mode,
          customFieldDefinitions: customFieldDefs?.map((d: { id: string; name: string; label: string; fieldType: string }) => ({
            id: d.id,
            name: d.name,
            label: d.label,
            fieldType: d.fieldType,
          })),
        }),
      });

      if (!res.ok) throw new Error("AI mapping request failed");
      const result = await res.json();

      const aiMapping: Record<string, string | null> = {};
      const aiCategories: Record<string, "contact" | "company" | "skip"> = {};
      const aiConfidences: Record<string, number> = {};
      const mapped = new Set<string>();
      for (const m of result.mappings) {
        aiMapping[m.csvHeader] = m.crmField || null;
        aiCategories[m.csvHeader] = m.category || (m.crmField ? "contact" : "skip");
        aiConfidences[m.csvHeader] = m.confidence ?? 0;
        if (m.crmField) mapped.add(m.csvHeader);
      }
      setColumnMapping(aiMapping);
      setColumnCategories(aiCategories);
      setColumnConfidences(aiConfidences);
      setAutoMapped(mapped);
      setAiMappingMethod("ai");
      toast.success("AI mapping applied");
    } catch {
      toast.error("AI mapping failed — keeping current mapping");
    } finally {
      setIsAiMapping(false);
    }
  }

  function handleCategoryChange(csvHeader: string, category: "contact" | "company" | "skip") {
    setColumnCategories((prev) => ({ ...prev, [csvHeader]: category }));
    // If switching to skip, clear the field mapping
    if (category === "skip") {
      setColumnMapping((prev) => ({ ...prev, [csvHeader]: null }));
    }
    // If switching from skip to a category and the field was previously mapped, keep it
    // Otherwise clear it so the user picks a new field
    if (category !== "skip") {
      const currentField = columnMapping[csvHeader];
      if (currentField) {
        // Check if the current field belongs to the new category
        const fieldDef = importFields.find((f) => f.key === currentField);
        const fieldGroup = fieldDef?.group || "contact";
        if (fieldGroup !== category) {
          // Field doesn't match new category — clear it
          setColumnMapping((prev) => ({ ...prev, [csvHeader]: null }));
        }
      }
    }
    setAutoMapped((prev) => {
      const next = new Set(prev);
      next.delete(csvHeader);
      return next;
    });
  }

  function handleMappingChange(csvHeader: string, fieldKey: string) {
    if (fieldKey === "__create_field__") {
      setCreatingFieldForHeader(csvHeader);
      return;
    }
    setColumnMapping((prev) => ({
      ...prev,
      [csvHeader]: fieldKey === "__skip__" ? null : fieldKey,
    }));
    setAutoMapped((prev) => {
      const next = new Set(prev);
      next.delete(csvHeader);
      return next;
    });
  }

  const requiredField = isContact ? "firstName" : "name";
  const isRequiredMapped = Object.values(columnMapping).includes(requiredField);
  const isTypeMapped = isContact ? Object.values(columnMapping).includes("type") : true;

  // Headers grouped by category for Phase B
  const contactHeaders = useMemo(
    () => parseResult?.headers.filter((h) => columnCategories[h] === "contact") || [],
    [parseResult, columnCategories]
  );
  const companyHeaders = useMemo(
    () => parseResult?.headers.filter((h) => columnCategories[h] === "company") || [],
    [parseResult, columnCategories]
  );

  // When transitioning from Step 2 -> 3, run within-CSV dedup
  function handleStep2Next() {
    if (!parseResult) return;

    // Run within-CSV dedup
    const result = dedupCsvRows(parseResult.rows, columnMapping, mode);
    setDedupedRows(result.deduped);
    setCsvDedupInfo({ removedCount: result.removedCount, hadDifferingData: result.hadDifferingData });

    setStep(3);
  }

  // ─── Step 3: Validation Preview ───────────────────────────────

  useEffect(() => {
    if (step === 3 && dedupedRows.length > 0) {
      const results = dedupedRows.map((csvRow, index) => {
        const transformed = transformRow(csvRow, columnMapping);
        const withDefaults = applyDefaultsFn(transformed);
        const result = schema.safeParse(withDefaults);
        return {
          index,
          data: withDefaults,
          valid: result.success,
          errors: result.success ? [] : result.error.issues.map((i) => i.message),
        };
      });
      setValidationResults(results);
    }
  }, [step, dedupedRows]);

  const validCount = validationResults.filter((r) => r.valid).length;
  const invalidCount = validationResults.filter((r) => !r.valid).length;
  const previewRows = validationResults.slice(0, 5);
  const mappedFields = importFields.filter((f) => Object.values(columnMapping).includes(f.key));

  // ─── Step 4: Confirm & Submit ────────────────────────────────

  // Build the final payload — all valid rows become creates
  function buildPayload() {
    const validRows = validationResults.filter((r) => r.valid);
    return validRows.map((row) => {
      const { contactData, companyData } = isContact
        ? separateCompanyData(row.data)
        : { contactData: row.data, companyData: null };
      return { action: "create", data: contactData, companyData };
    });
  }

  async function handleSubmit() {
    setIsSubmitting(true);

    try {
      const payload = buildPayload();

      // Build customFieldMap for the processor to know how to type-coerce cf_* values
      const customFieldMap: Record<string, { fieldDefinitionId: string; fieldType: string }> = {};
      for (const field of importFields) {
        if (field.customFieldId && field.customFieldType) {
          customFieldMap[field.key] = {
            fieldDefinitionId: field.customFieldId,
            fieldType: field.customFieldType,
          };
        }
      }

      const res = await fetch("/api/import-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: mode,
          fileName: file?.name,
          rows: payload,
          customFieldMap: Object.keys(customFieldMap).length > 0 ? customFieldMap : undefined,
          defaultOwnerId: defaultOwnerId || undefined,
          preApproved: true,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || "Failed to start import");
        setIsSubmitting(false);
        return;
      }

      // Close dialog and show toast
      queryClient.invalidateQueries({ queryKey: [isContact ? "contacts" : "companies"] });
      handleOpenChange(false);
      toast.success("Import started — you'll be notified when it's complete");
    } catch {
      toast.error("Failed to start import");
      setIsSubmitting(false);
    }
  }

  // ─── Navigation ──────────────────────────────────────────────

  function handleNext() {
    if (step === 2) {
      handleStep2Next();
      return;
    }
    if (step < 4) {
      setStep((s) => (s + 1) as Step);
    }
  }

  function handleBack() {
    if (step === 2) {
      setFile(null);
      setParseResult(null);
      setColumnMapping({});
      setAutoMapped(new Set());
      setValidationResults([]);
      setDedupedRows([]);
      setCsvDedupInfo(null);
      setColumnCategories({});
      setColumnConfidences({});
    }
    if (step > 1 && step <= 4) {
      setStep((s) => (s - 1) as Step);
    }
  }

  // ─── Render ──────────────────────────────────────────────────

  const entityLabel = isContact ? "Contacts" : "Companies";
  const entitySingular = isContact ? "Contact" : "Company";

  // Helper to get sample values for a column
  function getSampleValues(header: string, count: number = 2): string[] {
    if (!parseResult) return [];
    return parseResult.rows
      .slice(0, count)
      .map((row) => row[header] || "")
      .filter((v) => v !== "");
  }

  // Determine which field list to show for a given category
  function getFieldsForCategory(category: "contact" | "company"): ImportField[] {
    if (category === "company") return companyImportFields;
    return contactImportFields;
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Import {entityLabel} — Step {step} of 4
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

        {/* Step 2: Tag & Map */}
        {step === 2 && parseResult && (
          <div className="space-y-4">
            {isAiMapping ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md p-3">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                AI is analyzing your CSV columns and mapping them to CRM fields...
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Tag each column as Contact, Company, or Skip, then map to CRM fields.
                </p>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {aiMappingMethod && (
                    <Badge variant={aiMappingMethod === "ai" ? "default" : "secondary"}>
                      {aiMappingMethod === "ai" ? "AI Mapped" : "Auto Mapped"}
                    </Badge>
                  )}
                  {aiMappingMethod === "alias" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAiReanalyze}
                      disabled={isAiMapping}
                    >
                      {isAiMapping ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : null}
                      Re-analyze with AI
                    </Button>
                  )}
                </div>
              </div>
            )}

            {!isRequiredMapped && !isAiMapping && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md p-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {isContact ? "First Name" : "Name"} must be mapped to continue.
              </div>
            )}

            {isContact && !isTypeMapped && !isAiMapping && (
              <div className="flex items-center gap-2 text-sm text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 rounded-md p-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Type is not mapped. Rows will default to &quot;lead&quot;.
              </div>
            )}

            {/* Phase A: Column Tagging */}
            {!isAiMapping && (
              <>
                <div>
                  <h4 className="text-sm font-medium mb-2">Column Categories</h4>
                  <div className="rounded-md border max-h-[200px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[140px]">CSV Column</TableHead>
                          <TableHead className="w-[160px]">Sample Values</TableHead>
                          <TableHead className="w-[140px]">Category</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parseResult.headers.map((header) => {
                          const category = columnCategories[header] || "skip";
                          const samples = getSampleValues(header, 2);

                          return (
                            <TableRow
                              key={header}
                              className={cn(category === "skip" && "opacity-50")}
                            >
                              <TableCell className="font-mono text-xs truncate max-w-[140px]">
                                {header}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground truncate max-w-[160px]">
                                {samples.length > 0 ? samples.join(", ") : <span className="italic">empty</span>}
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={category}
                                  onValueChange={(v) => handleCategoryChange(header, v as "contact" | "company" | "skip")}
                                >
                                  <SelectTrigger className="w-[130px] h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="contact">Contact Field</SelectItem>
                                    {isContact && <SelectItem value="company">Company Field</SelectItem>}
                                    <SelectItem value="skip">Skip</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Phase B: Field Mapping */}
                <div className="space-y-3">
                  {/* Contact Fields Section */}
                  {contactHeaders.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Contact Fields</h4>
                      <div className="rounded-md border max-h-[180px] overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>CSV Column</TableHead>
                              <TableHead>Maps To</TableHead>
                              <TableHead className="w-[60px]" />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {contactHeaders.map((header) => {
                              const currentValue = columnMapping[header];
                              const isAuto = autoMapped.has(header);
                              const confidence = columnConfidences[header] ?? 0;

                              const usedByOthers = new Set(
                                Object.entries(columnMapping)
                                  .filter(([h, v]) => h !== header && v !== null)
                                  .map(([, v]) => v)
                              );

                              const fieldsForDropdown = getFieldsForCategory("contact");

                              return (
                                <TableRow key={header}>
                                  <TableCell className="font-mono text-xs">
                                    {header}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <Select
                                        value={currentValue ?? "__skip__"}
                                        onValueChange={(v) => handleMappingChange(header, v)}
                                      >
                                        <SelectTrigger className="w-[170px] h-8 text-xs">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="__skip__">(Unmapped)</SelectItem>
                                          <SelectGroup>
                                            <SelectLabel>Required</SelectLabel>
                                            {fieldsForDropdown
                                              .filter((f) => f.required && !f.customFieldId)
                                              .map((f) => (
                                                <SelectItem
                                                  key={f.key}
                                                  value={f.key}
                                                  disabled={usedByOthers.has(f.key)}
                                                >
                                                  {f.label}
                                                </SelectItem>
                                              ))}
                                          </SelectGroup>
                                          <SelectGroup>
                                            <SelectLabel>Optional</SelectLabel>
                                            {fieldsForDropdown
                                              .filter((f) => !f.required && !f.customFieldId)
                                              .map((f) => (
                                                <SelectItem
                                                  key={f.key}
                                                  value={f.key}
                                                  disabled={usedByOthers.has(f.key)}
                                                >
                                                  {f.label}
                                                </SelectItem>
                                              ))}
                                          </SelectGroup>
                                          {fieldsForDropdown.some((f) => f.customFieldId) && (
                                            <SelectGroup>
                                              <SelectLabel>Custom Fields</SelectLabel>
                                              {fieldsForDropdown
                                                .filter((f) => f.customFieldId)
                                                .map((f) => (
                                                  <SelectItem
                                                    key={f.key}
                                                    value={f.key}
                                                    disabled={usedByOthers.has(f.key)}
                                                  >
                                                    {f.label}
                                                  </SelectItem>
                                                ))}
                                            </SelectGroup>
                                          )}
                                          {isAdminOrManager && (
                                            <SelectGroup>
                                              <SelectItem value="__create_field__">
                                                <span className="flex items-center gap-1.5 text-primary">
                                                  <Plus className="h-3 w-3" />
                                                  Create New Field
                                                </span>
                                              </SelectItem>
                                            </SelectGroup>
                                          )}
                                        </SelectContent>
                                      </Select>
                                      {!currentValue && (
                                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                                          Unmapped
                                        </Badge>
                                      )}
                                      {isAuto && currentValue && confidence > 0 && (
                                        <ConfidenceBadge confidence={confidence} />
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    {isAuto && currentValue && (
                                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                        auto
                                      </Badge>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {/* Company Fields Section */}
                  {isContact && companyHeaders.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Company Fields</h4>
                      <div className="rounded-md border max-h-[180px] overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>CSV Column</TableHead>
                              <TableHead>Maps To</TableHead>
                              <TableHead className="w-[60px]" />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {companyHeaders.map((header) => {
                              const currentValue = columnMapping[header];
                              const isAuto = autoMapped.has(header);
                              const confidence = columnConfidences[header] ?? 0;

                              const usedByOthers = new Set(
                                Object.entries(columnMapping)
                                  .filter(([h, v]) => h !== header && v !== null)
                                  .map(([, v]) => v)
                              );

                              const fieldsForDropdown = getFieldsForCategory("company");

                              return (
                                <TableRow key={header}>
                                  <TableCell className="font-mono text-xs">
                                    {header}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <Select
                                        value={currentValue ?? "__skip__"}
                                        onValueChange={(v) => handleMappingChange(header, v)}
                                      >
                                        <SelectTrigger className="w-[170px] h-8 text-xs">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="__skip__">(Unmapped)</SelectItem>
                                          {fieldsForDropdown.map((f) => (
                                            <SelectItem
                                              key={f.key}
                                              value={f.key}
                                              disabled={usedByOthers.has(f.key)}
                                            >
                                              {f.label}
                                            </SelectItem>
                                          ))}
                                          {isAdminOrManager && (
                                            <SelectGroup>
                                              <SelectItem value="__create_field__">
                                                <span className="flex items-center gap-1.5 text-primary">
                                                  <Plus className="h-3 w-3" />
                                                  Create New Field
                                                </span>
                                              </SelectItem>
                                            </SelectGroup>
                                          )}
                                        </SelectContent>
                                      </Select>
                                      {!currentValue && (
                                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                                          Unmapped
                                        </Badge>
                                      )}
                                      {isAuto && currentValue && confidence > 0 && (
                                        <ConfidenceBadge confidence={confidence} />
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    {isAuto && currentValue && (
                                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                        auto
                                      </Badge>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {/* No columns tagged */}
                  {contactHeaders.length === 0 && companyHeaders.length === 0 && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md p-3">
                      <Info className="h-4 w-4 shrink-0" />
                      No columns tagged. Tag at least one column as Contact or Company above.
                    </div>
                  )}
                </div>
              </>
            )}
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

            {isContact && !isTypeMapped && (
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
                        <TableCell key={f.key} className="text-xs max-w-[150px] truncate">
                          {row.data[f.key] || (
                            <span className="text-muted-foreground">—</span>
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
                    <p key={r.index} className="text-xs text-muted-foreground">
                      Row {r.index + 1}: {r.errors.join(", ")}
                    </p>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Step 4: Confirm & Assign Owner */}
        {step === 4 && (
          <div className="space-y-4 py-4">
            <p className="text-sm font-medium text-center">
              Ready to import — confirm the summary below.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border p-4 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-2xl font-bold">{validCount}</span>
                </div>
                <p className="text-xs text-muted-foreground">Will be imported</p>
              </div>

              <div className="rounded-lg border p-4 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-2xl font-bold">{invalidCount}</span>
                </div>
                <p className="text-xs text-muted-foreground">Skipped (invalid)</p>
              </div>
            </div>

            {/* Owner Assignment */}
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 mb-2">
                <UserIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Assign Owner</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Select who should own the imported records. Records with an owner email in the CSV will use that instead.
              </p>
              <Select
                value={defaultOwnerId || "unassigned"}
                onValueChange={(v) => setDefaultOwnerId(v === "unassigned" ? null : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="No owner (unassigned)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">No owner (unassigned)</SelectItem>
                  {(Array.isArray(usersList) ? usersList : [])
                    .filter((u: { isActive: boolean }) => u.isActive)
                    .map((u: { id: string; firstName: string; lastName: string; email: string }) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.firstName} {u.lastName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              Import will process in the background. You&apos;ll be notified when it&apos;s complete.
            </p>
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
              <Button onClick={handleNext} disabled={!isRequiredMapped || isAiMapping}>
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
                Review & Confirm
              </Button>
            </>
          )}

          {step === 4 && (
            <>
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Start Import
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>

      {/* Inline custom field creation dialog */}
      {creatingFieldForHeader && (
        <FieldEditor
          open={!!creatingFieldForHeader}
          onOpenChange={(open) => {
            if (!open) setCreatingFieldForHeader(null);
          }}
          entityType={entityType}
          defaultLabel={creatingFieldForHeader}
          onSave={(data) => createFieldMutation.mutate(data)}
          isPending={createFieldMutation.isPending}
        />
      )}
    </Dialog>
  );
}
