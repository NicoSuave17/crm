import { db } from "@/lib/db";
import {
  deals,
  contacts,
  companies,
  users,
  pipelineStages,
  pipelines,
  activities,
} from "@/lib/db/schema";
import { eq, and, desc, type SQL } from "drizzle-orm";
import type { CreateDealInput, UpdateDealInput } from "@/lib/validators/deal";

export async function listDealsByPipeline(pipelineId: string) {
  const data = await db
    .select({
      id: deals.id,
      title: deals.title,
      description: deals.description,
      pipelineId: deals.pipelineId,
      stageId: deals.stageId,
      stageName: pipelineStages.name,
      stagePosition: pipelineStages.position,
      stageColor: pipelineStages.color,
      contactId: deals.contactId,
      contactFirstName: contacts.firstName,
      contactLastName: contacts.lastName,
      contactAvatarUrl: contacts.avatarUrl,
      ownerId: deals.ownerId,
      ownerFirstName: users.firstName,
      ownerLastName: users.lastName,
      value: deals.value,
      currency: deals.currency,
      expectedMrr: deals.expectedMrr,
      expectedCloseDate: deals.expectedCloseDate,
      priority: deals.priority,
      createdAt: deals.createdAt,
      updatedAt: deals.updatedAt,
    })
    .from(deals)
    .innerJoin(pipelineStages, eq(deals.stageId, pipelineStages.id))
    .innerJoin(contacts, eq(deals.contactId, contacts.id))
    .leftJoin(users, eq(deals.ownerId, users.id))
    .where(eq(deals.pipelineId, pipelineId))
    .orderBy(desc(deals.createdAt));

  return data;
}

export async function listDeals(params: { ownerId?: string; contactId?: string } = {}) {
  const conditions: SQL[] = [];
  if (params.ownerId) conditions.push(eq(deals.ownerId, params.ownerId));
  if (params.contactId) conditions.push(eq(deals.contactId, params.contactId));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  return db
    .select({
      id: deals.id,
      title: deals.title,
      stageId: deals.stageId,
      stageName: pipelineStages.name,
      stageColor: pipelineStages.color,
      pipelineId: deals.pipelineId,
      pipelineName: pipelines.name,
      contactId: deals.contactId,
      contactFirstName: contacts.firstName,
      contactLastName: contacts.lastName,
      ownerId: deals.ownerId,
      ownerFirstName: users.firstName,
      ownerLastName: users.lastName,
      value: deals.value,
      priority: deals.priority,
      expectedCloseDate: deals.expectedCloseDate,
      createdAt: deals.createdAt,
    })
    .from(deals)
    .innerJoin(pipelineStages, eq(deals.stageId, pipelineStages.id))
    .innerJoin(pipelines, eq(deals.pipelineId, pipelines.id))
    .innerJoin(contacts, eq(deals.contactId, contacts.id))
    .leftJoin(users, eq(deals.ownerId, users.id))
    .where(where)
    .orderBy(desc(deals.createdAt));
}

export async function getDeal(id: string) {
  const [deal] = await db
    .select()
    .from(deals)
    .where(eq(deals.id, id))
    .limit(1);
  return deal ?? null;
}

export async function getDealWithRelations(id: string) {
  const [deal] = await db
    .select({
      id: deals.id,
      title: deals.title,
      description: deals.description,
      pipelineId: deals.pipelineId,
      stageId: deals.stageId,
      contactId: deals.contactId,
      companyId: deals.companyId,
      ownerId: deals.ownerId,
      value: deals.value,
      currency: deals.currency,
      expectedMrr: deals.expectedMrr,
      expectedCloseDate: deals.expectedCloseDate,
      actualCloseDate: deals.actualCloseDate,
      closedAt: deals.closedAt,
      lostReason: deals.lostReason,
      priority: deals.priority,
      createdAt: deals.createdAt,
      updatedAt: deals.updatedAt,
      // Stage
      stageName: pipelineStages.name,
      stageColor: pipelineStages.color,
      stageIsWon: pipelineStages.isWon,
      stageIsLost: pipelineStages.isLost,
      stageProbability: pipelineStages.probability,
      // Pipeline
      pipelineName: pipelines.name,
      // Contact
      contactFirstName: contacts.firstName,
      contactLastName: contacts.lastName,
      contactAvatarUrl: contacts.avatarUrl,
      contactEmail: contacts.email,
      // Company
      companyName: companies.name,
      companyDomain: companies.domain,
      // Owner
      ownerFirstName: users.firstName,
      ownerLastName: users.lastName,
      ownerAvatarUrl: users.avatarUrl,
    })
    .from(deals)
    .innerJoin(pipelineStages, eq(deals.stageId, pipelineStages.id))
    .innerJoin(pipelines, eq(deals.pipelineId, pipelines.id))
    .innerJoin(contacts, eq(deals.contactId, contacts.id))
    .leftJoin(companies, eq(deals.companyId, companies.id))
    .leftJoin(users, eq(deals.ownerId, users.id))
    .where(eq(deals.id, id))
    .limit(1);

  return deal ?? null;
}

export async function createDeal(data: CreateDealInput, ownerId: string) {
  const [deal] = await db
    .insert(deals)
    .values({
      ...data,
      ownerId,
      value: data.value || null,
      expectedMrr: data.expectedMrr || null,
      expectedCloseDate: data.expectedCloseDate || null,
      companyId: data.companyId || null,
    })
    .returning();

  // Log activity
  await db.insert(activities).values({
    type: "deal_stage_change",
    subject: `Deal created: ${data.title}`,
    contactId: data.contactId,
    dealId: deal.id,
    userId: ownerId,
  });

  return deal;
}

export async function updateDeal(id: string, data: UpdateDealInput) {
  const [deal] = await db
    .update(deals)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(deals.id, id))
    .returning();
  return deal;
}

export async function moveDeal(
  id: string,
  stageId: string,
  userId: string
) {
  const existing = await getDeal(id);
  if (!existing) return null;

  const [deal] = await db
    .update(deals)
    .set({ stageId, updatedAt: new Date() })
    .where(eq(deals.id, id))
    .returning();

  // Log stage change activity
  const [newStage] = await db
    .select({ name: pipelineStages.name })
    .from(pipelineStages)
    .where(eq(pipelineStages.id, stageId))
    .limit(1);

  await db.insert(activities).values({
    type: "deal_stage_change",
    subject: `Moved to ${newStage?.name ?? "unknown stage"}`,
    contactId: existing.contactId,
    dealId: id,
    userId,
  });

  return deal;
}

export async function deleteDeal(id: string) {
  await db.delete(deals).where(eq(deals.id, id));
}
