import { db } from "@/lib/db";
import { auditLog } from "@/lib/db/schema";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import { users } from "@/lib/db/schema";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "bulk_update"
  | "bulk_delete"
  | "import"
  | "merge"
  | "tag_add"
  | "tag_remove"
  | "assign"
  | "stage_change";

export type AuditSource = "ui" | "api" | "import" | "bulk" | "automation" | "merge";

export interface RecordAuditInput {
  entityType: string;
  entityId: string;
  action: AuditAction;
  userId: string;
  source?: AuditSource;
  /** For updates: { fieldName: { from: oldVal, to: newVal } } */
  changes?: Record<string, { from: unknown; to: unknown }>;
  /** For creates/deletes: full record snapshot */
  snapshot?: Record<string, unknown>;
  /** Links bulk operations together */
  correlationId?: string;
  /** Arbitrary extra data */
  metadata?: Record<string, unknown>;
}

/**
 * Record an immutable audit log entry.
 * Call this from every mutation path.
 */
export async function recordAudit(input: RecordAuditInput) {
  try {
    await db.insert(auditLog).values({
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      userId: input.userId,
      source: input.source ?? "ui",
      changes: input.changes ?? null,
      snapshot: input.snapshot ?? null,
      correlationId: input.correlationId ?? null,
      metadata: input.metadata ?? null,
    });
  } catch (error) {
    // Don't let audit logging failures break primary operations
    console.error("Audit log write failed:", error);
  }
}

/**
 * Record audit entries for a bulk operation.
 * Creates one entry per affected entity, all sharing the same correlationId.
 */
export async function recordBulkAudit(
  entityType: string,
  entityIds: string[],
  action: AuditAction,
  userId: string,
  metadata?: Record<string, unknown>
) {
  const correlationId = crypto.randomUUID();

  const values = entityIds.map((entityId) => ({
    entityType,
    entityId,
    action,
    userId,
    source: "bulk" as AuditSource,
    correlationId,
    metadata: metadata ?? null,
    changes: null,
    snapshot: null,
  }));

  if (values.length > 0) {
    try {
      await db.insert(auditLog).values(values);
    } catch (error) {
      console.error("Bulk audit log write failed:", error);
    }
  }

  return correlationId;
}

/**
 * Compute a changes diff between old and new values.
 * Only includes fields that actually changed.
 */
export function diffChanges(
  oldValues: Record<string, unknown>,
  newValues: Record<string, unknown>
): Record<string, { from: unknown; to: unknown }> | null {
  const SKIP_FIELDS = new Set(["id", "createdAt", "updatedAt"]);
  const changes: Record<string, { from: unknown; to: unknown }> = {};

  for (const [key, newVal] of Object.entries(newValues)) {
    if (SKIP_FIELDS.has(key)) continue;
    if (newVal === undefined) continue;

    const oldVal = oldValues[key];
    const oldStr = oldVal == null ? null : String(oldVal);
    const newStr = newVal == null ? null : String(newVal);

    if (oldStr !== newStr) {
      changes[key] = { from: oldVal ?? null, to: newVal ?? null };
    }
  }

  return Object.keys(changes).length > 0 ? changes : null;
}

/**
 * Query the audit log with filters.
 */
export async function queryAuditLog(params: {
  limit?: number;
  offset?: number;
  entityType?: string;
  entityId?: string;
  action?: string;
  userId?: string;
  since?: Date;
  until?: Date;
  /** For scoped access: only show entries for records owned by these user IDs */
  ownerScope?: "all" | "own";
  scopeUserId?: string;
}) {
  const {
    limit = 50,
    offset = 0,
    entityType,
    entityId,
    action,
    userId,
    since,
    until,
  } = params;

  const conditions = [];

  if (entityType) conditions.push(eq(auditLog.entityType, entityType));
  if (entityId) conditions.push(eq(auditLog.entityId, entityId));
  if (action) conditions.push(eq(auditLog.action, action as AuditAction));
  if (userId) conditions.push(eq(auditLog.userId, userId));
  if (since) conditions.push(gte(auditLog.createdAt, since));
  if (until) conditions.push(lte(auditLog.createdAt, until));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(auditLog)
    .where(whereClause);

  const rows = await db
    .select({
      id: auditLog.id,
      entityType: auditLog.entityType,
      entityId: auditLog.entityId,
      action: auditLog.action,
      changes: auditLog.changes,
      snapshot: auditLog.snapshot,
      userId: auditLog.userId,
      userFirstName: users.firstName,
      userLastName: users.lastName,
      source: auditLog.source,
      correlationId: auditLog.correlationId,
      metadata: auditLog.metadata,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .leftJoin(users, eq(auditLog.userId, users.id))
    .where(whereClause)
    .orderBy(desc(auditLog.createdAt))
    .limit(limit)
    .offset(offset);

  return { data: rows, total: Number(countResult.count) };
}
