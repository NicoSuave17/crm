import { db } from "@/lib/db";
import {
  stageChecklists,
  dealChecklistItems,
} from "@/lib/db/schema";
import { eq, and, asc, inArray } from "drizzle-orm";
import type {
  CreateChecklistInput,
  UpdateChecklistInput,
} from "@/lib/validators/checklist";

// ─── Stage Checklist Definitions ───────────────────────────────

export async function getStageChecklists(stageId: string) {
  return db
    .select()
    .from(stageChecklists)
    .where(eq(stageChecklists.stageId, stageId))
    .orderBy(asc(stageChecklists.position));
}

export async function createStageChecklist(data: CreateChecklistInput) {
  // If no position given, append at end
  if (data.position === undefined) {
    const existing = await db
      .select({ position: stageChecklists.position })
      .from(stageChecklists)
      .where(eq(stageChecklists.stageId, data.stageId))
      .orderBy(asc(stageChecklists.position));
    data.position = existing.length > 0 ? existing[existing.length - 1].position + 1 : 0;
  }

  const [item] = await db
    .insert(stageChecklists)
    .values(data)
    .returning();
  return item;
}

export async function updateStageChecklist(
  id: string,
  data: UpdateChecklistInput
) {
  const [item] = await db
    .update(stageChecklists)
    .set(data)
    .where(eq(stageChecklists.id, id))
    .returning();
  return item ?? null;
}

export async function deleteStageChecklist(id: string) {
  await db.delete(stageChecklists).where(eq(stageChecklists.id, id));
}

// ─── Deal Checklist Items ──────────────────────────────────────

export async function getDealChecklistStatus(dealId: string, stageId: string) {
  // Get all checklist definitions for the stage
  const definitions = await getStageChecklists(stageId);
  if (definitions.length === 0) return [];

  // Get completed items for this deal
  const completedItems = await db
    .select()
    .from(dealChecklistItems)
    .where(eq(dealChecklistItems.dealId, dealId));

  const completedMap = new Map(
    completedItems.map((item) => [item.checklistId, item])
  );

  return definitions.map((def) => {
    const completed = completedMap.get(def.id);
    return {
      checklistId: def.id,
      title: def.title,
      description: def.description,
      position: def.position,
      completed: !!completed?.completedAt,
      completedAt: completed?.completedAt ?? null,
      completedBy: completed?.completedBy ?? null,
    };
  });
}

export async function toggleChecklistItem(
  dealId: string,
  checklistId: string,
  userId: string,
  completed: boolean
) {
  if (completed) {
    // Mark as completed — upsert
    const [item] = await db
      .insert(dealChecklistItems)
      .values({
        dealId,
        checklistId,
        completedAt: new Date(),
        completedBy: userId,
      })
      .onConflictDoUpdate({
        target: [dealChecklistItems.dealId, dealChecklistItems.checklistId],
        set: {
          completedAt: new Date(),
          completedBy: userId,
        },
      })
      .returning();
    return item;
  } else {
    // Uncheck — set completedAt to null
    const [item] = await db
      .update(dealChecklistItems)
      .set({ completedAt: null, completedBy: null })
      .where(
        and(
          eq(dealChecklistItems.dealId, dealId),
          eq(dealChecklistItems.checklistId, checklistId)
        )
      )
      .returning();
    return item ?? null;
  }
}

export async function initializeDealChecklist(
  dealId: string,
  stageId: string
) {
  const definitions = await getStageChecklists(stageId);
  if (definitions.length === 0) return;

  // Insert rows for each checklist item (skip if already exists)
  await db
    .insert(dealChecklistItems)
    .values(
      definitions.map((def) => ({
        dealId,
        checklistId: def.id,
      }))
    )
    .onConflictDoNothing();
}

/**
 * Get checklist progress for multiple deals (for kanban cards).
 * Returns a map of dealId → { completed, total }.
 */
export async function getDealChecklistProgress(dealIds: string[]) {
  if (dealIds.length === 0) return new Map<string, { completed: number; total: number }>();

  const items = await db
    .select({
      dealId: dealChecklistItems.dealId,
      completedAt: dealChecklistItems.completedAt,
    })
    .from(dealChecklistItems)
    .where(inArray(dealChecklistItems.dealId, dealIds));

  const result = new Map<string, { completed: number; total: number }>();
  for (const item of items) {
    const entry = result.get(item.dealId) ?? { completed: 0, total: 0 };
    entry.total++;
    if (item.completedAt) entry.completed++;
    result.set(item.dealId, entry);
  }

  return result;
}
