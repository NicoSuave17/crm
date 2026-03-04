# Testing

## Status: No Tests Exist

This codebase has zero test files. No test framework is installed or configured.

---

## What Is Installed

Checking `package.json`:

- No test runner (`jest`, `vitest`, `@testing-library/*`, `playwright`, `cypress`, etc.)
- No test-related scripts in `"scripts"` — only `dev`, `build`, `start`, `lint`
- ESLint is configured (`eslint.config.mjs`) but only for linting, not testing

---

## What This Means

- There are no unit tests, integration tests, or end-to-end tests
- There is no test coverage
- No CI test step would currently pass (there is nothing to run)
- The only automated quality gate is `npm run lint`

---

## Test File Locations (When Tests Are Added)

Based on the project structure and stack, the conventional locations would be:

```
src/
  lib/
    api/__tests__/           # Unit tests for data layer functions
    validators/__tests__/    # Unit tests for Zod schemas
    whop/__tests__/          # Unit tests for domain logic (e.g. health-score.ts)
    hooks/__tests__/         # React Query hook tests
  components/
    contacts/__tests__/      # Component tests
    pipeline/__tests__/
  app/
    api/
      contacts/__tests__/    # API route handler tests
```

Or as co-located files:

```
src/lib/whop/health-score.test.ts
src/lib/validators/contact.test.ts
src/components/contacts/contact-form.test.tsx
```

---

## Recommended Stack When Tests Are Added

Given the existing stack (Next.js 16, React 19, TypeScript, Drizzle, Zod), the natural testing choices would be:

**Unit / Integration:**
- `vitest` — faster than Jest, native TypeScript support, compatible with the existing toolchain
- `@testing-library/react` — component testing
- `@testing-library/user-event` — user interaction simulation
- `msw` (Mock Service Worker) — mock fetch calls in hook tests

**End-to-End:**
- `playwright` — already available as an MCP tool in this environment; good fit for testing the Kanban drag-drop and multi-step flows

**Database:**
- Use a separate test database (separate `DATABASE_URL_TEST` env var)
- Run Drizzle migrations against it before the test suite

---

## Highest-Value Tests to Add First

These areas have pure logic with no UI dependencies and would give the most value immediately:

1. **`src/lib/whop/health-score.ts`** — `calculateHealthScore()` and `getChurnRisk()` are pure functions with clearly defined inputs and outputs. No mocking needed.

2. **`src/lib/validators/`** — Zod schemas are trivially testable. Verify that valid data passes and edge cases (empty strings, invalid UUIDs, missing required fields) are rejected correctly.

3. **`src/lib/api/contacts.ts`** — Data layer functions could be tested against a real test DB or with a mocked `db` instance.

4. **API route handlers** — Test auth enforcement (unauthenticated requests return 401), validation rejection (malformed bodies return 400), and happy paths.

---

## Example: What a Health Score Test Would Look Like

```ts
// src/lib/whop/health-score.test.ts
import { describe, it, expect } from "vitest";
import { calculateHealthScore, getChurnRisk } from "../health-score";

describe("calculateHealthScore", () => {
  it("returns 100 for a perfect creator", () => {
    const score = calculateHealthScore({
      gmvTrend: 20,
      activityRecency: 0,
      memberGrowth: 10,
      currentGmv: 100000,
    });
    expect(score).toBe(100);
  });

  it("returns 0 for a completely inactive creator", () => {
    const score = calculateHealthScore({
      gmvTrend: -100,
      activityRecency: 60,
      memberGrowth: -100,
      currentGmv: 0,
    });
    expect(score).toBe(0);
  });
});

describe("getChurnRisk", () => {
  it("returns low for score >= 70", () => expect(getChurnRisk(70)).toBe("low"));
  it("returns medium for score 50-69", () => expect(getChurnRisk(55)).toBe("medium"));
  it("returns high for score 30-49", () => expect(getChurnRisk(40)).toBe("high"));
  it("returns critical for score < 30", () => expect(getChurnRisk(20)).toBe("critical"));
});
```
