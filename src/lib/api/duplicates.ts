import { db } from "@/lib/db";
import { contacts, companies, contactCompanies } from "@/lib/db/schema";
import { eq, or, and, ilike, sql, ne } from "drizzle-orm";
import { normalizeDomain, normalizeCompanyName } from "@/lib/utils/normalize";

interface DuplicateMatch<T> {
  record: T;
  confidence: number;
  matchReason: string;
}

interface ContactForMatch {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
}

interface CompanyForMatch {
  id: string;
  name: string;
  domain: string | null;
}

/**
 * Find potential duplicate contacts based on email, phone, or name similarity.
 */
export async function findDuplicateContacts(data: {
  email?: string | null;
  phone?: string | null;
  firstName: string;
  lastName?: string | null;
  excludeId?: string;
}): Promise<DuplicateMatch<ContactForMatch>[]> {
  const matches: DuplicateMatch<ContactForMatch>[] = [];
  const seenIds = new Set<string>();

  // 1. Exact email match (highest confidence)
  if (data.email) {
    const emailMatches = await db
      .select({
        id: contacts.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        email: contacts.email,
        phone: contacts.phone,
      })
      .from(contacts)
      .where(
        data.excludeId
          ? and(eq(contacts.email, data.email), ne(contacts.id, data.excludeId))
          : eq(contacts.email, data.email)
      )
      .limit(5);

    for (const match of emailMatches) {
      if (!seenIds.has(match.id)) {
        seenIds.add(match.id);
        matches.push({ record: match, confidence: 95, matchReason: "Exact email match" });
      }
    }
  }

  // 2. Normalized phone match
  if (data.phone) {
    const normalizedPhone = data.phone.replace(/\D/g, "");
    if (normalizedPhone.length >= 7) {
      const phoneMatches = await db
        .select({
          id: contacts.id,
          firstName: contacts.firstName,
          lastName: contacts.lastName,
          email: contacts.email,
          phone: contacts.phone,
        })
        .from(contacts)
        .where(
          data.excludeId
            ? and(eq(contacts.normalizedPhone, normalizedPhone), ne(contacts.id, data.excludeId))
            : eq(contacts.normalizedPhone, normalizedPhone)
        )
        .limit(5);

      for (const match of phoneMatches) {
        if (!seenIds.has(match.id)) {
          seenIds.add(match.id);
          matches.push({ record: match, confidence: 85, matchReason: "Exact phone match" });
        }
      }
    }
  }

  // 3. Fuzzy name match (firstName + lastName)
  if (data.firstName && data.lastName) {
    const nameMatches = await db
      .select({
        id: contacts.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        email: contacts.email,
        phone: contacts.phone,
      })
      .from(contacts)
      .where(
        data.excludeId
          ? and(
              ilike(contacts.firstName, data.firstName),
              ilike(contacts.lastName, data.lastName),
              ne(contacts.id, data.excludeId)
            )
          : and(
              ilike(contacts.firstName, data.firstName),
              ilike(contacts.lastName, data.lastName)
            )
      )
      .limit(5);

    for (const match of nameMatches) {
      if (!seenIds.has(match.id)) {
        seenIds.add(match.id);
        matches.push({ record: match, confidence: 60, matchReason: "Same first and last name" });
      }
    }
  }

  return matches.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Find potential duplicate companies based on normalized domain or name.
 */
export async function findDuplicateCompanies(data: {
  name: string;
  domain?: string | null;
  excludeId?: string;
}): Promise<DuplicateMatch<CompanyForMatch>[]> {
  const matches: DuplicateMatch<CompanyForMatch>[] = [];
  const seenIds = new Set<string>();

  // 1. Normalized domain match (highest confidence)
  const normalizedDomain = normalizeDomain(data.domain);
  if (normalizedDomain) {
    const domainMatches = await db
      .select({
        id: companies.id,
        name: companies.name,
        domain: companies.domain,
      })
      .from(companies)
      .where(
        data.excludeId
          ? and(eq(companies.domain, normalizedDomain), ne(companies.id, data.excludeId))
          : eq(companies.domain, normalizedDomain)
      )
      .limit(5);

    for (const match of domainMatches) {
      if (!seenIds.has(match.id)) {
        seenIds.add(match.id);
        matches.push({ record: match, confidence: 95, matchReason: "Domain match" });
      }
    }
  }

  // 2. Normalized name match — use ilike with the normalized name
  const normalizedName = normalizeCompanyName(data.name);
  if (normalizedName) {
    const nameMatches = await db
      .select({
        id: companies.id,
        name: companies.name,
        domain: companies.domain,
      })
      .from(companies)
      .where(
        data.excludeId
          ? and(ilike(companies.name, `%${normalizedName}%`), ne(companies.id, data.excludeId))
          : ilike(companies.name, `%${normalizedName}%`)
      )
      .limit(10);

    // Filter results by normalized name equality for tighter matching
    for (const match of nameMatches) {
      if (!seenIds.has(match.id) && normalizeCompanyName(match.name) === normalizedName) {
        seenIds.add(match.id);
        matches.push({ record: match, confidence: 70, matchReason: "Name match (normalized)" });
      }
    }
  }

  return matches.sort((a, b) => b.confidence - a.confidence);
}
