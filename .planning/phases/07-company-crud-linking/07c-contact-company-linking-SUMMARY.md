# 07c Contact-Company Linking - SUMMARY

**Status:** Complete
**Date:** 2026-03-05

## What Was Built

### Requirements Covered
| Requirement | Description | Implementation |
|-------------|-------------|----------------|
| LINK-01 | Contact detail shows linked companies with role | Companies section in left column profile card |
| LINK-02 | Link company via picker dialog with role field | LinkCompanyDialog with CompanyPicker + role input |
| LINK-03 | Unlink company from contact | X button with confirm() on each linked company |
| LINK-04 | Company detail shows linked contacts | CompanyContactsTab replacing placeholder in Contacts tab |

### Files Created
- `src/lib/api/contact-companies.ts` -- DAL: getContactCompanies, getCompanyContacts, linkContactCompany (onConflictDoUpdate), unlinkContactCompany
- `src/lib/validators/contact-company.ts` -- Zod schema: linkContactCompanySchema (companyId uuid + optional role)
- `src/app/api/contacts/[id]/companies/route.ts` -- GET (list linked companies), POST (link with role)
- `src/app/api/contacts/[id]/companies/[companyId]/route.ts` -- DELETE (unlink)
- `src/app/api/companies/[id]/contacts/route.ts` -- GET (list linked contacts)
- `src/lib/hooks/use-contact-companies.ts` -- useContactCompanies, useLinkCompany, useUnlinkCompany, useCompanyContacts
- `src/components/contacts/link-company-dialog.tsx` -- Dialog with CompanyPicker + role input
- `src/components/companies/company-contacts-tab.tsx` -- Table of linked contacts with avatar, name, email, type, role

### Files Modified
- `src/app/(dashboard)/contacts/[id]/page.tsx` -- Added Companies section between Tags and Custom Fields
- `src/app/(dashboard)/companies/[id]/page.tsx` -- Replaced Contacts tab placeholder with CompanyContactsTab

## Architecture Decisions
- **Linking direction:** Link from contact side only (LINK-02). Company detail is read-only view.
- **Re-linking:** onConflictDoUpdate on composite PK updates role without error. Clean UX for role updates.
- **isPrimary:** Stored in DB but not exposed in UI. Available for future "primary company" display logic.
- **Cache invalidation:** Mutations invalidate both `["contact-companies", contactId]` and `["company-contacts"]` broadly.
- **REST routes:** Nested sub-resource pattern: `/api/contacts/[id]/companies` and `/api/companies/[id]/contacts`.

## Verification
- `npm run build` passes with zero errors
- All 9 implementation steps committed atomically
