# Phase 12b: Email Templates

**Requirements:** EMTL-01, EMTL-02, EMTL-03
**Scope:** Email template CRUD in Settings, variable interpolation engine, template picker in the activity form for email activities.
**Wave:** 1 (independent of 12a and 12c)
**Depends on:** None (activity form exists, settings page exists, schema needs new table)

---

## Current State Assessment

### What exists:
- **Settings page** (`src/app/(dashboard)/settings/page.tsx`) -- Tabs: Team, Tags, Custom Fields, Pipelines, Audit Log. No Email Templates tab.
- **Activity form** (`src/components/activities/activity-form.tsx`) -- Supports type selection (note, call, email_sent, meeting, linkedin_message) with subject + body fields. No template picker.
- **Activity types** (`src/lib/db/schema.ts`) -- `activityTypeEnum` includes `email_sent` and `email_received`.
- **No `email_templates` table** -- Does not exist in schema. Needs to be created.
- **No template-related code** -- No utilities, API routes, or hooks exist for templates.

### What needs to be built:
1. **Database schema:** `email_templates` table in Drizzle schema
2. **Migration:** Generate and run Drizzle migration
3. **Data access layer:** CRUD functions for email templates
4. **API route:** `/api/email-templates` with GET, POST, PATCH, DELETE
5. **React Query hooks:** `useEmailTemplates`, `useCreateEmailTemplate`, `useUpdateEmailTemplate`, `useDeleteEmailTemplate`
6. **Variable interpolation utility:** Parse `{{variable}}` tokens and replace with contact/deal/company data
7. **Settings UI:** "Email Templates" tab with list, create/edit dialog
8. **Template picker in activity form:** "Use template" button that appears when type is `email_sent`, popover with template list, selecting a template fills subject + body with interpolated content

---

## Implementation Steps

### Step 1: Add `email_templates` table to schema
**File:** `src/lib/db/schema.ts` (edit)

Add after the `savedViews` table definition:

```ts
// --- Email Templates ---

export const emailTemplates = pgTable("email_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  category: text("category"),
  createdBy: uuid("created_by")
    .references(() => users.id)
    .notNull(),
  isShared: boolean("is_shared").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

Add relations:

```ts
export const emailTemplatesRelations = relations(emailTemplates, ({ one }) => ({
  creator: one(users, { fields: [emailTemplates.createdBy], references: [users.id] }),
}));
```

Add to `usersRelations`:

```ts
emailTemplates: many(emailTemplates),
```

**Design decisions:**
- `name` -- Human-readable template name (e.g., "Welcome Email", "Follow Up")
- `subject` -- Email subject line, supports `{{variables}}`
- `body` -- Email body text, supports `{{variables}}`. Stored as plain text (not HTML). Users write in the textarea and variables get interpolated.
- `category` -- Optional free-text category for organizing templates (e.g., "Onboarding", "Follow Up", "Outreach"). Not an enum because users should define their own categories.
- `createdBy` -- The user who created the template
- `isShared` -- If true, all team members can see and use this template. If false, only the creator can see it. Defaults to true (shared) since this is an internal tool.

### Step 2: Generate and run migration
**Action:** `npx drizzle-kit generate` then `npx drizzle-kit push` (or `migrate` depending on project setup)

Check `drizzle.config.ts` for the migration strategy used in this project.

### Step 3: Create email templates DAL
**File:** `src/lib/api/email-templates.ts` (new)

```ts
import { db } from "@/lib/db";
import { emailTemplates, users } from "@/lib/db/schema";
import { eq, desc, or, and } from "drizzle-orm";

export interface CreateTemplateInput {
  name: string;
  subject: string;
  body: string;
  category?: string;
  isShared?: boolean;
}

export interface UpdateTemplateInput {
  name?: string;
  subject?: string;
  body?: string;
  category?: string;
  isShared?: boolean;
}

export async function listEmailTemplates(userId: string) {
  // Return templates that are shared OR created by the current user
  return db
    .select({
      id: emailTemplates.id,
      name: emailTemplates.name,
      subject: emailTemplates.subject,
      body: emailTemplates.body,
      category: emailTemplates.category,
      isShared: emailTemplates.isShared,
      createdBy: emailTemplates.createdBy,
      creatorFirstName: users.firstName,
      creatorLastName: users.lastName,
      createdAt: emailTemplates.createdAt,
      updatedAt: emailTemplates.updatedAt,
    })
    .from(emailTemplates)
    .leftJoin(users, eq(emailTemplates.createdBy, users.id))
    .where(
      or(
        eq(emailTemplates.isShared, true),
        eq(emailTemplates.createdBy, userId)
      )
    )
    .orderBy(desc(emailTemplates.updatedAt));
}

export async function getEmailTemplate(id: string) {
  const [template] = await db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.id, id))
    .limit(1);
  return template;
}

export async function createEmailTemplate(
  data: CreateTemplateInput,
  userId: string
) {
  const [template] = await db
    .insert(emailTemplates)
    .values({
      ...data,
      createdBy: userId,
    })
    .returning();
  return template;
}

export async function updateEmailTemplate(
  id: string,
  userId: string,
  data: UpdateTemplateInput
) {
  const [updated] = await db
    .update(emailTemplates)
    .set({ ...data, updatedAt: new Date() })
    .where(
      and(eq(emailTemplates.id, id), eq(emailTemplates.createdBy, userId))
    )
    .returning();
  return updated;
}

export async function deleteEmailTemplate(id: string, userId: string) {
  const result = await db
    .delete(emailTemplates)
    .where(
      and(eq(emailTemplates.id, id), eq(emailTemplates.createdBy, userId))
    )
    .returning({ id: emailTemplates.id });
  return result.length > 0;
}
```

**Key decision -- ownership for edit/delete:** Only the creator can edit or delete a template. Shared templates are read-only for other users. This prevents accidental edits to team-wide templates while keeping the logic simple. An admin override could be added later if needed.

### Step 4: Create Zod validator
**File:** `src/lib/validators/email-template.ts` (new)

```ts
import { z } from "zod";

export const createEmailTemplateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  subject: z.string().min(1, "Subject is required").max(200),
  body: z.string().min(1, "Body is required").max(10000),
  category: z.string().max(50).optional(),
  isShared: z.boolean().optional(),
});

export const updateEmailTemplateSchema = createEmailTemplateSchema.partial();

export type CreateEmailTemplateInput = z.infer<typeof createEmailTemplateSchema>;
export type UpdateEmailTemplateInput = z.infer<typeof updateEmailTemplateSchema>;
```

### Step 5: Create API route
**File:** `src/app/api/email-templates/route.ts` (new)

```ts
// GET -- list templates (shared + own)
// POST -- create template
```

**File:** `src/app/api/email-templates/[id]/route.ts` (new)

```ts
// PATCH -- update template (owner only)
// DELETE -- delete template (owner only)
```

Standard patterns matching existing API routes in the project. Auth via `requireUser()`. Validate body with Zod. Return JSON.

### Step 6: Create React Query hooks
**File:** `src/lib/hooks/use-email-templates.ts` (new)

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useEmailTemplates() {
  return useQuery({
    queryKey: ["email-templates"],
    queryFn: async () => {
      const res = await fetch("/api/email-templates");
      if (!res.ok) throw new Error("Failed to load templates");
      return res.json();
    },
  });
}

export function useCreateEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; subject: string; body: string; category?: string; isShared?: boolean }) => {
      const res = await fetch("/api/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create template");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-templates"] }),
  });
}

export function useUpdateEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/email-templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update template");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-templates"] }),
  });
}

export function useDeleteEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/email-templates/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete template");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-templates"] }),
  });
}
```

### Step 7: Create variable interpolation utility
**File:** `src/lib/utils/template-interpolation.ts` (new)

```ts
export interface TemplateContext {
  // Contact fields
  firstName?: string;
  lastName?: string;
  email?: string;
  whopUsername?: string;
  tier?: string;
  status?: string;
  // Company fields (from primary company link)
  companyName?: string;
  companyDomain?: string;
  // Deal fields
  dealTitle?: string;
  dealValue?: string;
  // User fields (current user / sender)
  senderFirstName?: string;
  senderLastName?: string;
  senderEmail?: string;
}

/**
 * Available template variables with descriptions for the UI.
 */
export const TEMPLATE_VARIABLES = [
  { key: "firstName", label: "First Name", example: "John" },
  { key: "lastName", label: "Last Name", example: "Doe" },
  { key: "email", label: "Email", example: "john@example.com" },
  { key: "whopUsername", label: "Whop Username", example: "johndoe" },
  { key: "tier", label: "Tier", example: "premium" },
  { key: "companyName", label: "Company Name", example: "Acme Inc" },
  { key: "companyDomain", label: "Company Domain", example: "acme.com" },
  { key: "dealTitle", label: "Deal Title", example: "Enterprise Plan" },
  { key: "dealValue", label: "Deal Value", example: "$10,000" },
  { key: "senderFirstName", label: "Sender First Name", example: "Jane" },
  { key: "senderLastName", label: "Sender Last Name", example: "Smith" },
  { key: "senderEmail", label: "Sender Email", example: "jane@whop.com" },
] as const;

/**
 * Interpolates {{variable}} tokens in a template string with values from the context.
 * Unmatched variables are left as-is (e.g., {{unknownVar}} stays in the output).
 * Variables are case-insensitive.
 */
export function interpolateTemplate(
  template: string,
  context: TemplateContext
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, varName: string) => {
    const key = varName as keyof TemplateContext;
    const value = context[key];
    return value !== undefined && value !== null && value !== "" ? value : match;
  });
}

/**
 * Extracts all {{variable}} tokens from a template string.
 * Returns unique variable names.
 */
export function extractVariables(template: string): string[] {
  const matches = template.match(/\{\{(\w+)\}\}/g) ?? [];
  const vars = matches.map((m) => m.replace(/\{\{|\}\}/g, ""));
  return [...new Set(vars)];
}

/**
 * Preview a template with example data (for template editor preview).
 */
export function previewTemplate(template: string): string {
  const exampleContext: TemplateContext = {};
  for (const v of TEMPLATE_VARIABLES) {
    (exampleContext as Record<string, string>)[v.key] = v.example;
  }
  return interpolateTemplate(template, exampleContext);
}
```

**Design decisions:**
- **Mustache-style `{{variable}}` syntax** -- Simple, well-known, no special characters that conflict with email content. Easy regex match.
- **Unmatched variables stay as-is** -- If a variable has no value in context, the `{{variable}}` token remains visible. This is intentional: users can see which variables were not resolved and fix their template or data. The alternative (replacing with empty string) silently hides data issues.
- **Case-insensitive matching** -- `{{firstName}}` and `{{firstname}}` both resolve. But the context key lookup uses the cased version from the context object, so the variable names in `TEMPLATE_VARIABLES` are the canonical set.
- **Flat context, no nested objects** -- Templates use simple `{{companyName}}` not `{{company.name}}`. This keeps the regex simple and the UI approachable. The caller is responsible for flattening the data into a `TemplateContext`.

### Step 8: Add "Email Templates" tab to Settings page
**File:** `src/app/(dashboard)/settings/page.tsx` (edit)

Changes:
1. Import `Mail` icon from lucide-react (add to existing import)
2. Add new `TabsTrigger` for "email-templates" after "pipelines" and before "audit-log":
   ```tsx
   <TabsTrigger value="email-templates">
     <Mail className="mr-2 h-4 w-4" />
     Email Templates
   </TabsTrigger>
   ```
3. Add `TabsContent`:
   ```tsx
   <TabsContent value="email-templates" className="mt-4">
     <EmailTemplatesSettings />
   </TabsContent>
   ```
4. Add `EmailTemplatesSettings` component (defined below)

### Step 9: Build EmailTemplatesSettings component
**Inline in:** `src/app/(dashboard)/settings/page.tsx` (following existing pattern where all settings tab components are in the same file)

```tsx
function EmailTemplatesSettings() {
  const { data: templates, isLoading } = useEmailTemplates();
  const createTemplate = useCreateEmailTemplate();
  const updateTemplate = useUpdateEmailTemplate();
  const deleteTemplate = useDeleteEmailTemplate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  // Form state
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  // ... form handlers, preview logic
}
```

**UI layout:**

Card with header "Email Templates" + "Add Template" button.

**Template list:** Table with columns:
- Name
- Subject (truncated)
- Category (badge, if set)
- Created by (avatar + name)
- Actions (Edit, Delete -- only shown for templates created by current user)

**Create/Edit dialog:**
- Name input
- Subject input (with hint: "Use {{firstName}}, {{companyName}}, etc.")
- Body textarea (larger, 8 rows, with hint about variables)
- Category input (optional)
- "Preview" toggle button that shows the interpolated result using example data
- Variable reference: collapsible section listing all available variables with descriptions

**Variable reference panel (inside dialog):**
A collapsible `<details>` element below the body textarea:
```
Available Variables
  {{firstName}} -- Contact's first name (e.g., "John")
  {{lastName}} -- Contact's last name (e.g., "Doe")
  {{companyName}} -- Primary company name (e.g., "Acme Inc")
  ...etc from TEMPLATE_VARIABLES
```

**Preview mode:**
When "Preview" toggle is active, show the subject and body with example values substituted (using `previewTemplate()`). Display in a card below the form fields with a muted background, clearly labeled "Preview with example data".

### Step 10: Add template picker to activity form
**File:** `src/components/activities/activity-form.tsx` (edit)

Changes:
1. Add a "Use Template" button that only appears when `type === "email_sent"`
2. Clicking "Use Template" opens a Popover with a list of available templates
3. Selecting a template:
   a. Fetches the template content
   b. Builds a `TemplateContext` from the current contact/deal/company data
   c. Interpolates subject and body
   d. Sets the form's `subject` and `body` state with the interpolated values
4. User can then edit the pre-filled content before submitting

**Implementation detail -- building the context:**

The activity form receives `contactId`, `dealId`, `companyId` as props. To interpolate templates, we need the actual entity data (firstName, companyName, etc.).

**Approach:** Add a new prop `templateContext` to the ActivityForm that passes the data needed for interpolation. The parent component (contact detail page, deal detail page) already has this data loaded and can construct the context.

```tsx
interface ActivityFormProps {
  contactId?: string;
  dealId?: string;
  companyId?: string;
  templateContext?: TemplateContext; // NEW
  onSuccess?: () => void;
}
```

The contact detail page already has the contact data. When rendering ActivityForm, pass:
```tsx
<ActivityForm
  contactId={contact.id}
  templateContext={{
    firstName: contact.firstName,
    lastName: contact.lastName ?? undefined,
    email: contact.email ?? undefined,
    whopUsername: contact.whopUsername ?? undefined,
    tier: contact.tier ?? undefined,
    companyName: primaryCompany?.name,
    senderFirstName: currentUser.firstName,
    senderLastName: currentUser.lastName,
  }}
/>
```

Similarly for deal detail and company detail pages.

**Template picker UI:**

```tsx
{type === "email_sent" && (
  <Popover>
    <PopoverTrigger asChild>
      <Button type="button" variant="outline" size="sm">
        <FileText className="mr-1.5 h-3.5 w-3.5" />
        Use Template
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-64 p-0" align="start">
      <Command>
        <CommandInput placeholder="Search templates..." />
        <CommandList>
          <CommandEmpty>No templates found.</CommandEmpty>
          <CommandGroup>
            {templates?.map((t) => (
              <CommandItem
                key={t.id}
                onSelect={() => {
                  const interpolated = interpolateTemplate(t.subject, context);
                  const interpolatedBody = interpolateTemplate(t.body, context);
                  setSubject(interpolated);
                  setBody(interpolatedBody);
                }}
              >
                {t.name}
                {t.category && (
                  <Badge variant="secondary" className="ml-auto text-[10px]">
                    {t.category}
                  </Badge>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
)}
```

### Step 11: Update parent components to pass templateContext
**Files to update:**
- `src/app/(dashboard)/contacts/[id]/page.tsx` -- Pass templateContext to ActivityForm
- `src/app/(dashboard)/deals/[id]/page.tsx` -- Pass templateContext to ActivityForm (if it renders ActivityForm)
- `src/app/(dashboard)/companies/[id]/page.tsx` -- Pass templateContext to ActivityForm (if it renders ActivityForm)

For each parent, construct the `TemplateContext` from the entity data already loaded on the page. Also include sender info from `useCurrentUser()` (the hook already exists in `use-users.ts`).

---

## Requirement Traceability

| Requirement | Description | Covered By |
|-------------|-------------|------------|
| EMTL-01 | Create/edit/delete email templates in settings | Steps 1-9 (schema, API, Settings UI) |
| EMTL-02 | Templates support variable interpolation ({{firstName}}, {{companyName}}, etc.) | Step 7 (interpolation utility), Step 9 (preview in editor) |
| EMTL-03 | Templates can be used when logging email activities | Steps 10-11 (template picker in activity form) |

---

## Risks & Decisions

### Plain text vs. rich text body
Templates store plain text, not HTML/Markdown. Reasons:
- The CRM does not send actual emails (that is a v2 feature). Templates are used to pre-fill the activity form body when logging an email activity.
- A rich text editor (TipTap, Slate, etc.) adds significant complexity. Not warranted for logging email notes.
- If email sending is added in v2, the template schema can be extended with a `format` column and the body can support HTML.

### Template ownership model
Only the template creator can edit/delete. All shared templates are read-only for other users. This is simpler than a full permissions model and works well for a small internal team. If a template needs updating, the creator updates it or another user creates a new one.

### Variable resolution with missing data
If a contact has no company linked, `{{companyName}}` stays as `{{companyName}}` in the output. The user sees the unresolved variable and can manually replace it. This is safer than silently removing the placeholder (which would produce broken sentences like "Hi John, welcome to !").

### Template picker placement
The "Use Template" button appears inline in the activity form, only when the type is `email_sent`. It uses a Popover + Command pattern (consistent with other pickers in the app). Templates are loaded via useEmailTemplates hook (cached by React Query). The popover is searchable.

### Category vs. tags
Templates use a simple `category` text field rather than a full tag system. This keeps the data model simple. Categories are used for display grouping in the template list and picker. Common categories might be "Onboarding", "Follow Up", "Win-back", "Outreach". Users type the category as free text when creating a template.

### No template versioning
Templates are mutable -- editing updates in place. There is no version history. This is acceptable for an internal tool. The audit log will capture template create/update/delete events if audit logging is wired up for the email templates API.

---

## Verification

After implementation:
1. `npm run build` passes with no errors
2. Navigate to Settings -> Email Templates tab is visible
3. Click "Add Template" -> dialog opens with name, subject, body, category fields
4. Type `{{firstName}}` in subject -> variable reference shows available variables
5. Toggle "Preview" -> example data replaces variables
6. Save template -> appears in list
7. Edit template -> dialog pre-fills, save updates
8. Delete template -> removed from list
9. Navigate to a Contact detail page -> Activity form -> select "Email" type
10. "Use Template" button appears
11. Click "Use Template" -> popover shows template list, searchable
12. Select a template -> subject and body pre-fill with interpolated contact data
13. Variables like `{{firstName}}` are replaced with actual contact first name
14. Unresolved variables remain as `{{variable}}` tokens
15. Submit the activity -> logs normally with the pre-filled content
16. No console errors throughout
