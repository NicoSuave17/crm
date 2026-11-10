import { db } from "@/lib/db";
import { contacts, users, contactTags, tags, contactCompanies, companies } from "@/lib/db/schema";
import { eq, ilike, or, and, sql, desc, asc, isNull, inArray, type AnyColumn, type SQL } from "drizzle-orm";
import type { CreateContactInput, UpdateContactInput } from "@/lib/validators/contact";

/** Strip a phone string to digits only for dedup matching */
function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 7 ? digits : null;
}

export interface ContactListParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  status?: string;
  vertical?: string;
  ownerId?: string;
  ownerIds?: string[];
  companyId?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

export async function listContacts(params: ContactListParams) {
  const {
    page = 1,
    limit = 25,
    search,
    type,
    status,
    vertical,
    ownerId,
    companyId,
    sortBy = "createdAt",
    sortDir = "desc",
  } = params;

  const offset = (page - 1) * limit;
  const conditions: SQL[] = [];

  if (search) {
    conditions.push(
      or(
        ilike(contacts.firstName, `%${search}%`),
        ilike(contacts.lastName, `%${search}%`),
        ilike(contacts.email, `%${search}%`),
        ilike(contacts.whopUsername, `%${search}%`)
      )!
    );
  }

  if (type) {
    conditions.push(eq(contacts.type, type as typeof contacts.type.enumValues[number]));
  }

  if (status) {
    conditions.push(eq(contacts.status, status as typeof contacts.status.enumValues[number]));
  }

  if (vertical) {
    conditions.push(eq(contacts.vertical, vertical as typeof contacts.vertical.enumValues[number]));
  }

  if (ownerId === "unassigned") {
    conditions.push(isNull(contacts.ownerId));
  } else if (ownerId) {
    conditions.push(eq(contacts.ownerId, ownerId));
  } else if (params.ownerIds && params.ownerIds.length > 0) {
    conditions.push(inArray(contacts.ownerId, params.ownerIds));
  }

  // When filtering by company, we need to join the junction table
  const needsCompanyJoin = !!companyId;
  if (companyId) {
    conditions.push(eq(contactCompanies.companyId, companyId));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const sortableColumns: Record<string, AnyColumn> = {
    createdAt: contacts.createdAt,
    updatedAt: contacts.updatedAt,
    firstName: contacts.firstName,
    healthScore: contacts.healthScore,
    currentGmv: contacts.currentGmv,
  };
  const sortColumn = sortableColumns[sortBy] ?? contacts.createdAt;
  const orderFn = sortDir === "asc" ? asc : desc;

  const selectFields = {
    id: contacts.id,
    crmId: contacts.crmId,
    firstName: contacts.firstName,
    lastName: contacts.lastName,
    email: contacts.email,
    phone: contacts.phone,
    avatarUrl: contacts.avatarUrl,
    type: contacts.type,
    status: contacts.status,
    tier: contacts.tier,
    healthScore: contacts.healthScore,
    currentGmv: contacts.currentGmv,
    currentMrr: contacts.currentMrr,
    memberCount: contacts.memberCount,
    churnRisk: contacts.churnRisk,
    vertical: contacts.vertical,
    ownerId: contacts.ownerId,
    ownerFirstName: users.firstName,
    ownerLastName: users.lastName,
    createdAt: contacts.createdAt,
    updatedAt: contacts.updatedAt,
    companyId: sql<string | null>`(SELECT ${companies.id} FROM ${contactCompanies} INNER JOIN ${companies} ON ${contactCompanies.companyId} = ${companies.id} WHERE ${contactCompanies.contactId} = ${contacts.id} ORDER BY ${contactCompanies.isPrimary} DESC NULLS LAST LIMIT 1)`.as("companyId"),
    companyName: sql<string | null>`(SELECT ${companies.name} FROM ${contactCompanies} INNER JOIN ${companies} ON ${contactCompanies.companyId} = ${companies.id} WHERE ${contactCompanies.contactId} = ${contacts.id} ORDER BY ${contactCompanies.isPrimary} DESC NULLS LAST LIMIT 1)`.as("companyName"),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let dataQuery: any = db.select(selectFields).from(contacts).leftJoin(users, eq(contacts.ownerId, users.id));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let countQuery: any = db.select({ count: sql<number>`count(*)` }).from(contacts);

  if (needsCompanyJoin) {
    dataQuery = dataQuery.innerJoin(contactCompanies, eq(contacts.id, contactCompanies.contactId));
    countQuery = countQuery.innerJoin(contactCompanies, eq(contacts.id, contactCompanies.contactId));
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

export async function getContact(id: string) {
  const [contact] = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, id))
    .limit(1);

  if (!contact) return null;

  // Get owner info
  let owner = null;
  if (contact.ownerId) {
    const [ownerData] = await db
      .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, avatarUrl: users.avatarUrl })
      .from(users)
      .where(eq(users.id, contact.ownerId))
      .limit(1);
    owner = ownerData ?? null;
  }

  // Get tags
  const contactTagsList = await db
    .select({ id: tags.id, name: tags.name, color: tags.color })
    .from(contactTags)
    .innerJoin(tags, eq(contactTags.tagId, tags.id))
    .where(eq(contactTags.contactId, id));

  return { ...contact, owner, tags: contactTagsList };
}

export async function createContact(data: CreateContactInput, userId?: string) {
  const { generateCrmId } = await import("@/lib/db/crm-id");
  const crmId = await generateCrmId("contact");

  const [contact] = await db
    .insert(contacts)
    .values({
      ...data,
      crmId,
      email: data.email || null,
      phone: data.phone || null,
      normalizedPhone: normalizePhone(data.phone),
      linkedinUrl: data.linkedinUrl || null,
      twitterUrl: data.twitterUrl || null,
      websiteUrl: data.websiteUrl || null,
    })
    .returning();

  // Audit: record creation
  if (userId) {
    const { recordAudit } = await import("./record-audit");
    await recordAudit({
      entityType: "contact",
      entityId: contact.id,
      action: "create",
      userId,
      snapshot: contact as unknown as Record<string, unknown>,
    });
  }

  return contact;
}



export async function updateContact(id: string, data: UpdateContactInput, userId?: string) {
  // Get old values for change history
  const [oldContact] = await db.select().from(contacts).where(eq(contacts.id, id)).limit(1);

  const [contact] = await db
    .update(contacts)
    .set({
      ...data,
      email: data.email || null,
      ...(data.phone !== undefined ? { normalizedPhone: normalizePhone(data.phone) } : {}),
      linkedinUrl: data.linkedinUrl || null,
      twitterUrl: data.twitterUrl || null,
      websiteUrl: data.websiteUrl || null,
      updatedAt: new Date(),
    })
    .where(eq(contacts.id, id))
    .returning();

  // Record field changes
  if (oldContact && userId) {
    const { recordFieldChanges } = await import("./change-history");
    await recordFieldChanges("contact", id, oldContact as Record<string, unknown>, data as Record<string, unknown>, userId);

    // Audit: record update with diff
    const { recordAudit, diffChanges } = await import("./record-audit");
    const changes = diffChanges(oldContact as Record<string, unknown>, data as Record<string, unknown>);
    if (changes) {
      await recordAudit({
        entityType: "contact",
        entityId: id,
        action: "update",
        userId,
        changes,
      });
    }
  }

  return contact;
}

/**
 * Batch-insert contacts with pre-generated CRM IDs.
 * Used by the import processor for efficient bulk creation.
 */
export async function bulkCreateContacts(
  rows: CreateContactInput[],
  userId?: string
): Promise<{ created: number; ids: string[] }> {
  if (rows.length === 0) return { created: 0, ids: [] };

  const { generateCrmIdBatch } = await import("@/lib/db/crm-id");
  const crmIds = await generateCrmIdBatch("contact", rows.length);

  const values = rows.map((data, i) => ({
    ...data,
    crmId: crmIds[i],
    email: data.email || null,
    phone: data.phone || null,
    normalizedPhone: normalizePhone(data.phone),
    linkedinUrl: data.linkedinUrl || null,
    twitterUrl: data.twitterUrl || null,
    websiteUrl: data.websiteUrl || null,
  }));

  const inserted = await db.insert(contacts).values(values).returning({ id: contacts.id });

  if (userId) {
    const { logAuditEvent } = await import("./audit-log");
    await logAuditEvent(userId, {
      action: "bulk_import",
      entityType: "contact",
      entityId: "bulk",
      metadata: { count: inserted.length },
    });
  }

  return { created: inserted.length, ids: inserted.map((r) => r.id) };
}

export async function deleteContact(id: string, userId?: string) {
  // Snapshot before delete for audit trail
  const [existing] = await db.select().from(contacts).where(eq(contacts.id, id)).limit(1);

  await db.delete(contacts).where(eq(contacts.id, id));

  if (existing && userId) {
    const { recordAudit } = await import("./record-audit");
    await recordAudit({
      entityType: "contact",
      entityId: id,
      action: "delete",
      userId,
      snapshot: existing as unknown as Record<string, unknown>,
    });
  }
}
