# Phase 10c: Custom Field Options Editor

**Requirements:** CFLD-01, CFLD-02, CFLD-03, CFLD-04
**Scope:** Add an options editor to the custom field creation/edit flow for select and multi_select types, render select-type fields as dropdowns on entity detail pages, and add multi_select to the type selector in settings.
**Wave:** 1 (no dependencies outside existing codebase)
**Depends on:** None (custom fields backend, settings UI, and entity detail pages all exist)

---

## Current State Assessment

### What exists:
- **Schema** (`src/lib/db/schema.ts`):
  - `fieldTypeEnum` includes both `"select"` and `"multi_select"`.
  - `customFieldDefinitions.options` is `jsonb` typed as `{ value: string; label: string; color?: string }[]` -- the column exists and accepts option data.
  - `customFieldValues.textValue` stores the selected value(s) as text. For multi_select, comma-separated or JSON array storage is needed (decision below).

- **DAL** (`src/lib/api/custom-fields.ts`):
  - `createFieldDefinition()` accepts `options` in input and passes it through to the insert.
  - `updateFieldDefinition()` accepts partial input including `options`.
  - `getFieldValues()` returns `options` from the joined definition alongside the value.
  - `setFieldValue()` stores values in `textValue`, `numberValue`, `dateValue`, or `booleanValue`.

- **API** (`src/app/api/custom-fields/route.ts`, `[id]/route.ts`):
  - POST creates field definitions (passes through `options` if included in body).
  - POST also sets field values (via `fieldDefinitionId` + `entityId` path).
  - DELETE removes field definitions.
  - No PATCH for field definitions exists (no `[id]/route.ts` PATCH handler). Need to check.

- **Hooks** (`src/lib/hooks/use-custom-fields.ts`):
  - `useCreateFieldDefinition()` accepts `options` in the mutation input.
  - `useSetFieldValue()` sets values.
  - No `useUpdateFieldDefinition()` hook exists.

- **Settings UI** (`src/app/(dashboard)/settings/page.tsx` -- `CustomFieldsSettings` component):
  - Create dialog has field type selector with options: text, number, date, boolean, url, email, currency, select.
  - **`multi_select` is missing from the selector** (CFLD-04).
  - **No options editor appears when `select` is chosen** -- the field is created without options.
  - Table shows field list with label, name, type, required, visible columns + delete button.
  - No edit button exists for field definitions (only create + delete).

- **Entity detail pages** (contact, deal, company):
  - Custom fields are rendered via a `CustomFieldsSection` component (need to verify).
  - For `select` type fields, the current rendering likely shows the raw text value rather than a dropdown. Need to check.

### What needs to be built:
1. Options editor component for defining select/multi_select option values during field creation
2. Add `multi_select` to the field type selector in settings
3. Wire options data through the create field flow
4. Render select fields as dropdowns on entity detail pages
5. Render multi_select fields as multi-select on entity detail pages
6. Update field definition API to support PATCH (for editing options on existing fields)

---

## Pre-Implementation: Verify Entity Detail Custom Fields Rendering

Before building, verify how custom fields currently render on entity detail pages.

**Check these files:**
- `src/components/custom-fields/custom-fields-section.tsx` (or similar)
- Contact detail page for custom fields rendering
- Deal detail page for custom fields rendering

The implementation steps below assume a `CustomFieldsSection` component exists that renders field values. If it renders select values as plain text, it needs to be updated to render as a dropdown.

---

## Implementation Steps

### Step 1: Create OptionsEditor component
**File:** `src/components/custom-fields/options-editor.tsx` (new)

A reusable component for adding/removing options during field creation or editing.

**Props:**
```ts
interface OptionsEditorProps {
  options: { value: string; label: string; color?: string }[];
  onChange: (options: { value: string; label: string; color?: string }[]) => void;
}
```

**UI layout:**
```
Options
┌─────────────────────────────────────────────┐
│  [● Red    ] Option 1                    [X] │
│  [● Blue   ] Option 2                    [X] │
│  [● Green  ] Option 3                    [X] │
│                                              │
│  [____________] [Add]                        │
└─────────────────────────────────────────────┘
```

**Implementation:**
```tsx
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
            <div key={option.value} className="flex items-center gap-2 rounded border px-2 py-1">
              <span className="text-sm flex-1">{option.label}</span>
              <span className="text-xs text-muted-foreground">{option.value}</span>
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
        <Button type="button" variant="outline" size="sm" onClick={handleAdd} disabled={!newOption.trim()}>
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
```

**Behavior:**
- Options list shows each option with label, value (derived), and remove button.
- Input + Add button at the bottom. Enter key also adds.
- Value is auto-derived from label (lowercase + underscores). This matches the existing pattern in `CustomFieldsSettings` where `name` is derived from `label`.
- Duplicate values are silently prevented.
- The component is controlled: parent manages the options array via `onChange`.

### Step 2: Add multi_select to type selector and wire options editor
**File:** `src/app/(dashboard)/settings/page.tsx` (edit -- `CustomFieldsSettings` component)

**Changes:**

1. **Add `multi_select` to the field type selector:**

In the create field dialog, update the field type `<Select>`:
```tsx
<SelectItem value="select">Select</SelectItem>
<SelectItem value="multi_select">Multi-Select</SelectItem>
```

2. **Add options state:**
```ts
const [newOptions, setNewOptions] = useState<{ value: string; label: string; color?: string }[]>([]);
```

3. **Conditionally render OptionsEditor when type is select or multi_select:**

After the field type selector in the create dialog form:
```tsx
{(newFieldType === "select" || newFieldType === "multi_select") && (
  <OptionsEditor options={newOptions} onChange={setNewOptions} />
)}
```

4. **Pass options in the create mutation:**

Update `handleCreate`:
```ts
function handleCreate(e: React.FormEvent) {
  e.preventDefault();
  if (!newLabel.trim()) return;
  const isSelectType = newFieldType === "select" || newFieldType === "multi_select";
  if (isSelectType && newOptions.length === 0) {
    toast.error("Add at least one option for select fields");
    return;
  }
  const name = newLabel.trim().toLowerCase().replace(/\s+/g, "_");
  createField.mutate(
    {
      entityType: entityFilter,
      name,
      label: newLabel.trim(),
      fieldType: newFieldType,
      ...(isSelectType && { options: newOptions }),
    },
    {
      onSuccess: () => {
        toast.success("Field created");
        setCreateOpen(false);
        setNewLabel("");
        setNewFieldType("text");
        setNewOptions([]);
      },
      onError: () => toast.error("Failed to create field"),
    }
  );
}
```

5. **Reset options when type changes to non-select:**

The options state should clear when switching away from select types. Add this logic either in the type `onValueChange` or accept that stale options state is harmless (it won't be sent if the type is not select). The latter is simpler -- the `...(isSelectType && { options })` spread handles it.

6. **Reset options when dialog closes:**

In the existing `onSuccess` callback, add `setNewOptions([])`. Also reset when dialog is closed via the `onOpenChange`:
```tsx
<Dialog open={createOpen} onOpenChange={(open) => {
  setCreateOpen(open);
  if (!open) {
    setNewLabel("");
    setNewFieldType("text");
    setNewOptions([]);
  }
}}>
```

7. **Import OptionsEditor:**
```ts
import { OptionsEditor } from "@/components/custom-fields/options-editor";
```

### Step 3: Render select fields as dropdown on entity detail pages
**File:** Check and edit the custom fields display component.

First, identify how custom fields are currently rendered on entity detail pages. The likely component is `src/components/custom-fields/custom-fields-section.tsx` or similar. If it renders all field types as plain text inputs, update the rendering for `select` and `multi_select` types.

**For `select` type fields:**

Replace the text input with a `<Select>` dropdown populated from the field definition's `options` array:

```tsx
case "select": {
  const options = fieldDef.options ?? [];
  return (
    <Select
      value={currentValue ?? ""}
      onValueChange={(val) => handleSetValue(fieldDef.id, entityId, { textValue: val })}
    >
      <SelectTrigger>
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
```

**For `multi_select` type fields:**

Multi-select is more complex. Two rendering approaches:
1. **Checkbox list** inside a Popover -- each option has a checkbox. Selected values stored as JSON array string in `textValue`.
2. **Combobox with multi-select** -- uses the Command component with checkmarks.

**Chosen: Checkbox list in a Popover.** This is simpler and avoids the complexity of a full combobox.

```tsx
case "multi_select": {
  const options = fieldDef.options ?? [];
  const selectedValues: string[] = currentValue ? JSON.parse(currentValue) : [];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="justify-start text-sm font-normal w-full">
          {selectedValues.length > 0
            ? selectedValues.map((v) => options.find((o) => o.value === v)?.label ?? v).join(", ")
            : "Select..."}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-2">
        {options.map((opt) => (
          <label key={opt.value} className="flex items-center gap-2 px-2 py-1 hover:bg-muted rounded cursor-pointer">
            <Checkbox
              checked={selectedValues.includes(opt.value)}
              onCheckedChange={(checked) => {
                const next = checked
                  ? [...selectedValues, opt.value]
                  : selectedValues.filter((v) => v !== opt.value);
                handleSetValue(fieldDef.id, entityId, { textValue: JSON.stringify(next) });
              }}
            />
            <span className="text-sm">{opt.label}</span>
          </label>
        ))}
      </PopoverContent>
    </Popover>
  );
}
```

**Storage format for multi_select:** JSON array string in `textValue`, e.g., `'["option1","option2"]'`. This keeps the EAV pattern simple -- no additional columns needed. The `textValue` column stores the serialized array.

**If no `CustomFieldsSection` component exists:** Create one as a shared component that handles rendering field definitions + values for any entity. It would:
1. Fetch field definitions for the entity type
2. Fetch field values for the specific entity ID
3. Render each field with appropriate input based on `fieldType`
4. Handle value changes via `useSetFieldValue`

This component would be used on contact detail, deal detail, and company detail pages.

### Step 4: Update the custom fields API to pass options through on creation

**File:** `src/app/api/custom-fields/route.ts` (edit -- verify)

The POST handler already passes the full `body` through to `createFieldDefinition()`. Verify that `body.options` is included. Looking at the current code:

```ts
if (body.name && body.label && body.fieldType && body.entityType) {
  const field = await createFieldDefinition(body);
  return NextResponse.json(field, { status: 201 });
}
```

This passes the entire `body` object, which includes `options` if provided. The DAL `createFieldDefinition` accepts `options` in its input type. **No change needed here** -- the API already supports options passthrough.

**Verify the DAL:**

The `createFieldDefinition` input type already includes `options?: { value: string; label: string; color?: string }[]`. The insert uses `...input` spread, which includes options. **No change needed.**

### Step 5: Add PATCH endpoint for field definitions (for editing options later)
**File:** `src/app/api/custom-fields/[id]/route.ts` (edit)

Check if PATCH exists. Looking at the file listing, the `[id]` route exists but let me verify if PATCH is implemented. If only DELETE exists, add PATCH.

**Add PATCH handler if missing:**

```ts
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser();
    const { id } = await params;
    const body = await request.json();
    const field = await updateFieldDefinition(id, body);
    if (!field) {
      return NextResponse.json({ error: "Field not found" }, { status: 404 });
    }
    return NextResponse.json(field);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Add `useUpdateFieldDefinition` hook** in `src/lib/hooks/use-custom-fields.ts`:
```ts
export function useUpdateFieldDefinition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<{ label: string; options: { value: string; label: string; color?: string }[]; isRequired: boolean; isVisibleInList: boolean }> }) => {
      const res = await fetch(`/api/custom-fields/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update field");
      return res.json();
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["custom-fields", "definitions"] }),
  });
}
```

**Note:** The PATCH endpoint enables future editing of field definitions (including options), but the settings UI for editing existing fields is not in the current requirements. The endpoint is added now because CFLD-01 says "creating/editing a custom field" -- the editing path needs the API support.

### Step 6: Wire the custom fields section on entity detail pages

Verify that the custom fields section on entity detail pages uses `getFieldValues` which returns `options` from the joined definition. The `getFieldValues` query in `src/lib/api/custom-fields.ts` already selects `options: customFieldDefinitions.options`. This means the options data is available on the client for rendering dropdowns.

If a `CustomFieldsSection` component exists, update its rendering switch/case for `select` and `multi_select` types (Step 3 logic).

If no such component exists, create `src/components/custom-fields/custom-fields-section.tsx`:

```tsx
"use client";

import { useFieldDefinitions, useFieldValues, useSetFieldValue } from "@/lib/hooks/use-custom-fields";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface CustomFieldsSectionProps {
  entityType: "contact" | "deal" | "company";
  entityId: string;
}

export function CustomFieldsSection({ entityType, entityId }: CustomFieldsSectionProps) {
  const { data: definitions, isLoading: defsLoading } = useFieldDefinitions(entityType);
  const { data: values, isLoading: valsLoading } = useFieldValues(entityId);
  const setFieldValue = useSetFieldValue();

  if (defsLoading || valsLoading) return <Skeleton className="h-24 w-full" />;
  if (!definitions || definitions.length === 0) return null;

  function getValueForField(fieldDefId: string) {
    const val = values?.find((v: { fieldDefinitionId: string }) => v.fieldDefinitionId === fieldDefId);
    return val;
  }

  function handleChange(fieldDefId: string, value: Record<string, unknown>) {
    setFieldValue.mutate({
      fieldDefinitionId: fieldDefId,
      entityId,
      ...value,
    });
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">Custom Fields</h3>
      {definitions.map((def: {
        id: string; label: string; fieldType: string;
        options: { value: string; label: string; color?: string }[] | null;
      }) => {
        const val = getValueForField(def.id);
        return (
          <div key={def.id} className="space-y-1">
            <label className="text-sm text-muted-foreground">{def.label}</label>
            {renderField(def, val, entityId, handleChange)}
          </div>
        );
      })}
    </div>
  );
}
```

The `renderField` function handles each type with a switch:
- `text`, `url`, `email`: `<Input>` with appropriate type, onChange calls `handleChange` with `{ textValue }`
- `number`, `currency`: `<Input type="number">`, onChange calls `handleChange` with `{ numberValue }`
- `boolean`: `<Checkbox>`, onCheckedChange calls `handleChange` with `{ booleanValue }`
- `date`: `<Input type="date">`, onChange calls `handleChange` with `{ dateValue }`
- `select`: `<Select>` with options from definition (Step 3 logic)
- `multi_select`: Popover with checkbox list (Step 3 logic)

---

## Requirement Traceability

| Requirement | Description | Covered By |
|-------------|-------------|------------|
| CFLD-01 | When creating/editing a custom field with type select or multi_select, user can define option values | Steps 1-2 (OptionsEditor + wired into create dialog). Step 5 (PATCH API for editing). |
| CFLD-02 | Options editor shows list of values with add/remove capability | Step 1 (OptionsEditor component with add input, option list, remove buttons) |
| CFLD-03 | Select-type custom fields render as dropdown with defined options on entity detail pages | Steps 3, 6 (select renders as `<Select>` dropdown, multi_select as checkbox popover) |
| CFLD-04 | Multi-select type is available in the settings UI (currently excluded) | Step 2 (add `<SelectItem value="multi_select">Multi-Select</SelectItem>` to type selector) |

---

## Risks & Decisions

### Multi-select value storage format
**Decision: JSON array string in `textValue`.** Multi-select values are stored as `'["val1","val2"]'` in the `textValue` column. This avoids schema changes (no new junction table for custom field multi-values) and works with the existing EAV pattern. The trade-off is that querying "all entities where custom field X includes value Y" requires `textValue LIKE '%"Y"%'` or JSON operations, which is less efficient than a normalized table. For an internal CRM with moderate data volumes, this is acceptable. If query performance becomes an issue, a `custom_field_multi_values` junction table can be added later.

### Options validation
**Decision: Client-side only for now.** When a user sets a select field value, the value is sent to the API without validating it against the field definition's options. A user could technically set an invalid value via direct API call. For an internal tool, this is acceptable. Adding server-side validation would require fetching the field definition on every value set, adding latency and complexity. If needed, add validation in `setFieldValue` DAL function later.

### No edit UI for existing field definitions
The requirements say "creating/editing" (CFLD-01) but the current settings UI has no edit button for existing fields -- only create and delete. Adding a full edit dialog is out of scope for this phase. The PATCH API (Step 5) provides the backend support. A future enhancement can add an edit button to each field row in the settings table that opens a dialog with the OptionsEditor pre-populated with existing options.

### CustomFieldsSection component
If this component already exists in the codebase, Step 6 becomes an edit rather than a creation. The plan accounts for both cases. The rendering logic for select/multi_select is the same regardless.

### OptionsEditor color support
The schema supports `color` on each option, but the initial OptionsEditor does not expose a color picker. This keeps the first implementation simple. Color support can be added later (a small color dot + picker for each option row). The data structure already supports it -- adding UI is incremental.

---

## Verification

After implementation:
1. `npm run build` passes with no errors
2. Navigate to Settings > Custom Fields
3. Click "Add Field"
4. Select type "Select" -- the OptionsEditor appears below
5. Type "Option A" and click Add (or press Enter) -- option appears in the list
6. Type "Option B" and add -- second option appears
7. Click X on "Option A" -- removed from list
8. Select type "Multi-Select" -- OptionsEditor still visible (both select types show it)
9. Switch to type "Text" -- OptionsEditor disappears
10. Switch back to "Select", add options, fill in label, click Create -- field created with options
11. In the fields table, the new field shows type "select"
12. Navigate to a contact detail page (or deal/company depending on entity type chosen)
13. The custom field appears with a dropdown selector
14. Select an option -- value saves, toast or visual feedback confirms
15. Create a multi_select field with options
16. On entity detail, the multi_select field shows as a button that opens a popover with checkboxes
17. Check multiple options -- values save as JSON array in textValue
18. Reload the page -- selected values persist
19. No console errors throughout all interactions
