import { db } from "@/lib/db";
import { alerts, contacts } from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export async function listAlerts(userId: string, unreadOnly = false) {
  const conditions = [eq(alerts.userId, userId)];
  if (unreadOnly) conditions.push(eq(alerts.isRead, false));

  return db
    .select({
      id: alerts.id,
      type: alerts.type,
      title: alerts.title,
      message: alerts.message,
      severity: alerts.severity,
      isRead: alerts.isRead,
      contactId: alerts.contactId,
      contactFirstName: contacts.firstName,
      contactLastName: contacts.lastName,
      dealId: alerts.dealId,
      metadata: alerts.metadata,
      createdAt: alerts.createdAt,
    })
    .from(alerts)
    .leftJoin(contacts, eq(alerts.contactId, contacts.id))
    .where(and(...conditions))
    .orderBy(desc(alerts.createdAt))
    .limit(50);
}

export async function markAlertRead(id: string, userId: string) {
  await db
    .update(alerts)
    .set({ isRead: true })
    .where(and(eq(alerts.id, id), eq(alerts.userId, userId)));
}

export async function markAllAlertsRead(userId: string) {
  await db
    .update(alerts)
    .set({ isRead: true })
    .where(and(eq(alerts.userId, userId), eq(alerts.isRead, false)));
}

export async function dismissAlert(id: string, userId: string) {
  await db
    .update(alerts)
    .set({ dismissedAt: new Date(), isRead: true })
    .where(and(eq(alerts.id, id), eq(alerts.userId, userId)));
}

/**
 * Create an alert for a user.
 */
export async function createAlert(data: {
  type: typeof alerts.$inferInsert["type"];
  userId: string;
  contactId?: string;
  dealId?: string;
  title: string;
  message: string;
  severity: typeof alerts.$inferInsert["severity"];
  metadata?: Record<string, unknown>;
}) {
  const [alert] = await db.insert(alerts).values(data).returning();
  return alert;
}
