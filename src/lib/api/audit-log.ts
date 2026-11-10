import { db } from "@/lib/db";
import { activities, users } from "@/lib/db/schema";
import { desc, eq, sql, and, gte, lte } from "drizzle-orm";

// We use the activities table for audit logging with type="system_event"
// and metadata to store the change details

export interface AuditEntry {
  action: string;
  entityType:
    | "contact"
    | "deal"
    | "task"
    | "pipeline"
    | "tag"
    | "custom_field"
    | "user"
    | "company"
    | "nav_item"
    | "permission"
    | "role_config"
    | "report"
    | "field_definition"
    | "admin_view";
  entityId: string;
  changes?: Record<string, { from: unknown; to: unknown }>;
  metadata?: Record<string, unknown>;
}

export async function logAuditEvent(userId: string, entry: AuditEntry) {
  await db.insert(activities).values({
    type: "system_event",
    subject: entry.action,
    body: `${entry.entityType}:${entry.entityId}`,
    userId,
    metadata: {
      auditAction: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      changes: entry.changes,
      ...entry.metadata,
    },
    contactId: entry.entityType === "contact" && entry.entityId !== "bulk" ? entry.entityId : undefined,
    dealId: entry.entityType === "deal" && entry.entityId !== "bulk" ? entry.entityId : undefined,
  });
}

export async function listAuditLog(params: {
  limit?: number;
  offset?: number;
  entityType?: string;
  userId?: string;
  since?: Date;
  until?: Date;
}) {
  const { limit = 50, offset = 0, entityType, userId, since, until } = params;

  const conditions = [eq(activities.type, "system_event")];

  if (userId) {
    conditions.push(eq(activities.userId, userId));
  }

  if (since) {
    conditions.push(gte(activities.occurredAt, since));
  }

  if (until) {
    conditions.push(lte(activities.occurredAt, until));
  }

  // Build the base where clause
  const whereClause = and(...conditions);

  // Get total count (before pagination, but after filters except entityType which is app-level)
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(activities)
    .where(whereClause);

  const rows = await db
    .select({
      id: activities.id,
      action: activities.subject,
      body: activities.body,
      metadata: activities.metadata,
      userId: activities.userId,
      userFirstName: users.firstName,
      userLastName: users.lastName,
      occurredAt: activities.occurredAt,
    })
    .from(activities)
    .leftJoin(users, eq(activities.userId, users.id))
    .where(whereClause)
    .orderBy(desc(activities.occurredAt))
    .limit(limit)
    .offset(offset);

  // entityType filter is in metadata, applied in application layer
  let filtered = rows;
  if (entityType) {
    filtered = rows.filter(
      (r) => (r.metadata as Record<string, unknown>)?.entityType === entityType
    );
  }

  return { data: filtered, total: Number(countResult.count) };
}
