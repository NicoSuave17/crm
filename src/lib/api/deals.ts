import { db } from "@/lib/db";
import {
  deals,
  contacts,
  companies,
  users,
  pipelineStages,
  pipelines,
  activities,
  dealStageHistory,
  stageChecklists,
  dealChecklistItems,
} from "@/lib/db/schema";
import { eq, and, desc, isNull, inArray, asc, type SQL } from "drizzle-orm";
import type { CreateDealInput, UpdateDealInput } from "@/lib/validators/deal";
import { getDealTags } from "@/lib/api/tags";
import { initializeDealChecklist } from "@/lib/api/checklists";

// ─── Checklist Exit Gate ─────────────────────────────────────
// Validates that all required checklist items for a stage are completed
// before allowing a deal to leave that stage.

export class ChecklistIncompleteError extends Error {
  code = "CHECKLIST_INCOMPLETE" as const;
  items: { id: string; title: string }[];

  constructor(items: { id: string; title: string }[]) {
    super(`Required checklist items incomplete: ${items.map((i) => i.title).join(", ")}`);
    this.items = items;
    this.name = "ChecklistIncompleteError";
  }
}

async function validateChecklistExitGate(dealId: string, currentStageId: string) {
  // Get all checklist items for the current stage
  const checklistDefs = await db
    .select()
    .from(stageChecklists)
    .where(eq(stageChecklists.stageId, currentStageId))
    .orderBy(asc(stageChecklists.position));

  // Filter to required items only
  const requiredItems = checklistDefs.filter((item) => item.isRequired);
  if (requiredItems.length === 0) return; // No required items, pass

  // Get completed items for this deal
  const completedItems = await db
    .select()
    .from(dealChecklistItems)
    .where(
      and(
        eq(dealChecklistItems.dealId, dealId)
      )
    );

  const completedChecklistIds = new Set(
    completedItems
      .filter((item) => item.completedAt !== null)
      .map((item) => item.checklistId)
  );

  const incompleteItems = requiredItems.filter(
    (item) => !completedChecklistIds.has(item.id)
  );

  if (incompleteItems.length > 0) {
    throw new ChecklistIncompleteError(
      incompleteItems.map((item) => ({ id: item.id, title: item.title }))
    );
  }
}

export async function listDealsByPipeline(pipelineId: string) {
  const data = await db
    .select({
      id: deals.id,
      crmId: deals.crmId,
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

export async function listDeals(params: { ownerId?: string; ownerIds?: string[]; contactId?: string; companyId?: string } = {}) {
  const conditions: SQL[] = [];
  if (params.ownerId === "unassigned") {
    conditions.push(isNull(deals.ownerId));
  } else if (params.ownerId) {
    conditions.push(eq(deals.ownerId, params.ownerId));
  } else if (params.ownerIds && params.ownerIds.length > 0) {
    conditions.push(inArray(deals.ownerId, params.ownerIds));
  }
  if (params.contactId) conditions.push(eq(deals.contactId, params.contactId));
  if (params.companyId) conditions.push(eq(deals.companyId, params.companyId));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  return db
    .select({
      id: deals.id,
      crmId: deals.crmId,
      title: deals.title,
      stageId: deals.stageId,
      stageName: pipelineStages.name,
      stageColor: pipelineStages.color,
      pipelineId: deals.pipelineId,
      pipelineName: pipelines.name,
      contactId: deals.contactId,
      contactFirstName: contacts.firstName,
      contactLastName: contacts.lastName,
      companyId: deals.companyId,
      companyName: companies.name,
      ownerId: deals.ownerId,
      ownerFirstName: users.firstName,
      ownerLastName: users.lastName,
      value: deals.value,
      expectedMrr: deals.expectedMrr,
      priority: deals.priority,
      expectedCloseDate: deals.expectedCloseDate,
      createdAt: deals.createdAt,
      updatedAt: deals.updatedAt,
    })
    .from(deals)
    .innerJoin(pipelineStages, eq(deals.stageId, pipelineStages.id))
    .innerJoin(pipelines, eq(deals.pipelineId, pipelines.id))
    .innerJoin(contacts, eq(deals.contactId, contacts.id))
    .leftJoin(companies, eq(deals.companyId, companies.id))
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
      crmId: deals.crmId,
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

  if (!deal) return null;

  const dealTagsList = await getDealTags(id);

  return { ...deal, tags: dealTagsList };
}

export async function createDeal(data: CreateDealInput, ownerId: string) {
  const { generateCrmId } = await import("@/lib/db/crm-id");
  const crmId = await generateCrmId("deal");

  const [deal] = await db
    .insert(deals)
    .values({
      ...data,
      crmId,
      ownerId: data.ownerId || ownerId,
      value: data.value || null,
      expectedMrr: data.expectedMrr || null,
      expectedCloseDate: data.expectedCloseDate || null,
      companyId: data.companyId || null,
    })
    .returning();

  // Record initial stage in history
  await db.insert(dealStageHistory).values({
    dealId: deal.id,
    fromStageId: null,
    toStageId: data.stageId,
    userId: ownerId,
  });

  // Log activity
  await db.insert(activities).values({
    type: "deal_stage_change",
    subject: `Deal created: ${data.title}`,
    contactId: data.contactId,
    dealId: deal.id,
    userId: ownerId,
  });

  // Audit: record creation
  const { recordAudit } = await import("./record-audit");
  await recordAudit({
    entityType: "deal",
    entityId: deal.id,
    action: "create",
    userId: ownerId,
    snapshot: deal as unknown as Record<string, unknown>,
  });

  return deal;
}

export async function updateDeal(id: string, data: UpdateDealInput, userId?: string) {
  // Get old values for change history
  const existing = await getDeal(id);

  // If stageId is being changed, validate checklist exit gate first
  if (data.stageId && existing && existing.stageId !== data.stageId) {
    await validateChecklistExitGate(id, existing.stageId);

    await db.insert(dealStageHistory).values({
      dealId: id,
      fromStageId: existing.stageId,
      toStageId: data.stageId,
      userId: userId ?? null,
    });

    // Auto-set closedAt and actualCloseDate when moving to won/lost stage
    const [newStage] = await db
      .select({ isWon: pipelineStages.isWon, isLost: pipelineStages.isLost })
      .from(pipelineStages)
      .where(eq(pipelineStages.id, data.stageId))
      .limit(1);

    if (newStage && (newStage.isWon || newStage.isLost)) {
      const now = new Date();
      if (!data.actualCloseDate) {
        (data as Record<string, unknown>).actualCloseDate = now.toISOString().slice(0, 10);
      }
      (data as Record<string, unknown>).closedAt = now;
    }
  }

  const [deal] = await db
    .update(deals)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(deals.id, id))
    .returning();

  // Record field changes
  if (existing && userId) {
    const { recordFieldChanges } = await import("./change-history");
    await recordFieldChanges("deal", id, existing as Record<string, unknown>, data as Record<string, unknown>, userId);

    const { recordAudit, diffChanges } = await import("./record-audit");
    const changes = diffChanges(existing as Record<string, unknown>, data as Record<string, unknown>);
    if (changes) {
      await recordAudit({
        entityType: "deal",
        entityId: id,
        action: "update",
        userId,
        changes,
      });
    }
  }

  return deal;
}

export async function moveDeal(
  id: string,
  stageId: string,
  userId: string
) {
  const existing = await getDeal(id);
  if (!existing) return null;

  // Validate checklist exit gate before allowing stage change
  if (existing.stageId !== stageId) {
    await validateChecklistExitGate(id, existing.stageId);
  }

  const [deal] = await db
    .update(deals)
    .set({ stageId, updatedAt: new Date() })
    .where(eq(deals.id, id))
    .returning();

  // Record stage transition in history
  await db.insert(dealStageHistory).values({
    dealId: id,
    fromStageId: existing.stageId,
    toStageId: stageId,
    userId,
  });

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

  // Auto-initialize checklist items for the new stage
  await initializeDealChecklist(id, stageId);

  // Audit: record stage change
  const { recordAudit } = await import("./record-audit");
  await recordAudit({
    entityType: "deal",
    entityId: id,
    action: "stage_change",
    userId,
    changes: { stageId: { from: existing.stageId, to: stageId } },
  });

  return deal;
}

export async function getStageHistory(dealId: string) {
  // Use aliased subqueries to resolve stage names
  const rows = await db
    .select({
      id: dealStageHistory.id,
      dealId: dealStageHistory.dealId,
      fromStageId: dealStageHistory.fromStageId,
      toStageId: dealStageHistory.toStageId,
      userId: dealStageHistory.userId,
      changedAt: dealStageHistory.changedAt,
    })
    .from(dealStageHistory)
    .where(eq(dealStageHistory.dealId, dealId))
    .orderBy(desc(dealStageHistory.changedAt));

  // Resolve stage names in a second query
  const stageIds = new Set<string>();
  for (const row of rows) {
    if (row.fromStageId) stageIds.add(row.fromStageId);
    stageIds.add(row.toStageId);
  }

  if (stageIds.size === 0) return rows.map((r) => ({ ...r, fromStageName: null, fromStageColor: null, toStageName: null, toStageColor: null }));

  const stages = await db
    .select({ id: pipelineStages.id, name: pipelineStages.name, color: pipelineStages.color })
    .from(pipelineStages);

  const stageMap = new Map(stages.map((s) => [s.id, s]));

  return rows.map((row) => ({
    ...row,
    fromStageName: row.fromStageId ? stageMap.get(row.fromStageId)?.name ?? null : null,
    fromStageColor: row.fromStageId ? stageMap.get(row.fromStageId)?.color ?? null : null,
    toStageName: stageMap.get(row.toStageId)?.name ?? null,
    toStageColor: stageMap.get(row.toStageId)?.color ?? null,
  }));
}

export async function deleteDeal(id: string, userId?: string) {
  const [existing] = await db.select().from(deals).where(eq(deals.id, id)).limit(1);

  await db.delete(deals).where(eq(deals.id, id));

  if (existing && userId) {
    const { recordAudit } = await import("./record-audit");
    await recordAudit({
      entityType: "deal",
      entityId: id,
      action: "delete",
      userId,
      snapshot: existing as unknown as Record<string, unknown>,
    });
  }
}
