# Phase 9b: CSV Import Wizard

**Requirements:** BULK-05 (also maps to IMPT-01..05 from Phase 12 requirements)
**Scope:** Multi-step dialog for importing contacts from a CSV file: upload, map columns, preview, import with progress, summary.
**Wave:** 2 (can be built independently but logically follows 9a)
**Depends on:** None (existing bulk API route already has `import_contacts` action; `createContactSchema` validator exists)

---

## Current State Assessment

### What exists:
- **Bulk API** (`src/app/api/bulk/route.ts`) — Has `action: "import_contacts"` handler that loops through rows and calls `createContact()` for each. Logs audit event with created/errors count. However, this is naive: it sends all rows in a single request body with no progress tracking, no duplicate detection, and no field validation before insert.
- **Contact validator** (`src/lib/validators/contact.ts`) — `createContactSchema` with all field validations. The import wizard reuses this for client-side preview validation.
- **Contact schema** (`src/lib/db/schema.ts`) — Full contacts table definition with all columns, enums for type/status/tier/source/churnRisk.
- **Contacts page** already has an "Export" button. The "Import" button will be added next to it.

### What needs to be built:
1. CSV parsing utility (client-side, using `papaparse` or built-in)
2. Multi-step import dialog component (5 steps)
3. Column mapping logic with auto-detection
4. Preview validation (dry-run against Zod schema)
5. Enhanced bulk import API endpoint with progress support
6. "Import" button on contacts page

---

## Implementation Steps

### Step 1: Install papaparse
**Action:** `npm install papaparse && npm install -D @types/papaparse`

Papaparse is the standard CSV parser for JavaScript. It handles edge cases (quoted fields, escaping, different delimiters, BOM) that a naive `split(",")` would miss. It works client-side (no server needed for parsing), which keeps the preview fast and avoids uploading the file to the server before the user maps columns.

### Step 2: Create CSV parsing utility
**File:** `src/lib/utils/csv.ts` (new)

```ts
import Papa from "papaparse";

export interface CsvParseResult {
  headers: string[];
  rows: Record<string, string>[];
  rowCount: number;
  errors: Papa.ParseError[];
}

export function parseCsvFile(file: File): Promise<CsvParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        resolve({
          headers: results.meta.fields ?? [],
          rows: results.data as Record<string, string>[],
          rowCount: results.data.length,
          errors: results.errors,
        });
      },
      error: (error) => reject(error),
    });
  });
}
```

### Step 3: Create column mapping logic
**File:** `src/lib/utils/csv-mapping.ts` (new)

Defines the target fields and auto-detection rules.

**Target fields (importable contact fields):**
```ts
export interface ImportField {
  key: string;          // matches createContactSchema field name
  label: string;        // human-readable label
  required: boolean;
  aliases: string[];    // CSV header strings that auto-map to this field
}

export const CONTACT_IMPORT_FIELDS: ImportField[] = [
  { key: "firstName", label: "First Name", required: true, aliases: ["first name", "first_name", "firstname", "first", "name"] },
  { key: "lastName", label: "Last Name", required: false, aliases: ["last name", "last_name", "lastname", "last", "surname"] },
  { key: "email", label: "Email", required: false, aliases: ["email", "email address", "email_address", "e-mail"] },
  { key: "phone", label: "Phone", required: false, aliases: ["phone", "phone number", "phone_number", "tel", "telephone", "mobile"] },
  { key: "type", label: "Type", required: true, aliases: ["type", "contact type", "contact_type", "category"] },
  { key: "status", label: "Status", required: false, aliases: ["status", "contact status", "contact_status"] },
  { key: "tier", label: "Tier", required: false, aliases: ["tier", "level"] },
  { key: "source", label: "Source", required: false, aliases: ["source", "lead source", "lead_source"] },
  { key: "linkedinUrl", label: "LinkedIn URL", required: false, aliases: ["linkedin", "linkedin url", "linkedin_url", "linkedin link"] },
  { key: "twitterUrl", label: "Twitter URL", required: false, aliases: ["twitter", "twitter url", "twitter_url", "x url"] },
  { key: "websiteUrl", label: "Website URL", required: false, aliases: ["website", "website url", "website_url", "url", "web"] },
  { key: "whopUsername", label: "Whop Username", required: false, aliases: ["whop username", "whop_username", "whop", "username"] },
];
```

**Auto-mapping function:**
```ts
export function autoMapColumns(csvHeaders: string[]): Record<string, string | null> {
  // Returns: { csvHeader -> importFieldKey | null }
  const mapping: Record<string, string | null> = {};
  const usedFields = new Set<string>();

  for (const header of csvHeaders) {
    const normalized = header.toLowerCase().trim();
    let matched = false;
    for (const field of CONTACT_IMPORT_FIELDS) {
      if (usedFields.has(field.key)) continue;
      if (field.aliases.includes(normalized) || normalized === field.key.toLowerCase()) {
        mapping[header] = field.key;
        usedFields.add(field.key);
        matched = true;
        break;
      }
    }
    if (!matched) {
      mapping[header] = null; // unmapped column
    }
  }

  return mapping;
}
```

**Row transformation function:**
```ts
export function transformRow(
  csvRow: Record<string, string>,
  mapping: Record<string, string | null>
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [csvHeader, fieldKey] of Object.entries(mapping)) {
    if (fieldKey && csvRow[csvHeader] !== undefined && csvRow[csvHeader] !== "") {
      result[fieldKey] = csvRow[csvHeader].trim();
    }
  }
  return result;
}
```

### Step 4: Create ImportWizardDialog component
**File:** `src/components/import/import-wizard-dialog.tsx` (new)

A multi-step dialog using shadcn Dialog. The wizard manages 5 steps via internal state.

**Props:**
```ts
interface ImportWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

**Internal state:**
```ts
const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
const [file, setFile] = useState<File | null>(null);
const [parseResult, setParseResult] = useState<CsvParseResult | null>(null);
const [columnMapping, setColumnMapping] = useState<Record<string, string | null>>({});
const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
const [importResults, setImportResults] = useState<{ created: number; skipped: number; errors: ImportError[] } | null>(null);
```

**Dialog layout:**
- Title changes per step: "Import Contacts - Step {n} of 5"
- Step indicator: horizontal bar showing 5 numbered circles, filled/active/pending states
- Content area changes per step
- Footer has Back/Next/Import/Done buttons depending on step

**Step indicator component (inline):**
```
  (1)-----(2)-----(3)-----(4)-----(5)
 Upload   Map   Preview  Import  Done
```
Active step filled with primary color, completed steps filled with green checkmark, pending steps are outline only.

### Step 5: Step 1 — Upload
**Inside ImportWizardDialog**

**UI:**
- Dropzone area: dashed border, centered icon (Upload), text "Drop a CSV file here or click to browse"
- Accept only `.csv` files: `<input type="file" accept=".csv">`
- On file drop/select: parse with `parseCsvFile()`, store result in state
- Show file name + row count after parsing: "contacts.csv - 156 rows found"
- If parsing has errors, show warning: "{n} parsing errors found" with expandable details
- "Next" button enabled only when `parseResult` is populated with `rowCount > 0`

**Drag-and-drop:** Use the native HTML drag-and-drop API (no library needed):
- `onDragOver` / `onDragEnter` → set a `isDragging` state to true for visual feedback (border color change)
- `onDragLeave` → set isDragging to false
- `onDrop` → extract `e.dataTransfer.files[0]`, validate it's a CSV, parse it

### Step 6: Step 2 — Map Columns
**Inside ImportWizardDialog**

**UI:**
- Table with two columns: "CSV Column" and "Maps To"
- Each CSV header gets a row
- "Maps To" is a `Select` dropdown with options:
  - "(Skip)" — null mapping
  - All `CONTACT_IMPORT_FIELDS` entries as options, grouped: Required fields first, Optional fields second
- Auto-mapping runs on mount: `useEffect` calls `autoMapColumns(parseResult.headers)` and sets `columnMapping`
- Auto-mapped columns show a small "auto-detected" badge next to the select
- User can change any mapping manually
- **Validation:** "Next" button disabled if `firstName` is not mapped (it's required). Show inline warning: "First Name must be mapped to continue."
- Also show warning if `type` is not mapped: "Type must be mapped. Unmapped rows will default to 'lead'."

**Visual:**
```
CSV Column          Maps To
─────────────────────────────────────
"First Name"     →  [First Name ▾]  ✓ auto
"Last Name"      →  [Last Name ▾]   ✓ auto
"Email Address"  →  [Email ▾]       ✓ auto
"Company"        →  [(Skip) ▾]
"Phone #"        →  [Phone ▾]       ✓ auto
```

### Step 7: Step 3 — Preview
**Inside ImportWizardDialog**

**UI:**
- Show the first 5 rows after transformation, in a preview table
- Columns are the mapped target fields only (skipped columns are hidden)
- Each row is validated against `createContactSchema`:
  - Valid rows get a green checkmark
  - Invalid rows get a red X with the validation error shown as a tooltip or inline text
- Summary above the table: "5 of 156 rows previewed. {n} valid, {m} with issues."
- **Type defaulting:** If `type` is not mapped or the value doesn't match an enum, default to "lead". Show a note: "Rows without a valid type will default to 'lead'."
- **Status defaulting:** If `status` is not mapped, default to "prospect" (matches schema default).

**Validation function:**
```ts
function validateRows(rows: Record<string, string>[], mapping: Record<string, string | null>) {
  return rows.map((csvRow, index) => {
    const transformed = transformRow(csvRow, mapping);
    // Apply defaults
    if (!transformed.type || !["creator", "lead", "enterprise_prospect", "partner"].includes(transformed.type)) {
      transformed.type = "lead";
    }
    const result = createContactSchema.safeParse(transformed);
    return {
      index,
      data: transformed,
      valid: result.success,
      errors: result.success ? [] : result.error.issues.map(i => i.message),
    };
  });
}
```

Run validation on all rows (not just preview) to show accurate total counts. Display only first 5 in the table.

### Step 8: Step 4 — Import
**Inside ImportWizardDialog**

**UI:**
- Show a progress bar and status text: "Importing... {current} of {total}"
- "Import" button on the previous step triggers the import. This step is non-interactive (no user action needed).
- Cancel button available: aborts the import (sets a `cancelled` ref that the loop checks).

**Import strategy — batched requests:**

The current API sends all rows in one request. This does not support progress tracking. Change to batched approach:

1. Split validated rows into batches of 50
2. For each batch, send `PATCH /api/bulk` with `action: "import_contacts"` and `contacts: batch`
3. On each batch response, increment progress counter
4. Accumulate results across batches: `{ created, errors }`

**Implementation:**
```ts
async function runImport(
  rows: Record<string, string>[],
  mapping: Record<string, string | null>,
  onProgress: (current: number, total: number) => void
) {
  const transformedRows = rows.map(row => {
    const t = transformRow(row, mapping);
    if (!t.type || !["creator", "lead", "enterprise_prospect", "partner"].includes(t.type)) {
      t.type = "lead";
    }
    return t;
  });

  // Filter out invalid rows
  const validRows = transformedRows.filter(row => createContactSchema.safeParse(row).success);
  const skipped = transformedRows.length - validRows.length;

  const batchSize = 50;
  let created = 0;
  let errors = 0;
  const errorDetails: { row: number; message: string }[] = [];

  for (let i = 0; i < validRows.length; i += batchSize) {
    const batch = validRows.slice(i, i + batchSize);
    const res = await fetch("/api/bulk", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "import_contacts", contacts: batch }),
    });
    const result = await res.json();
    created += result.created ?? 0;
    errors += result.errors ?? 0;
    onProgress(Math.min(i + batchSize, validRows.length), validRows.length);
  }

  return { created, skipped, errors, errorDetails };
}
```

**Progress bar:** Use shadcn/ui `Progress` component if available. If not, a simple `<div>` with `width: {percent}%` and transition.

Check if `src/components/ui/progress.tsx` exists. If not, run `npx shadcn@latest add progress`.

### Step 9: Step 5 — Summary
**Inside ImportWizardDialog**

**UI:**
- Summary card showing:
  - Total rows processed: {total}
  - Successfully created: {created} (green checkmark icon)
  - Skipped (validation errors): {skipped} (yellow warning icon)
  - Failed (server errors): {errors} (red X icon)
- If errors > 0, show expandable list of error details
- "Done" button closes the dialog and invalidates the contacts query to refresh the list

**On close:** Reset all wizard state back to step 1 with empty values (so the dialog is clean if opened again).

### Step 10: Add "Import" button to contacts page
**File:** `src/app/(dashboard)/contacts/page.tsx` (edit)

**Changes:**

1. Import `ImportWizardDialog` from `@/components/import/import-wizard-dialog`
2. Add state: `const [importOpen, setImportOpen] = useState(false);`
3. Add "Import" button next to the existing "Export" button in the header:
   ```tsx
   <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
     <Upload className="mr-2 h-4 w-4" />
     Import
   </Button>
   ```
4. Add `Upload` to the lucide-react imports
5. Render the dialog:
   ```tsx
   <ImportWizardDialog open={importOpen} onOpenChange={setImportOpen} />
   ```

### Step 11: Enhance bulk import API for better error reporting
**File:** `src/app/api/bulk/route.ts` (edit)

Update the `import_contacts` handler to return more detailed results:

```ts
if (body.action === "import_contacts" && body.contacts) {
  const results = { created: 0, errors: 0, errorDetails: [] as { index: number; message: string }[] };
  for (let i = 0; i < body.contacts.length; i++) {
    try {
      const parsed = createContactSchema.safeParse(body.contacts[i]);
      if (!parsed.success) {
        results.errors++;
        results.errorDetails.push({
          index: i,
          message: parsed.error.issues.map(i => i.message).join(", "),
        });
        continue;
      }
      await createContact(parsed.data);
      results.created++;
    } catch (e) {
      results.errors++;
      results.errorDetails.push({
        index: i,
        message: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  await logAuditEvent(user.id, {
    action: "csv_import",
    entityType: "contact",
    entityId: "bulk",
    metadata: { created: results.created, errors: results.errors },
  });

  return NextResponse.json(results);
}
```

Add `createContactSchema` import at the top of the file.

**Also add:** Server-side validation of each row against `createContactSchema` before calling `createContact()`. The current implementation trusts the client data — with the Zod parse, bad rows are caught before hitting the DB.

---

## Requirement Traceability

| Requirement | Description | Covered By |
|-------------|-------------|------------|
| BULK-05 | CSV import dialog with file upload, column mapping preview, and confirm | Steps 4-10 (full wizard) |
| IMPT-01 | Import wizard: Step 1 - Upload CSV file | Step 5 (dropzone + file parsing) |
| IMPT-02 | Import wizard: Step 2 - Map columns with auto-detect | Steps 3, 6 (mapping logic + UI) |
| IMPT-03 | Import wizard: Step 3 - Preview first 5 rows | Step 7 (preview table + validation) |
| IMPT-04 | Import wizard: Step 4 - Import with progress bar | Step 8 (batched import + progress) |
| IMPT-05 | Import wizard: Step 5 - Summary | Step 9 (results summary) |

**Note:** IMPT-01..05 are Phase 12 requirements but are fully covered by this plan. Phase 12 can skip these requirements or mark them as completed by Phase 9b.

---

## Risks & Decisions

### Client-side parsing vs. server-side
CSV files are parsed entirely on the client (in the browser) using papaparse. This means:
- **Pro:** No file upload to the server until the user confirms the import. Faster preview. No temporary file storage needed.
- **Pro:** Column mapping and preview happen instantly without network round-trips.
- **Con:** Very large files (100k+ rows) may cause browser memory pressure. Mitigation: papaparse streams files efficiently and we only hold the parsed rows in memory.
- **Decision:** Client-side parsing is the right call for an internal CRM where files are typically under 10k rows.

### Batch size for import
Batches of 50 rows per request. Trade-offs:
- Smaller batches (10) = more requests = better progress granularity but slower total import due to HTTP overhead
- Larger batches (200) = fewer requests = faster but coarser progress and larger request bodies
- 50 is a good balance for internal tool use cases (most imports are under 1000 rows)

### Duplicate detection
This plan does NOT implement duplicate detection (e.g., skip contacts with matching email). Each imported row creates a new contact. Reasons:
- The contacts table does not have a unique constraint on email (email is optional and nullable)
- Duplicate detection rules vary (match on email? on name? on whopUsername?)
- This is better handled as a future enhancement with configurable merge/skip rules
- The user can use filters after import to identify duplicates

### Type and status defaulting
If the CSV does not include a `type` column or contains invalid values, the import defaults to `type: "lead"`. If `status` is missing, it defaults to `"prospect"` (the schema default). This is documented in the preview step so the user knows what to expect. The alternative (rejecting rows without valid type) would make imports harder for basic CSVs that only have name + email.

### Source field
All imported contacts get `source: "import"` set automatically. This is not exposed in the mapping UI — it is hardcoded during transformation. This makes it easy to filter/identify imported contacts later.

### papaparse dependency
Papaparse is a well-maintained, zero-dependency library (300KB unpacked, ~50KB in bundle). It handles CSV edge cases that would be tedious to implement manually: quoted fields with embedded commas, Windows line endings, BOM characters, different delimiters. The type definitions come from DefinitelyTyped (`@types/papaparse`).

### Dialog size
The import wizard dialog uses `sm:max-w-2xl` (672px) to give enough room for the mapping table and preview table. On mobile, it takes full width. The dialog is scrollable if content exceeds viewport height.

### Step navigation
Users can go back to previous steps (Back button) but this does NOT re-run the import. Going back from Step 5 (Summary) is not allowed — the import is complete. Going back from Step 4 while import is running cancels the import. Going back from Step 3 to Step 2 preserves the column mapping. Going back from Step 2 to Step 1 clears everything (new file upload replaces old data).

---

## Verification

After implementation:
1. `npm run build` passes with no errors
2. Navigate to Contacts page
3. "Import" button visible next to "Export" button
4. Click "Import" — wizard dialog opens at Step 1
5. Drop or select a CSV file — parsing happens, row count shown
6. Click "Next" — Step 2 shows CSV columns mapped to contact fields, auto-detected where possible
7. Change a mapping manually — select updates
8. Ensure "First Name" is mapped (required). If not, "Next" is disabled with warning.
9. Click "Next" — Step 3 shows first 5 rows as preview with valid/invalid indicators
10. Summary counts show total valid vs. issues
11. Click "Import" — Step 4 shows progress bar advancing in batches
12. Import completes — Step 5 shows summary: created, skipped, errors
13. Click "Done" — dialog closes, contacts list refreshes with newly imported contacts
14. Test with a CSV that has some invalid rows (missing firstName) — verify they are counted as skipped/errors in summary
15. Test with a CSV with different column names — verify auto-mapping and manual override work
16. No console errors throughout
