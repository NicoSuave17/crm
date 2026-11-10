import { db } from "@/lib/db";
import { crmIdSequences } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

const PREFIXES: Record<string, string> = {
  contact: "CON",
  company: "COM",
  deal: "DEAL",
};

/**
 * Atomically generates a unique CRM ID like CON-0001, COM-0042, DEAL-0123.
 * Uses UPDATE ... RETURNING for atomic increment.
 * Auto-seeds the sequence row if it doesn't exist yet.
 */
export async function generateCrmId(
  entityType: "contact" | "company" | "deal"
): Promise<string> {
  const prefix = PREFIXES[entityType];

  // Try atomic increment
  let [row] = await db
    .update(crmIdSequences)
    .set({ nextVal: sql`${crmIdSequences.nextVal} + 1` })
    .where(eq(crmIdSequences.entityType, entityType))
    .returning({ nextVal: crmIdSequences.nextVal });

  // Auto-seed if sequence row doesn't exist
  if (!row) {
    await db
      .insert(crmIdSequences)
      .values({ entityType, nextVal: 2 })
      .onConflictDoNothing();

    // Retry the atomic increment
    [row] = await db
      .update(crmIdSequences)
      .set({ nextVal: sql`${crmIdSequences.nextVal} + 1` })
      .where(eq(crmIdSequences.entityType, entityType))
      .returning({ nextVal: crmIdSequences.nextVal });
  }

  if (!row) {
    throw new Error(
      `CRM ID sequence could not be initialized for entity type: ${entityType}`
    );
  }

  // The returned value is already incremented, so the ID we use is (nextVal - 1)
  const seq = row.nextVal - 1;
  const padded = String(seq).padStart(4, "0");
  return `${prefix}-${padded}`;
}

/**
 * Atomically reserves N CRM IDs in a single query.
 * Returns an array of formatted IDs like ["CON-0001", "CON-0002", ...].
 */
export async function generateCrmIdBatch(
  entityType: "contact" | "company" | "deal",
  count: number
): Promise<string[]> {
  if (count <= 0) return [];
  if (count === 1) return [await generateCrmId(entityType)];

  const prefix = PREFIXES[entityType];

  // Atomic batch increment
  let [row] = await db
    .update(crmIdSequences)
    .set({ nextVal: sql`${crmIdSequences.nextVal} + ${count}` })
    .where(eq(crmIdSequences.entityType, entityType))
    .returning({ nextVal: crmIdSequences.nextVal });

  // Auto-seed if sequence row doesn't exist
  if (!row) {
    await db
      .insert(crmIdSequences)
      .values({ entityType, nextVal: count + 1 })
      .onConflictDoNothing();

    [row] = await db
      .update(crmIdSequences)
      .set({ nextVal: sql`${crmIdSequences.nextVal} + ${count}` })
      .where(eq(crmIdSequences.entityType, entityType))
      .returning({ nextVal: crmIdSequences.nextVal });
  }

  if (!row) {
    throw new Error(
      `CRM ID sequence could not be initialized for entity type: ${entityType}`
    );
  }

  // nextVal has been incremented by `count`, so the range is [nextVal - count, nextVal - 1]
  const endSeq = row.nextVal - 1;
  const startSeq = endSeq - count + 1;

  const ids: string[] = [];
  for (let seq = startSeq; seq <= endSeq; seq++) {
    ids.push(`${prefix}-${String(seq).padStart(4, "0")}`);
  }
  return ids;
}
