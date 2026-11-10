import { db } from "@/lib/db";
import { importJobs, companies, contacts, contactCompanies, users } from "@/lib/db/schema";
import { eq, ilike, sql } from "drizzle-orm";
import { normalizeDomain, normalizeCompanyName } from "@/lib/utils/normalize";
import { createAlert } from "./alerts";
import { bulkCreateContacts } from "./contacts";
import { createCompany, updateCompany } from "./companies";
import { setFieldValue } from "./custom-fields";
import { createContactSchema } from "@/lib/validators/contact";
import { createCompanySchema, updateCompanySchema } from "@/lib/validators/company";
import { processImportBatch } from "@/lib/ai/batch-processor";

const PROGRESS_INTERVAL = 50;

interface CompanyData {
  name?: string;
  domain?: string;
  industry?: string;
  size?: string;
  description?: string;
  linkedinUrl?: string;
  websiteUrl?: string;
  vertical?: string;
}

interface ImportRow {
  action: "create" | "overwrite" | "skip";
  overwriteId?: string;
  data: Record<string, unknown>;
  /** New format: all company fields bundled together */
  companyData?: CompanyData | null;
  /** Legacy format (backward compat) */
  companyDomain?: string;
  companyName?: string;
}

interface CustomFieldMapEntry {
  fieldDefinitionId: string;
  fieldType: string;
}

interface ProcessingResults {
  created: number;
  skipped: number;
  updated: number;
  errors: number;
  pendingReview: number;
  errorDetails: { index: number; message: string }[];
  companyLinking?: {
    linkedByDomain: number;
    linkedByName: number;
    companiesCreated: number;
    companiesUpdated: number;
    ambiguousMatches: number;
    noCompanyInfo: number;
  };
  gatekeeper?: {
    totalTokens: number;
    totalLatencyMs: number;
    autoApplied: number;
    sentToReview: number;
    rejected: number;
  };
}

/**
 * Extract companyData from a row, handling both new and legacy formats.
 */
function getCompanyData(row: ImportRow): CompanyData | null {
  // New format: companyData object
  if (row.companyData && typeof row.companyData === "object") {
    return row.companyData;
  }
  // Legacy format: flat companyDomain/companyName
  if (row.companyDomain || row.companyName) {
    return {
      name: row.companyName,
      domain: row.companyDomain,
    };
  }
  return null;
}

/**
 * Main background import processor. Called via after() from the API route.
 */
export async function processImportJob(jobId: string): Promise<void> {
  try {
    // Mark as processing
    const [job] = await db
      .update(importJobs)
      .set({ status: "processing" })
      .where(eq(importJobs.id, jobId))
      .returning();

    if (!job) {
      console.error(`Import job ${jobId} not found`);
      return;
    }

    // Payload can be either ImportRow[] (legacy) or { rows, customFieldMap, defaultOwnerId }
    const rawPayload = job.payload as ImportRow[] | { rows: ImportRow[]; customFieldMap?: Record<string, CustomFieldMapEntry>; preApproved?: boolean; defaultOwnerId?: string };
    const rows = Array.isArray(rawPayload) ? rawPayload : rawPayload.rows;
    const customFieldMap = Array.isArray(rawPayload) ? undefined : rawPayload.customFieldMap;
    const preApproved = !Array.isArray(rawPayload) && rawPayload.preApproved === true;
    const defaultOwnerId = !Array.isArray(rawPayload) ? rawPayload.defaultOwnerId : undefined;

    const results: ProcessingResults = {
      created: 0,
      skipped: 0,
      updated: 0,
      errors: 0,
      pendingReview: 0,
      errorDetails: [],
    };

    if (job.entityType === "contact") {
      await processContactImport(jobId, rows, results, job.userId, customFieldMap, preApproved, defaultOwnerId);
    } else if (job.entityType === "company") {
      await processCompanyImport(jobId, rows, results, job.userId, customFieldMap, preApproved, defaultOwnerId);
    }

    // Mark complete
    await db
      .update(importJobs)
      .set({
        status: "complete",
        processedRows: rows.length,
        results,
        completedAt: new Date(),
      })
      .where(eq(importJobs.id, jobId));

    // Create notification alert
    const entityLabel = job.entityType === "contact" ? "Contact" : "Company";
    const messageParts: string[] = [];
    if (results.created > 0) messageParts.push(`${results.created} created`);
    if (results.updated > 0) messageParts.push(`${results.updated} updated`);
    if (results.skipped > 0) messageParts.push(`${results.skipped} skipped`);
    if (results.pendingReview > 0) messageParts.push(`${results.pendingReview} pending review`);
    if (results.errors > 0) messageParts.push(`${results.errors} errors`);
    if (results.companyLinking?.companiesCreated) {
      messageParts.push(`${results.companyLinking.companiesCreated} companies created`);
    }

    await createAlert({
      type: "import_complete",
      userId: job.userId,
      title: `${entityLabel} import complete`,
      message: messageParts.join(", "),
      severity: results.errors > 0 ? "warning" : "info",
      metadata: { jobId, ...results },
    });
  } catch (error) {
    console.error(`Import job ${jobId} failed:`, error);

    // Mark as failed
    await db
      .update(importJobs)
      .set({
        status: "failed",
        results: {
          created: 0,
          skipped: 0,
          updated: 0,
          errors: 1,
          errorDetails: [
            { index: -1, message: error instanceof Error ? error.message : "Unknown error" },
          ],
        },
        completedAt: new Date(),
      })
      .where(eq(importJobs.id, jobId));

    // Get userId for alert
    const [failedJob] = await db
      .select({ userId: importJobs.userId, entityType: importJobs.entityType })
      .from(importJobs)
      .where(eq(importJobs.id, jobId))
      .limit(1);

    if (failedJob) {
      await createAlert({
        type: "import_complete",
        userId: failedJob.userId,
        title: `${failedJob.entityType === "contact" ? "Contact" : "Company"} import failed`,
        message: error instanceof Error ? error.message : "An unexpected error occurred",
        severity: "critical",
        metadata: { jobId },
      });
    }
  }
}

/**
 * Resolve ownerEmail to ownerId by looking up the users table.
 * Uses an in-memory cache for the duration of the import.
 */
async function resolveOwnerEmail(
  email: string | undefined,
  cache: Map<string, string | null>
): Promise<string | null> {
  if (!email || !email.trim()) return null;
  const normalized = email.trim().toLowerCase();

  if (cache.has(normalized)) return cache.get(normalized)!;

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1);

  const id = user?.id ?? null;
  cache.set(normalized, id);
  return id;
}

async function processContactImport(
  jobId: string,
  rows: ImportRow[],
  results: ProcessingResults,
  userId: string,
  customFieldMap?: Record<string, CustomFieldMapEntry>,
  preApproved?: boolean,
  defaultOwnerId?: string
): Promise<void> {
  // In-memory map for company reuse within this import (cacheKey → companyId)
  const companyCache = new Map<string, string>();
  // Cache for owner email → userId lookups
  const ownerCache = new Map<string, string | null>();
  const companyLinking = {
    linkedByDomain: 0,
    linkedByName: 0,
    companiesCreated: 0,
    companiesUpdated: 0,
    ambiguousMatches: 0,
    noCompanyInfo: 0,
  };

  // Separate rows by action for batch optimization
  const createRows: { index: number; data: Record<string, unknown>; companyData: CompanyData | null }[] = [];
  const overwriteRows: { index: number; overwriteId: string; data: Record<string, unknown>; companyData: CompanyData | null }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.action === "skip") {
      results.skipped++;
      continue;
    }
    const cd = getCompanyData(row);
    if (row.action === "overwrite" && row.overwriteId) {
      overwriteRows.push({ index: i, overwriteId: row.overwriteId, data: row.data, companyData: cd });
    } else {
      createRows.push({ index: i, data: row.data, companyData: cd });
    }
  }

  // ── Run create rows through AI Gatekeeper (unless pre-approved by user) ──
  // When preApproved=true, the user already reviewed AI suggestions in the wizard,
  // so we skip the gatekeeper and insert directly.
  let gkApprovedCreates = createRows;
  if (createRows.length > 0 && !preApproved) {
    try {
      const batchRows = createRows.map((r) => ({
        index: r.index,
        data: { ...r.data, source: "import" },
      }));

      const batchResult = await processImportBatch(
        batchRows,
        "contact",
        jobId,
        userId
      );

      // Track gatekeeper stats
      results.gatekeeper = {
        totalTokens: batchResult.totalTokens,
        totalLatencyMs: batchResult.totalLatencyMs,
        autoApplied: batchResult.autoApply.length,
        sentToReview: batchResult.review.length,
        rejected: batchResult.reject.length,
      };

      // Review rows → pending review (already saved to review queue by batch processor)
      results.pendingReview += batchResult.review.length;

      // Rejected rows → errors
      for (const rej of batchResult.reject) {
        results.errors++;
        results.errorDetails.push({
          index: rej.index,
          message: `AI rejected: ${rej.issues.join("; ") || "Data quality too low"}`,
        });
      }

      // Build a set of approved indices and swap in normalized data
      const approvedIndices = new Set(batchResult.autoApply.map((a) => a.index));
      const normalizedDataMap = new Map(batchResult.autoApply.map((a) => [a.index, a.data]));

      // Filter createRows to only gatekeeper-approved ones, using normalized data
      gkApprovedCreates = createRows
        .filter((r) => approvedIndices.has(r.index))
        .map((r) => ({
          ...r,
          data: normalizedDataMap.get(r.index) || r.data,
        }));
    } catch (error) {
      // Gatekeeper failed — fall through with original data (fail-open)
      console.error("Gatekeeper batch processing failed, proceeding without AI:", error);
      gkApprovedCreates = createRows;
    }
  }

  // Pre-load existing emails for server-side dedup
  const allEmails = gkApprovedCreates
    .map((r) => String(r.data.email || "").toLowerCase().trim())
    .filter((e) => e.length > 0);

  const existingEmailSet = new Set<string>();
  if (allEmails.length > 0) {
    // Check in batches of 500
    for (let i = 0; i < allEmails.length; i += 500) {
      const batch = allEmails.slice(i, i + 500);
      const existing = await db
        .select({ email: contacts.email })
        .from(contacts)
        .where(
          sql`lower(${contacts.email}) IN (${sql.join(batch.map((e) => sql`${e}`), sql`, `)})`
        );
      for (const row of existing) {
        if (row.email) existingEmailSet.add(row.email.toLowerCase());
      }
    }
  }

  // Filter out duplicates
  const dedupedCreates: typeof gkApprovedCreates = [];
  for (const row of gkApprovedCreates) {
    const email = String(row.data.email || "").toLowerCase().trim();
    if (email && existingEmailSet.has(email)) {
      results.skipped++;
      continue;
    }
    dedupedCreates.push(row);
    // Track this email so within-import dups are also skipped
    if (email) existingEmailSet.add(email);
  }

  // Batch create simple contacts (no company linking, no overwrites)
  const simpleCreates = dedupedCreates.filter((r) => !r.companyData);
  const complexCreates = dedupedCreates.filter((r) => r.companyData);

  if (simpleCreates.length > 0) {
    try {
      const validRows = [];
      const validRowIndices: number[] = []; // Track which simpleCreates index each validRow came from
      for (let si = 0; si < simpleCreates.length; si++) {
        const row = simpleCreates[si];
        // Resolve ownerEmail → ownerId, or fall back to defaultOwnerId
        const data: Record<string, unknown> = { ...row.data, source: "import" };
        if (data.ownerEmail) {
          const ownerId = await resolveOwnerEmail(String(data.ownerEmail), ownerCache);
          if (ownerId) {
            data.ownerId = ownerId;
          } else {
            results.errorDetails.push({
              index: row.index,
              message: `Owner email "${data.ownerEmail}" not found — record will use default owner or be unassigned`,
            });
          }
          delete data.ownerEmail;
        }
        if (!data.ownerId && defaultOwnerId) {
          data.ownerId = defaultOwnerId;
        }
        let parsed = createContactSchema.safeParse(data);
        // If email is the only failing field, clear it and retry
        if (!parsed.success) {
          const emailErrors = parsed.error.issues.filter((i) => i.path.includes("email"));
          if (emailErrors.length > 0 && emailErrors.length === parsed.error.issues.length) {
            delete data.email;
            parsed = createContactSchema.safeParse(data);
          }
        }
        if (parsed.success) {
          validRows.push(parsed.data);
          validRowIndices.push(si);
        } else {
          results.errors++;
          results.errorDetails.push({
            index: row.index,
            message: parsed.error.issues.map((i) => i.message).join(", "),
          });
        }
      }

      if (validRows.length > 0) {
        const { created, ids } = await bulkCreateContacts(validRows, userId);
        results.created += created;

        // Write custom field values for batch-created contacts
        // Use validRowIndices to map ids back to correct source rows
        if (customFieldMap && ids.length > 0) {
          for (let j = 0; j < ids.length; j++) {
            const sourceRow = simpleCreates[validRowIndices[j]];
            await writeCustomFieldValues(ids[j], sourceRow.data, customFieldMap);
          }
        }
      }
    } catch (error) {
      results.errors += simpleCreates.length;
      results.errorDetails.push({
        index: simpleCreates[0].index,
        message: `Batch insert failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }

  // Update progress after batch creates
  await updateProgress(jobId, results.created + results.skipped + results.errors);

  // Process complex creates (with company linking) row-by-row
  for (const row of complexCreates) {
    try {
      // Resolve ownerEmail → ownerId, or fall back to defaultOwnerId
      const data: Record<string, unknown> = { ...row.data, source: "import" };
      if (data.ownerEmail) {
        const ownerId = await resolveOwnerEmail(String(data.ownerEmail), ownerCache);
        if (ownerId) data.ownerId = ownerId;
        delete data.ownerEmail;
      }
      if (!data.ownerId && defaultOwnerId) {
        data.ownerId = defaultOwnerId;
      }
      let parsed = createContactSchema.safeParse(data);
      // If email is the only failing field, clear it and retry
      if (!parsed.success) {
        const emailErrors = parsed.error.issues.filter((i) => i.path.includes("email"));
        if (emailErrors.length > 0 && emailErrors.length === parsed.error.issues.length) {
          delete data.email;
          parsed = createContactSchema.safeParse(data);
        }
      }
      if (!parsed.success) {
        results.errors++;
        results.errorDetails.push({
          index: row.index,
          message: parsed.error.issues.map((i) => i.message).join(", "),
        });
        continue;
      }

      const { createContact } = await import("./contacts");
      const contact = await createContact(parsed.data, userId);

      // Write custom field values
      if (customFieldMap) {
        await writeCustomFieldValues(contact.id, row.data, customFieldMap);
      }

      // Company linking
      const companyId = await resolveCompanyForContact(
        row.companyData!,
        companyCache,
        companyLinking,
        userId
      );

      if (companyId) {
        await db
          .insert(contactCompanies)
          .values({ contactId: contact.id, companyId, isPrimary: true })
          .onConflictDoNothing();
      }

      results.created++;
    } catch (error) {
      results.errors++;
      results.errorDetails.push({
        index: row.index,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }

    // Update progress periodically
    const processed = results.created + results.skipped + results.updated + results.errors;
    if (processed % PROGRESS_INTERVAL === 0) {
      await updateProgress(jobId, processed);
    }
  }

  // Process overwrites row-by-row
  for (const row of overwriteRows) {
    try {
      // Resolve ownerEmail → ownerId for overwrites too
      const data: Record<string, unknown> = { ...row.data };
      if (data.ownerEmail) {
        const ownerId = await resolveOwnerEmail(String(data.ownerEmail), ownerCache);
        if (ownerId) data.ownerId = ownerId;
        delete data.ownerEmail;
      }
      const { updateContact } = await import("./contacts");
      await updateContact(row.overwriteId, data, userId);

      // Write custom field values for overwrites
      if (customFieldMap) {
        await writeCustomFieldValues(row.overwriteId, row.data, customFieldMap);
      }

      // Company linking for overwrites too
      if (row.companyData) {
        const companyId = await resolveCompanyForContact(
          row.companyData,
          companyCache,
          companyLinking,
          userId
        );

        if (companyId) {
          await db
            .insert(contactCompanies)
            .values({ contactId: row.overwriteId, companyId, isPrimary: true })
            .onConflictDoNothing();
        }
      }

      results.updated++;
    } catch (error) {
      results.errors++;
      results.errorDetails.push({
        index: row.index,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }

    const processed = results.created + results.skipped + results.updated + results.errors;
    if (processed % PROGRESS_INTERVAL === 0) {
      await updateProgress(jobId, processed);
    }
  }

  results.companyLinking = companyLinking;
}

async function processCompanyImport(
  jobId: string,
  rows: ImportRow[],
  results: ProcessingResults,
  userId: string,
  customFieldMap?: Record<string, CustomFieldMapEntry>,
  preApproved?: boolean,
  defaultOwnerId?: string
): Promise<void> {
  // ── Run create rows through AI Gatekeeper (unless pre-approved) ──
  const createRows = rows.filter((r) => r.action !== "skip" && !(r.action === "overwrite" && r.overwriteId));
  const normalizedDataByIndex = new Map<number, Record<string, unknown>>();
  const rejectedIndices = new Set<number>();
  const reviewIndices = new Set<number>();

  if (createRows.length > 0 && !preApproved) {
    try {
      const batchRows = createRows.map((r, idx) => {
        // Find original index in rows array
        const origIdx = rows.indexOf(r);
        return { index: origIdx, data: r.data };
      });

      const batchResult = await processImportBatch(batchRows, "company", jobId, userId);

      // Merge gatekeeper stats
      results.gatekeeper = {
        totalTokens: (results.gatekeeper?.totalTokens || 0) + batchResult.totalTokens,
        totalLatencyMs: (results.gatekeeper?.totalLatencyMs || 0) + batchResult.totalLatencyMs,
        autoApplied: (results.gatekeeper?.autoApplied || 0) + batchResult.autoApply.length,
        sentToReview: (results.gatekeeper?.sentToReview || 0) + batchResult.review.length,
        rejected: (results.gatekeeper?.rejected || 0) + batchResult.reject.length,
      };

      results.pendingReview += batchResult.review.length;
      for (const rev of batchResult.review) reviewIndices.add(rev.index);
      for (const rej of batchResult.reject) {
        rejectedIndices.add(rej.index);
        results.errors++;
        results.errorDetails.push({
          index: rej.index,
          message: `AI rejected: ${rej.issues.join("; ") || "Data quality too low"}`,
        });
      }
      for (const app of batchResult.autoApply) {
        normalizedDataByIndex.set(app.index, app.data);
      }
    } catch (error) {
      console.error("Gatekeeper batch processing failed for companies, proceeding without AI:", error);
    }
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    if (row.action === "skip") {
      results.skipped++;
      continue;
    }

    // Skip rows the gatekeeper rejected or sent to review
    if (rejectedIndices.has(i) || reviewIndices.has(i)) {
      continue;
    }

    try {
      if (row.action === "overwrite" && row.overwriteId) {
        await updateCompany(row.overwriteId, row.data, userId);
        if (customFieldMap) {
          await writeCustomFieldValues(row.overwriteId, row.data, customFieldMap);
        }
        results.updated++;
      } else {
        // Use gatekeeper-normalized data if available
        const dataToUse = normalizedDataByIndex.get(i) || row.data;
        // Apply default owner if none specified
        if (defaultOwnerId && !dataToUse.ownerId) {
          dataToUse.ownerId = defaultOwnerId;
        }
        const parsed = createCompanySchema.safeParse(dataToUse);
        if (!parsed.success) {
          results.errors++;
          results.errorDetails.push({
            index: i,
            message: parsed.error.issues.map((iss) => iss.message).join(", "),
          });
          continue;
        }

        const newCompany = await createCompany(parsed.data, userId);
        if (customFieldMap) {
          await writeCustomFieldValues(newCompany.id, row.data, customFieldMap);
        }
        results.created++;
      }
    } catch (error) {
      // If domain unique constraint violation, treat as duplicate skipped
      const errMsg = error instanceof Error ? error.message : "";
      if (errMsg.includes("idx_companies_domain_unique") || errMsg.includes("unique constraint")) {
        results.skipped++;
        results.errorDetails.push({
          index: i,
          message: "Duplicate domain — company already exists",
        });
      } else {
        results.errors++;
        results.errorDetails.push({
          index: i,
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    if ((i + 1) % PROGRESS_INTERVAL === 0) {
      await updateProgress(jobId, i + 1);
    }
  }
}

/**
 * Resolves (find or create) a company for a contact import row.
 *
 * Decision tree:
 *   1. Has domain → normalize → lookup → found: link (+ fill gaps) | not found: create with all fields
 *   2. Name only → normalize → lookup → 1 match: link (+ fill gaps) | multiple: ambiguous | 0: CREATE
 *   3. No data → return null
 */
async function resolveCompanyForContact(
  companyData: CompanyData,
  cache: Map<string, string>,
  linking: ProcessingResults["companyLinking"] & {},
  userId: string
): Promise<string | null> {
  const normalizedDomain = normalizeDomain(companyData.domain);

  // Build the full company creation payload from all available fields, validated through Zod
  function buildCompanyPayload(fallbackName: string): Parameters<typeof createCompany>[0] {
    const raw: Record<string, string> = { name: companyData.name || fallbackName };
    if (normalizedDomain) raw.domain = normalizedDomain;
    if (companyData.industry) raw.industry = companyData.industry;
    if (companyData.size) raw.size = companyData.size;
    if (companyData.description) raw.description = companyData.description;
    if (companyData.linkedinUrl) raw.linkedinUrl = companyData.linkedinUrl;
    if (companyData.websiteUrl) raw.websiteUrl = companyData.websiteUrl;
    if (companyData.vertical) raw.vertical = companyData.vertical;

    // Validate through schema — strips invalid enum values gracefully
    const parsed = createCompanySchema.safeParse(raw);
    if (parsed.success) return parsed.data;
    // Fallback: at minimum name + domain
    return { name: raw.name, domain: normalizedDomain || undefined };
  }

  // Fill gaps on an existing company with CSV data (don't overwrite existing values)
  async function fillCompanyGaps(companyId: string): Promise<void> {
    const [existing] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);
    if (!existing) return;

    const raw: Record<string, string> = {};
    if (!existing.industry && companyData.industry) raw.industry = companyData.industry;
    if (!existing.size && companyData.size) raw.size = companyData.size;
    if (!existing.description && companyData.description) raw.description = companyData.description;
    if (!existing.linkedinUrl && companyData.linkedinUrl) raw.linkedinUrl = companyData.linkedinUrl;
    if (!existing.websiteUrl && companyData.websiteUrl) raw.websiteUrl = companyData.websiteUrl;
    if (!existing.vertical && companyData.vertical) raw.vertical = companyData.vertical;

    if (Object.keys(raw).length > 0) {
      const parsed = updateCompanySchema.safeParse(raw);
      if (parsed.success && Object.keys(parsed.data).length > 0) {
        try {
          await updateCompany(companyId, parsed.data, userId);
          linking.companiesUpdated++;
        } catch {
          // Non-critical — company exists, just couldn't update gaps
        }
      }
    }
  }

  // ── Path 1: Domain-based resolution ──
  if (normalizedDomain) {
    const cached = cache.get(normalizedDomain);
    if (cached) {
      linking.linkedByDomain++;
      return cached;
    }

    const [existing] = await db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.domain, normalizedDomain))
      .limit(1);

    if (existing) {
      cache.set(normalizedDomain, existing.id);
      linking.linkedByDomain++;
      // Fill any gaps on the existing company
      await fillCompanyGaps(existing.id);
      return existing.id;
    }

    // Create new company with all available fields
    try {
      const payload = buildCompanyPayload(normalizedDomain);
      const newCompany = await createCompany(payload, userId);
      cache.set(normalizedDomain, newCompany.id);
      linking.companiesCreated++;
      return newCompany.id;
    } catch {
      // Domain unique constraint race condition
      const [raceWinner] = await db
        .select({ id: companies.id })
        .from(companies)
        .where(eq(companies.domain, normalizedDomain))
        .limit(1);

      if (raceWinner) {
        cache.set(normalizedDomain, raceWinner.id);
        linking.linkedByDomain++;
        return raceWinner.id;
      }
      return null;
    }
  }

  // ── Path 2: Name-based resolution (no domain) ──
  if (companyData.name) {
    const normalizedName = normalizeCompanyName(companyData.name);
    if (!normalizedName) {
      linking.noCompanyInfo++;
      return null;
    }

    const nameCacheKey = `name:${normalizedName}`;
    const cached = cache.get(nameCacheKey);
    if (cached) {
      linking.linkedByName++;
      return cached;
    }

    // Lookup by name (case-insensitive)
    const nameMatches = await db
      .select({ id: companies.id, name: companies.name })
      .from(companies)
      .where(ilike(companies.name, `%${normalizedName}%`))
      .limit(5);

    const exactMatches = nameMatches.filter(
      (m) => normalizeCompanyName(m.name) === normalizedName
    );

    if (exactMatches.length === 1) {
      cache.set(nameCacheKey, exactMatches[0].id);
      linking.linkedByName++;
      await fillCompanyGaps(exactMatches[0].id);
      return exactMatches[0].id;
    }

    if (exactMatches.length > 1) {
      linking.ambiguousMatches++;
      return null;
    }

    // No match found — create company by name (without domain)
    try {
      const payload = buildCompanyPayload(companyData.name);
      const newCompany = await createCompany(payload, userId);
      cache.set(nameCacheKey, newCompany.id);
      linking.companiesCreated++;
      return newCompany.id;
    } catch {
      // Creation failed — skip linking
      linking.noCompanyInfo++;
      return null;
    }
  }

  linking.noCompanyInfo++;
  return null;
}

/**
 * Write custom field values for a newly created/updated entity.
 * Looks for cf_* keys in the row data and writes typed values using setFieldValue.
 */
async function writeCustomFieldValues(
  entityId: string,
  data: Record<string, unknown>,
  customFieldMap: Record<string, CustomFieldMapEntry>
): Promise<void> {
  for (const [key, rawValue] of Object.entries(data)) {
    if (!key.startsWith("cf_") || !rawValue) continue;
    const fieldInfo = customFieldMap[key];
    if (!fieldInfo) continue;

    const strValue = String(rawValue).trim();
    if (!strValue) continue;

    try {
      const typedValue = coerceCustomFieldValue(strValue, fieldInfo.fieldType);
      await setFieldValue(fieldInfo.fieldDefinitionId, entityId, typedValue);
    } catch {
      // Non-critical — skip this field value silently
    }
  }
}

/**
 * Coerce a string CSV value to the correct typed value based on field type.
 */
function coerceCustomFieldValue(
  value: string,
  fieldType: string
): { textValue?: string; numberValue?: string; dateValue?: Date; booleanValue?: boolean } {
  switch (fieldType) {
    case "text":
    case "url":
    case "email":
    case "select":
      return { textValue: value };

    case "multi_select":
      // Store as JSON array of trimmed values
      return { textValue: JSON.stringify(value.split(",").map((s) => s.trim())) };

    case "number":
    case "currency": {
      // Strip currency symbols and commas
      const cleaned = value.replace(/[$€£¥,\s]/g, "");
      const num = parseFloat(cleaned);
      return { numberValue: isNaN(num) ? undefined : String(num) };
    }

    case "date": {
      const date = new Date(value);
      return isNaN(date.getTime()) ? { textValue: value } : { dateValue: date };
    }

    case "boolean": {
      const lower = value.toLowerCase();
      const truthy = lower === "true" || lower === "1" || lower === "yes" || lower === "y";
      return { booleanValue: truthy };
    }

    default:
      return { textValue: value };
  }
}

async function updateProgress(jobId: string, processedRows: number): Promise<void> {
  await db
    .update(importJobs)
    .set({ processedRows })
    .where(eq(importJobs.id, jobId));
}
