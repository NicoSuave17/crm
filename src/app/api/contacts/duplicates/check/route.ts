import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { contacts, contactCompanies, companies } from "@/lib/db/schema";
import { inArray, eq, sql } from "drizzle-orm";

const CONTACT_SELECT = {
  id: contacts.id,
  email: contacts.email,
  firstName: contacts.firstName,
  lastName: contacts.lastName,
  phone: contacts.phone,
  type: contacts.type,
  status: contacts.status,
  tier: contacts.tier,
  vertical: contacts.vertical,
  source: contacts.source,
  linkedinUrl: contacts.linkedinUrl,
  twitterUrl: contacts.twitterUrl,
  websiteUrl: contacts.websiteUrl,
  whopUsername: contacts.whopUsername,
  ownerId: contacts.ownerId,
};

/**
 * POST /api/contacts/duplicates/check
 * Bulk duplicate check for import dedup.
 *
 * Accepts:
 *   emails?: string[]                          — exact email match (highest confidence)
 *   linkedinUrls?: string[]                    — exact LinkedIn URL match
 *   nameCompanyPairs?: { firstName: string, lastName?: string, companyName?: string }[]
 *     — match by name + company association (much more reliable than name-only)
 *
 * Returns { duplicates: [...contact, matchedBy: "email"|"linkedin"|"name_company"|"name"] }
 */
export async function POST(request: NextRequest) {
  try {
    await requireUser();
    const body = await request.json();

    const duplicates: Record<string, unknown>[] = [];
    const seenIds = new Set<string>();

    // 1. Match by email (highest confidence)
    if (Array.isArray(body.emails) && body.emails.length > 0) {
      const normalizedEmails = body.emails
        .filter((e: unknown): e is string => typeof e === "string" && e.trim().length > 0)
        .map((e: string) => e.trim().toLowerCase());

      if (normalizedEmails.length > 0) {
        const emailMatches = await db
          .select(CONTACT_SELECT)
          .from(contacts)
          .where(inArray(contacts.email, normalizedEmails));

        for (const m of emailMatches) {
          if (!seenIds.has(m.id)) {
            seenIds.add(m.id);
            duplicates.push({ ...m, matchedBy: "email" });
          }
        }
      }
    }

    // 2. Match by LinkedIn URL (unique identifier)
    if (Array.isArray(body.linkedinUrls) && body.linkedinUrls.length > 0) {
      const normalizedUrls = body.linkedinUrls
        .filter((u: unknown): u is string => typeof u === "string" && u.trim().length > 0)
        .map((u: string) => u.trim().toLowerCase());

      if (normalizedUrls.length > 0) {
        const linkedinMatches = await db
          .select(CONTACT_SELECT)
          .from(contacts)
          .where(inArray(contacts.linkedinUrl, normalizedUrls));

        for (const m of linkedinMatches) {
          if (!seenIds.has(m.id)) {
            seenIds.add(m.id);
            duplicates.push({ ...m, matchedBy: "linkedin" });
          }
        }
      }
    }

    // 3. Match by name + company (reliable without email)
    //    First match contacts by name, then verify they belong to the same company.
    //    Contacts without a company match fall back to name-only (lower confidence).
    if (Array.isArray(body.nameCompanyPairs) && body.nameCompanyPairs.length > 0) {
      const pairs = body.nameCompanyPairs
        .filter((p: { firstName?: string }) =>
          p.firstName && typeof p.firstName === "string" && p.firstName.trim().length > 0
        )
        .map((p: { firstName: string; lastName?: string; companyName?: string }) => ({
          firstName: p.firstName.trim().toLowerCase(),
          lastName: (p.lastName || "").trim().toLowerCase(),
          companyName: (p.companyName || "").trim().toLowerCase(),
        }));

      if (pairs.length > 0) {
        // Batch name lookups — find contacts matching any of the name pairs
        for (let i = 0; i < pairs.length; i += 200) {
          const batch = pairs.slice(i, i + 200);
          const conditions = batch.map(
            (p: { firstName: string; lastName: string }) =>
              p.lastName
                ? sql`(lower(${contacts.firstName}) = ${p.firstName} AND lower(${contacts.lastName}) = ${p.lastName})`
                : sql`(lower(${contacts.firstName}) = ${p.firstName})`
          );

          // Select contacts with their primary company name (if any)
          const nameMatches = await db
            .select({
              ...CONTACT_SELECT,
              companyName: companies.name,
            })
            .from(contacts)
            .leftJoin(
              contactCompanies,
              sql`${contactCompanies.contactId} = ${contacts.id} AND ${contactCompanies.isPrimary} = true`
            )
            .leftJoin(companies, eq(contactCompanies.companyId, companies.id))
            .where(sql`(${sql.join(conditions, sql` OR `)})`)
            .limit(batch.length * 3);

          for (const m of nameMatches) {
            if (seenIds.has(m.id)) continue;

            // Find the CSV pair this contact matches
            const matchingPair = batch.find(
              (p: { firstName: string; lastName: string }) =>
                p.firstName === (m.firstName?.toLowerCase() || "") &&
                (!p.lastName || p.lastName === (m.lastName?.toLowerCase() || ""))
            );
            if (!matchingPair) continue;

            const csvCompany = matchingPair.companyName;
            const crmCompany = (m.companyName || "").toLowerCase();

            if (csvCompany && crmCompany) {
              // Both have company — check if they match
              if (crmCompany.includes(csvCompany) || csvCompany.includes(crmCompany)) {
                seenIds.add(m.id);
                const { companyName: _cn, ...contactData } = m;
                duplicates.push({ ...contactData, matchedBy: "name_company" });
              }
              // Different companies = not a duplicate, skip
            } else if (!csvCompany && !crmCompany) {
              // Neither has company — name-only match (lower confidence, still include)
              seenIds.add(m.id);
              const { companyName: _cn, ...contactData } = m;
              duplicates.push({ ...contactData, matchedBy: "name" });
            } else if (csvCompany && !crmCompany) {
              // CSV has company but CRM doesn't — could be same person, include as name match
              seenIds.add(m.id);
              const { companyName: _cn, ...contactData } = m;
              duplicates.push({ ...contactData, matchedBy: "name" });
            }
            // CRM has company but CSV doesn't — skip to avoid false positives
          }
        }
      }
    }

    return NextResponse.json({ duplicates });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/contacts/duplicates/check error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
