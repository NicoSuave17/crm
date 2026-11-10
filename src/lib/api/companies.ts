import { db } from "@/lib/db";
import { companies, contacts, users, contactCompanies, companyTags, tags } from "@/lib/db/schema";
import { eq, ilike, or, and, sql, desc, asc, isNull, inArray, type AnyColumn, type SQL } from "drizzle-orm";
import type { CreateCompanyInput, UpdateCompanyInput } from "@/lib/validators/company";
import { normalizeDomain } from "@/lib/utils/normalize";

export interface CompanyListParams {
  page?: number;
  limit?: number;
  search?: string;
  industry?: string;
  size?: string;
  vertical?: string;
  ownerId?: string;
  ownerIds?: string[];
  tagId?: string;
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
    vertical,
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

  if (vertical) {
    conditions.push(eq(companies.vertical, vertical as typeof companies.vertical.enumValues[number]));
  }

  const needsTagJoin = !!params.tagId;
  if (params.tagId) {
    conditions.push(eq(companyTags.tagId, params.tagId));
  }

  if (ownerId === "unassigned") {
    conditions.push(isNull(companies.ownerId));
  } else if (ownerId) {
    conditions.push(eq(companies.ownerId, ownerId));
  } else if (params.ownerIds && params.ownerIds.length > 0) {
    conditions.push(inArray(companies.ownerId, params.ownerIds));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const sortableColumns: Record<string, AnyColumn> = {
    createdAt: companies.createdAt,
    updatedAt: companies.updatedAt,
    name: companies.name,
  };
  const sortColumn = sortableColumns[sortBy] ?? companies.createdAt;
  const orderFn = sortDir === "asc" ? asc : desc;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let dataQuery: any = db
    .select({
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
      ownerFirstName: users.firstName,
      ownerLastName: users.lastName,
      createdAt: companies.createdAt,
      updatedAt: companies.updatedAt,
    })
    .from(companies)
    .leftJoin(users, eq(companies.ownerId, users.id));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let countQuery: any = db
    .select({ count: sql<number>`count(DISTINCT ${companies.id})` })
    .from(companies);

  if (needsTagJoin) {
    dataQuery = dataQuery.innerJoin(companyTags, eq(companies.id, companyTags.companyId));
    countQuery = countQuery.innerJoin(companyTags, eq(companies.id, companyTags.companyId));
  }

  const [data, countResult] = await Promise.all([
    dataQuery
      .where(where)
      .orderBy(orderFn(sortColumn))
      .limit(limit)
      .offset(offset),
    countQuery
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

  // Get tags
  const companyTagsList = await db
    .select({ id: tags.id, name: tags.name, color: tags.color })
    .from(companyTags)
    .innerJoin(tags, eq(companyTags.tagId, tags.id))
    .where(eq(companyTags.companyId, id));

  return { ...company, owner, contactCount: Number(countResult.count), tags: companyTagsList };
}

export async function createCompany(data: CreateCompanyInput, userId?: string) {
  const { generateCrmId } = await import("@/lib/db/crm-id");
  const crmId = await generateCrmId("company");

  const [company] = await db
    .insert(companies)
    .values({
      ...data,
      crmId,
      domain: normalizeDomain(data.domain) ?? null,
      linkedinUrl: data.linkedinUrl || null,
      websiteUrl: data.websiteUrl || null,
      ownerId: data.ownerId || null,
    })
    .returning();

  if (userId) {
    const { recordAudit } = await import("./record-audit");
    await recordAudit({
      entityType: "company",
      entityId: company.id,
      action: "create",
      userId,
      snapshot: company as unknown as Record<string, unknown>,
    });
  }

  return company;
}

export async function updateCompany(id: string, data: UpdateCompanyInput, userId?: string) {
  const [oldCompany] = await db.select().from(companies).where(eq(companies.id, id)).limit(1);

  const [company] = await db
    .update(companies)
    .set({
      ...data,
      domain: data.domain !== undefined ? normalizeDomain(data.domain) ?? null : undefined,
      linkedinUrl: data.linkedinUrl !== undefined ? data.linkedinUrl || null : undefined,
      websiteUrl: data.websiteUrl !== undefined ? data.websiteUrl || null : undefined,
      ownerId: data.ownerId !== undefined ? data.ownerId || null : undefined,
      updatedAt: new Date(),
    })
    .where(eq(companies.id, id))
    .returning();

  // Cascade ownership to linked contacts when company owner changes
  if (oldCompany && data.ownerId !== undefined && oldCompany.ownerId !== data.ownerId) {
    const linkedContactIds = await db
      .select({ id: contactCompanies.contactId })
      .from(contactCompanies)
      .where(eq(contactCompanies.companyId, id));

    if (linkedContactIds.length > 0) {
      const ids = linkedContactIds.map((c) => c.id);
      // Only update contacts that have no owner or still have the old company owner
      const ownerConditions = oldCompany.ownerId
        ? or(isNull(contacts.ownerId), eq(contacts.ownerId, oldCompany.ownerId))
        : isNull(contacts.ownerId);

      await db
        .update(contacts)
        .set({ ownerId: data.ownerId || null, updatedAt: new Date() })
        .where(and(inArray(contacts.id, ids), ownerConditions));
    }
  }

  if (oldCompany && userId) {
    const { recordFieldChanges } = await import("./change-history");
    await recordFieldChanges("company", id, oldCompany as Record<string, unknown>, data as Record<string, unknown>, userId);

    const { recordAudit, diffChanges } = await import("./record-audit");
    const changes = diffChanges(oldCompany as Record<string, unknown>, data as Record<string, unknown>);
    if (changes) {
      await recordAudit({
        entityType: "company",
        entityId: id,
        action: "update",
        userId,
        changes,
      });
    }
  }

  return company ?? null;
}

export async function deleteCompany(id: string, userId?: string) {
  const [existing] = await db.select().from(companies).where(eq(companies.id, id)).limit(1);

  await db.delete(companies).where(eq(companies.id, id));

  if (existing && userId) {
    const { recordAudit } = await import("./record-audit");
    await recordAudit({
      entityType: "company",
      entityId: id,
      action: "delete",
      userId,
      snapshot: existing as unknown as Record<string, unknown>,
    });
  }
}
