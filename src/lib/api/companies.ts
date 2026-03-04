import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema";
import { ilike, or, and, desc, type SQL } from "drizzle-orm";

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
