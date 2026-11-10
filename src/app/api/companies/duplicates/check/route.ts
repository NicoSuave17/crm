import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema";
import { eq, ilike, sql } from "drizzle-orm";
import { normalizeDomain, normalizeCompanyName } from "@/lib/utils/normalize";

const COMPANY_SELECT = {
  id: companies.id,
  crmId: companies.crmId,
  name: companies.name,
  domain: companies.domain,
  industry: companies.industry,
  size: companies.size,
  description: companies.description,
  linkedinUrl: companies.linkedinUrl,
  websiteUrl: companies.websiteUrl,
  vertical: companies.vertical,
  ownerId: companies.ownerId,
};

/**
 * POST /api/companies/duplicates/check
 * Batch duplicate check for company imports.
 *
 * Accepts:
 *   companies: { name: string, domain?: string }[]
 *
 * Returns { duplicates: [...company, matchedBy: "domain"|"name", csvIndex: number] }
 */
export async function POST(request: NextRequest) {
  try {
    await requireUser();
    const body = await request.json();

    const duplicates: Record<string, unknown>[] = [];
    const seenIds = new Set<string>();

    const items: { name: string; domain?: string }[] = body.companies || [];

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      if (!item.name && !item.domain) continue;

      // 1. Domain match (highest confidence)
      const normalizedDomain = normalizeDomain(item.domain);
      if (normalizedDomain) {
        const domainMatches = await db
          .select(COMPANY_SELECT)
          .from(companies)
          .where(eq(companies.domain, normalizedDomain))
          .limit(3);

        for (const m of domainMatches) {
          if (!seenIds.has(m.id)) {
            seenIds.add(m.id);
            duplicates.push({ ...m, matchedBy: "domain", csvIndex: idx });
          }
        }
      }

      // 2. Name match (normalized)
      if (item.name) {
        const normalizedName = normalizeCompanyName(item.name);
        if (normalizedName) {
          const nameMatches = await db
            .select(COMPANY_SELECT)
            .from(companies)
            .where(ilike(companies.name, `%${normalizedName}%`))
            .limit(5);

          for (const m of nameMatches) {
            if (!seenIds.has(m.id) && normalizeCompanyName(m.name) === normalizedName) {
              seenIds.add(m.id);
              duplicates.push({ ...m, matchedBy: "name", csvIndex: idx });
            }
          }
        }
      }
    }

    return NextResponse.json({ duplicates });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/companies/duplicates/check error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
