import { db } from "@/lib/db";
import { pipelines, pipelineStages, deals } from "@/lib/db/schema";
import { eq, asc, sql, count } from "drizzle-orm";
import type {
  CreatePipelineInput,
  UpdatePipelineInput,
  CreateStageInput,
  UpdateStageInput,
} from "@/lib/validators/pipeline";

export async function listPipelines() {
  const allPipelines = await db
    .select()
    .from(pipelines)
    .orderBy(asc(pipelines.createdAt));

  // Include stages for each pipeline
  const allStages = await db
    .select()
    .from(pipelineStages)
    .orderBy(asc(pipelineStages.position));

  return allPipelines.map((p) => ({
    ...p,
    stages: allStages.filter((s) => s.pipelineId === p.id),
  }));
}

export async function getPipelineWithStages(id: string) {
  const [pipeline] = await db
    .select()
    .from(pipelines)
    .where(eq(pipelines.id, id))
    .limit(1);

  if (!pipeline) return null;

  const stages = await db
    .select()
    .from(pipelineStages)
    .where(eq(pipelineStages.pipelineId, id))
    .orderBy(asc(pipelineStages.position));

  return { ...pipeline, stages };
}

export async function getDefaultPipeline() {
  const [pipeline] = await db
    .select()
    .from(pipelines)
    .where(eq(pipelines.isDefault, true))
    .limit(1);

  if (pipeline) return pipeline;

  // Return first pipeline if no default
  const [first] = await db
    .select()
    .from(pipelines)
    .orderBy(asc(pipelines.createdAt))
    .limit(1);

  return first ?? null;
}

export async function seedDefaultPipelines() {
  const existing = await db.select().from(pipelines).limit(1);
  if (existing.length > 0) return;

  // Seller Onboarding pipeline
  const [sellerPipeline] = await db
    .insert(pipelines)
    .values({
      name: "Seller Onboarding",
      description: "Pipeline for onboarding new creators and sellers",
      type: "seller_onboarding",
      isDefault: true,
    })
    .returning();

  const sellerStages = [
    { name: "Lead", position: 0, color: "#6B7280", probability: 10 },
    { name: "Qualified", position: 1, color: "#3B82F6", probability: 25 },
    { name: "Demo Scheduled", position: 2, color: "#8B5CF6", probability: 50 },
    { name: "Proposal", position: 3, color: "#F59E0B", probability: 75 },
    { name: "Closed Won", position: 4, color: "#10B981", probability: 100, isWon: true },
    { name: "Closed Lost", position: 5, color: "#EF4444", probability: 0, isLost: true },
  ];

  await db.insert(pipelineStages).values(
    sellerStages.map((s) => ({
      ...s,
      pipelineId: sellerPipeline.id,
      isWon: s.isWon ?? false,
      isLost: s.isLost ?? false,
    }))
  );

  // Enterprise Partnerships pipeline
  const [enterprisePipeline] = await db
    .insert(pipelines)
    .values({
      name: "Enterprise Partnerships",
      description: "Pipeline for enterprise and partnership deals",
      type: "enterprise",
    })
    .returning();

  const enterpriseStages = [
    { name: "Prospect", position: 0, color: "#6B7280", probability: 5 },
    { name: "Discovery", position: 1, color: "#3B82F6", probability: 20 },
    { name: "Evaluation", position: 2, color: "#8B5CF6", probability: 40 },
    { name: "Negotiation", position: 3, color: "#F59E0B", probability: 70 },
    { name: "Closed Won", position: 4, color: "#10B981", probability: 100, isWon: true },
    { name: "Closed Lost", position: 5, color: "#EF4444", probability: 0, isLost: true },
  ];

  await db.insert(pipelineStages).values(
    enterpriseStages.map((s) => ({
      ...s,
      pipelineId: enterprisePipeline.id,
      isWon: s.isWon ?? false,
      isLost: s.isLost ?? false,
    }))
  );
}

// ─── Pipeline CRUD ──────────────────────────────────────────────

export async function createPipeline(data: CreatePipelineInput) {
  const [pipeline] = await db
    .insert(pipelines)
    .values({ ...data, isDefault: false })
    .returning();
  return pipeline;
}

export async function updatePipeline(id: string, data: UpdatePipelineInput) {
  const [updated] = await db
    .update(pipelines)
    .set(data)
    .where(eq(pipelines.id, id))
    .returning();
  return updated ?? null;
}

export async function deletePipeline(id: string) {
  const dealCount = await countDealsByPipeline(id);
  if (dealCount > 0) {
    throw new Error("Cannot delete pipeline with existing deals");
  }
  await db.delete(pipelines).where(eq(pipelines.id, id));
  return { success: true };
}

export async function countDealsByPipeline(pipelineId: string) {
  const [result] = await db
    .select({ count: count() })
    .from(deals)
    .where(eq(deals.pipelineId, pipelineId));
  return result?.count ?? 0;
}

// ─── Stage CRUD ─────────────────────────────────────────────────

export async function createStage(pipelineId: string, data: CreateStageInput) {
  let position = data.position;
  if (position === undefined) {
    const [result] = await db
      .select({ maxPos: sql<number>`coalesce(max(${pipelineStages.position}), -1)` })
      .from(pipelineStages)
      .where(eq(pipelineStages.pipelineId, pipelineId));
    position = (result?.maxPos ?? -1) + 1;
  }

  const [stage] = await db
    .insert(pipelineStages)
    .values({
      name: data.name,
      color: data.color ?? null,
      probability: data.probability ?? null,
      isWon: data.isWon ?? false,
      isLost: data.isLost ?? false,
      position,
      pipelineId,
    })
    .returning();
  return stage;
}

export async function updateStage(stageId: string, data: UpdateStageInput) {
  const [updated] = await db
    .update(pipelineStages)
    .set(data)
    .where(eq(pipelineStages.id, stageId))
    .returning();
  return updated ?? null;
}

export async function deleteStage(stageId: string) {
  const dealCount = await countDealsByStage(stageId);
  if (dealCount > 0) {
    throw new Error("Cannot delete stage with existing deals");
  }

  // Get stage info before deleting (for position re-compaction)
  const [stage] = await db
    .select()
    .from(pipelineStages)
    .where(eq(pipelineStages.id, stageId))
    .limit(1);

  if (!stage) {
    throw new Error("Stage not found");
  }

  await db.delete(pipelineStages).where(eq(pipelineStages.id, stageId));

  // Re-compact positions for remaining stages in the same pipeline
  await db.execute(
    sql`UPDATE pipeline_stages SET position = position - 1 WHERE pipeline_id = ${stage.pipelineId} AND position > ${stage.position}`
  );

  return { success: true };
}

export async function countDealsByStage(stageId: string) {
  const [result] = await db
    .select({ count: count() })
    .from(deals)
    .where(eq(deals.stageId, stageId));
  return result?.count ?? 0;
}

export async function reorderStages(pipelineId: string, stageIds: string[]) {
  // Validate that stageIds matches the exact set of stages for this pipeline
  const existingStages = await db
    .select({ id: pipelineStages.id })
    .from(pipelineStages)
    .where(eq(pipelineStages.pipelineId, pipelineId));

  const existingIds = new Set(existingStages.map((s) => s.id));
  const inputIds = new Set(stageIds);

  if (existingIds.size !== inputIds.size) {
    throw new Error("Stage IDs mismatch: count does not match existing stages");
  }
  for (const id of stageIds) {
    if (!existingIds.has(id)) {
      throw new Error(`Stage IDs mismatch: unknown stage ${id}`);
    }
  }

  // Update positions atomically in a transaction
  await db.transaction(async (tx) => {
    for (let i = 0; i < stageIds.length; i++) {
      await tx
        .update(pipelineStages)
        .set({ position: i })
        .where(eq(pipelineStages.id, stageIds[i]));
    }
  });

  // Return the pipeline with updated stages
  return getPipelineWithStages(pipelineId);
}
