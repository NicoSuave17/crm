import { db } from "@/lib/db";
import { companies, users, contactCompanies } from "@/lib/db/schema";
import { eq, ilike, or, and, sql, desc, asc, type AnyColumn, type SQL } from "drizzle-orm";
import type { CreateCompanyInput, UpdateCompanyInput } from "@/lib/validators/company";

export interface CompanyListParams {
  page?: number;
  limit?: number;
  search?: string;
  industry?: string;
  size?: string;
  ownerId?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

export async function listCompanies(params: CompanyListParams = {}) {
  const {
    page = 1,
    limit = 25,
    search,
    industry,
    size,
    ownerId,
    sortBy = "createdAt",
    sortDir = "desc",
  } = params;

  const offset = (page - 1) * limit;
  const conditions: SQL[] = [];

  if (search) {
    conditions.push(
      or(
        ilike(companies.name, `%${search}%`),
        ilike(companies.domain, `%${search}%`)
      )!
    );
  }

  if (industry) {
    conditions.push(ilike(companies.industry, `%${industry}%`));
  }

  if (size) {
    conditions.push(eq(companies.size, size as typeof companies.size.enumValues[number]));
  }

  if (ownerId) {
    conditions.push(eq(companies.ownerId, ownerId));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const sortableColumns: Record<string, AnyColumn> = {
    createdAt: companies.createdAt,
    updatedAt: companies.updatedAt,
    name: companies.name,
  };
  const sortColumn = sortableColumns[sortBy] ?? companies.createdAt;
  const orderFn = sortDir === "asc" ? asc : desc;

  const [data, countResult] = await Promise.all([
    db
      .select({
        id: companies.id,
        name: companies.name,
        domain: companies.domain,
        industry: companies.industry,
        size: companies.size,
        description: companies.description,
        linkedinUrl: companies.linkedinUrl,
        websiteUrl: companies.websiteUrl,
        ownerId: companies.ownerId,
        ownerFirstName: users.firstName,
        ownerLastName: users.lastName,
        createdAt: companies.createdAt,
        updatedAt: companies.updatedAt,
      })
      .from(companies)
      .leftJoin(users, eq(companies.ownerId, users.id))
      .where(where)
      .orderBy(orderFn(sortColumn))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(companies)
      .where(where),
  ]);

  return {
    data,
    pagination: {
      page,
      limit,
      total: Number(countResult[0].count),
      totalPages: Math.ceil(Number(countResult[0].count) / limit),
    },
  };
}

export async function getCompany(id: string) {
  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, id))
    .limit(1);

  if (!company) return null;

  // Get owner info
  let owner = null;
  if (company.ownerId) {
    const [ownerData] = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(eq(users.id, company.ownerId))
      .limit(1);
    owner = ownerData ?? null;
  }

  // Get linked contacts count
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(contactCompanies)
    .where(eq(contactCompanies.companyId, id));

  return { ...company, owner, contactCount: Number(countResult.count) };
}

export async function createCompany(data: CreateCompanyInput) {
  const [company] = await db
    .insert(companies)
    .values({
      ...data,
      linkedinUrl: data.linkedinUrl || null,
      websiteUrl: data.websiteUrl || null,
      ownerId: data.ownerId || null,
    })
    .returning();

  return company;
}

export async function updateCompany(id: string, data: UpdateCompanyInput) {
  const [company] = await db
    .update(companies)
    .set({
      ...data,
      linkedinUrl: data.linkedinUrl !== undefined ? data.linkedinUrl || null : undefined,
      websiteUrl: data.websiteUrl !== undefined ? data.websiteUrl || null : undefined,
      ownerId: data.ownerId !== undefined ? data.ownerId || null : undefined,
      updatedAt: new Date(),
    })
    .where(eq(companies.id, id))
    .returning();

  return company ?? null;
}

export async function deleteCompany(id: string) {
  await db.delete(companies).where(eq(companies.id, id));
}
