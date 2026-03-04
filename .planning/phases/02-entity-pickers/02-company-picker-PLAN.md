---
phase: 2
plan: "02-company-picker"
title: "Company Picker Component"
wave: 1
depends_on: []
files_modified:
  - src/lib/api/companies.ts
  - src/app/api/companies/route.ts
  - src/lib/hooks/use-companies.ts
  - src/components/pickers/company-picker.tsx
autonomous: true
requirements:
  - PICK-02
  - PICK-05
---

# Company Picker Component

## Objective
Deliver a reusable `CompanyPicker` combobox that searches companies by name and domain, including the minimal backend plumbing (API route + data access + hook) needed to power it.

<tasks>

<task id="1">
Create `src/lib/api/companies.ts` with a `listCompanies` function. This is the minimal data access layer the picker needs.

```ts
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema";
import { ilike, or, desc, type SQL } from "drizzle-orm";

export async function listCompanies(params: { search?: string; limit?: number } = {}) {
  const { search, limit = 100 } = params;
  const conditions: SQL[] = [];

  if (search) {
    conditions.push(
      or(
        ilike(companies.name, `%${search}%`),
        ilike(companies.domain, `%${search}%`)
      )!
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  return db
    .select({
      id: companies.id,
      name: companies.name,
      domain: companies.domain,
    })
    .from(companies)
    .where(where)
    .orderBy(desc(companies.createdAt))
    .limit(limit);
}
```

Import `and` from `drizzle-orm` as well. This function returns `{ id, name, domain }[]` — just the fields the picker needs.
</task>

<task id="2">
Create `src/app/api/companies/route.ts` with a GET handler. Follow the exact pattern of `src/app/api/contacts/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/helpers";
import { listCompanies } from "@/lib/api/companies";

export async function GET(request: NextRequest) {
  try {
    await requireUser();
    const { searchParams } = new URL(request.url);
    const data = await listCompanies({
      search: searchParams.get("search") || undefined,
      limit: Number(searchParams.get("limit")) || 100,
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/companies error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```
</task>

<task id="3">
Create `src/lib/hooks/use-companies.ts` following the pattern of `src/lib/hooks/use-users.ts`:

```ts
"use client";

import { useQuery } from "@tanstack/react-query";

async function fetchCompanies() {
  const res = await fetch("/api/companies?limit=100");
  if (!res.ok) throw new Error("Failed to fetch companies");
  return res.json();
}

export function useCompanies() {
  return useQuery({
    queryKey: ["companies"],
    queryFn: fetchCompanies,
  });
}
```
</task>

<task id="4">
Create `src/components/pickers/company-picker.tsx` following the exact pattern of `src/components/pickers/user-picker.tsx`. The component must:

**Props interface** — export `CompanyPickerProps`:
```ts
export interface CompanyPickerProps {
  value?: string | null;
  onChange: (companyId: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}
```

**Data fetching** — use `useCompanies()` from `@/lib/hooks/use-companies`. The hook returns `{ data: Company[] }`. Destructure into `const companies = (data ?? []) as Array<{ id: string; name: string; domain: string | null }>`.

**Selected company display** — when `value` is set, find matching company. Show `Building2` icon (from lucide-react, h-4 w-4) + company name. If domain exists, show it in muted smaller text. If value set but not found, show "Unknown company".

**Command list items** — each `CommandItem`:
- Set `value` to `${company.name} ${company.domain ?? ""}` for search filtering by name AND domain
- Show `Check` icon (opacity toggled)
- Show `Building2` icon (h-5 w-5, text-muted-foreground) instead of Avatar
- Show company name as primary text
- Show domain in `text-xs text-muted-foreground` if present

**Clear selection** — same pattern as UserPicker.

**Popover** — width `w-[300px]`. `CommandInput` placeholder: "Search companies...". `CommandEmpty`: "No company found."

**Imports** — `Building2` from lucide-react (plus Check, ChevronsUpDown, X). No Avatar needed. Otherwise match UserPicker imports.
</task>

</tasks>

## Verification
- [ ] `GET /api/companies` returns a JSON array of `{ id, name, domain }` objects
- [ ] `CompanyPicker` renders with placeholder text when no value is set
- [ ] Typing filters companies by both name and domain
- [ ] Selecting a company closes the popover and calls `onChange` with the company UUID
- [ ] Passing a `value` prop shows the selected company name and domain in the trigger
- [ ] Clear selection resets to null
- [ ] Component compiles with no TypeScript errors

## must_haves
- Searchable by company name AND domain (PICK-02)
- Uses Popover + Command combobox pattern (PICK-05)
- Accepts `value` prop for edit-mode pre-selection (Success Criteria 5)
- Returns company UUID via `onChange` callback (PICK-02)
- API route is auth-protected with `requireUser()` (consistency)
