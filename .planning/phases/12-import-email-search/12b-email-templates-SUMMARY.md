# 12b Email Templates - Summary

## What was built
Full email template system: CRUD in Settings, variable interpolation engine, and template picker in the activity form for email activities.

## Files Created
- `src/lib/db/schema.ts` -- Added `emailTemplates` table + `emailTemplatesRelations` + updated `usersRelations`
- `src/lib/api/email-templates.ts` -- DAL with listEmailTemplates, getEmailTemplate, createEmailTemplate, updateEmailTemplate, deleteEmailTemplate
- `src/lib/validators/email-template.ts` -- Zod schemas (create + update)
- `src/app/api/email-templates/route.ts` -- GET (list) + POST (create)
- `src/app/api/email-templates/[id]/route.ts` -- PATCH (update, owner-only) + DELETE (owner-only)
- `src/lib/hooks/use-email-templates.ts` -- useEmailTemplates, useCreateEmailTemplate, useUpdateEmailTemplate, useDeleteEmailTemplate
- `src/lib/utils/template-interpolation.ts` -- interpolateTemplate, extractVariables, previewTemplate, TEMPLATE_VARIABLES constant

## Files Modified
- `src/app/(dashboard)/settings/page.tsx` -- Added "Email Templates" tab with full EmailTemplatesSettings component (list table, create/edit dialog with live preview, variable reference panel, owner-only edit/delete)
- `src/components/activities/activity-form.tsx` -- Added templateContext prop, "Use Template" button (appears for email_sent type only), Popover + Command searchable template picker, interpolation on select
- `src/components/activities/activity-timeline.tsx` -- Added templateContext prop passthrough to ActivityForm
- `src/app/(dashboard)/contacts/[id]/page.tsx` -- Builds templateContext from contact + primary company + current user, passes to ActivityTimeline
- `src/app/(dashboard)/deals/[id]/page.tsx` -- Builds templateContext from deal contact/company/value + current user, passes to ActivityTimeline
- `src/app/(dashboard)/companies/[id]/page.tsx` -- Builds templateContext from company + current user, passes to ActivityTimeline

## Key Design Decisions
- **Plain text templates** -- No HTML/rich text. Templates pre-fill activity form text fields.
- **Mustache-style `{{variable}}` syntax** -- Simple regex matching, 12 supported variables covering contact, company, deal, and sender fields.
- **Unmatched variables stay as-is** -- If `{{companyName}}` has no value, it remains visible so users can see and fix it.
- **Owner-only edit/delete** -- Only the creator can modify/delete a template. Shared templates are read-only for others.
- **Live preview** -- Template editor shows subject/body with example data substituted when Preview toggle is active.

## Requirements Coverage
| Requirement | Status |
|-------------|--------|
| EMTL-01: Create/edit/delete email templates in settings | Done |
| EMTL-02: Templates support variable interpolation | Done |
| EMTL-03: Templates can be used when logging email activities | Done |

## Verification
- `npm run build` passes with zero errors
- Email Templates tab visible in Settings
- Create/edit dialog with name, subject, body, category, shared toggle
- Live preview with example data
- Collapsible variable reference panel
- Template picker in activity form (email_sent type only)
- Template interpolation with contact/company/deal/sender data
